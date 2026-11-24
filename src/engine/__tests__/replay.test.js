import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInitialGame, dispatch } from "../pipeline.js";
import {
  algebraicToCoord,
  coordToAlgebraic,
  createMatchTracker,
  createReplaySession,
  deserializeMatchHistoryFromJson,
  formatActionNotation,
  parseHbcPgn,
  replayMatchActions,
  serializeMatchHistoryToJson,
  serializeToHbcPgn,
} from "../replay.js";

import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

function buildTestHistory() {
  const initial = createInitialGame({
    mapPreset: "CROSSROADS",
    boardSize: 16,
  });
  const tracker = createMatchTracker(initial.state);

  const action1 = {
    type: "PLACE_PIECE",
    playerId: 1,
    coord: { x: 8, y: 6 },
    skillType: "NONE",
  };
  const res1 = dispatch(initial.state, action1);
  tracker.recordStep(action1, res1.nextState, res1.events);

  return tracker.getHistory();
}

describe("Phase 8: Match History & Visual Replay System (src/engine/replay.ts)", () => {
  describe("Algebraic Coordinate Conversion", () => {
    it("converts 0-indexed coordinates to standard algebraic notation", () => {
      assert.strictEqual(coordToAlgebraic({ x: 0, y: 0 }), "A1");
      assert.strictEqual(coordToAlgebraic({ x: 7, y: 7 }), "H8");
      assert.strictEqual(coordToAlgebraic({ x: 15, y: 15 }), "P16");
      assert.strictEqual(coordToAlgebraic({ x: 2, y: 5 }), "C6");
    });

    it("parses valid algebraic coordinates into 0-indexed coords", () => {
      assert.deepStrictEqual(algebraicToCoord("A1"), { x: 0, y: 0 });
      assert.deepStrictEqual(algebraicToCoord("h8"), { x: 7, y: 7 });
      assert.deepStrictEqual(algebraicToCoord("P16"), { x: 15, y: 15 });
      assert.deepStrictEqual(algebraicToCoord("C6"), { x: 2, y: 5 });
    });

    it("throws descriptive error on invalid algebraic coordinates", () => {
      assert.throws(
        () => algebraicToCoord("Z1"),
        /Invalid algebraic coordinate: "Z1"/,
      );
      assert.throws(
        () => algebraicToCoord("A0"),
        /Invalid algebraic coordinate: "A0"/,
      );
      assert.throws(
        () => algebraicToCoord("A17"),
        /Invalid algebraic coordinate: "A17"/,
      );
      assert.throws(
        () => algebraicToCoord(""),
        /Invalid algebraic coordinate: ""/,
      );
    });
  });

  describe("HBC-PGN Notation Formatting", () => {
    it("formats standard piece placements with flip count annotations", () => {
      const action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 7, y: 7 },
        skillType: "NONE",
      };
      const events = [
        {
          type: "FLIP_BATCH",
          coords: [
            { x: 7, y: 8 },
            { x: 7, y: 9 },
          ],
          fromTeamIds: [2],
          toTeamId: 1,
        },
      ];

      const notation = formatActionNotation(action, events, 1);
      assert.strictEqual(notation, "1. P1:H8[NONE] {flips:2}");
    });

    it("formats pass actions without coordinate or skills", () => {
      const action = {
        type: "PASS_TURN",
        playerId: 2,
      };
      const notation = formatActionNotation(action, [], 4);
      assert.strictEqual(notation, "4. P2:PASS");
    });

    it("formats special skills and complex combat events (block, penetrate, bomb, counter, purify, pioneer)", () => {
      const action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 3, y: 4 },
        skillType: "PIERCE",
      };
      const events = [
        {
          type: "PIONEER_PLACED",
          coord: { x: 3, y: 4 },
          playerId: 1,
          piece: makePiece(1, 1, "PIERCE"),
        },
        {
          type: "RAYCAST_BLOCKED",
          coord: { x: 3, y: 5 },
          blockerPiece: makePiece(2, 2, "WALL"),
          direction: { x: 0, y: 1 },
        },
        {
          type: "PIECE_REVEALED",
          coord: { x: 3, y: 4 },
          skillType: "PIERCE",
          reason: "PENETRATE",
        },
        {
          type: "BOMB_TRIGGERED",
          coord: { x: 3, y: 6 },
          teamId: 1,
          blastCoords: [
            { x: 2, y: 6 },
            { x: 3, y: 6 },
            { x: 4, y: 6 },
          ],
        },
        {
          type: "COUNTER_TRIGGERED",
          coord: { x: 3, y: 7 },
          defenderTeamId: 2,
          reversedCoords: [{ x: 3, y: 4 }],
        },
        {
          type: "PURIFY_PULSE",
          coord: { x: 8, y: 8 },
          teamId: 1,
          affectedCoords: [{ x: 8, y: 9 }],
          remainingDuration: 2,
        },
      ];

      const notation = formatActionNotation(action, events, 10);
      assert.ok(notation.includes("10. P1:D5[PIERCE]"));
      assert.ok(notation.includes("pioneer:1"));
      assert.ok(notation.includes("block:1"));
      assert.ok(notation.includes("penetrate:1"));
      assert.ok(notation.includes("bomb:1(3)"));
      assert.ok(notation.includes("counter:1(1)"));
      assert.ok(notation.includes("purify:1(1)"));
    });
  });

  describe("JSON Serialization & Deserialization", () => {
    it("serializes and deserializes MatchHistory preserving Infinity in player hand", () => {
      const initial = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const tracker = createMatchTracker(initial.state, "test-match-1");

      const action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };

      const { nextState, events } = dispatch(initial.state, action);
      tracker.recordStep(action, nextState, events);

      const history = tracker.getHistory();
      const jsonStr = serializeMatchHistoryToJson(history);
      assert.ok(jsonStr.includes("__HBC_INFINITY__"));

      const restored = deserializeMatchHistoryFromJson(jsonStr);
      assert.strictEqual(restored.metadata.id, "test-match-1");
      assert.strictEqual(restored.steps.length, 1);

      // Verify Infinity hand value is preserved accurately
      const p1 = restored.initialState.players.find((p) => p.id === 1);
      assert.strictEqual(p1?.hand.NONE, Infinity);

      const restoredStep = restored.steps[0];
      assert.deepStrictEqual(restoredStep?.action, action);
      assert.strictEqual(
        restoredStep?.stateSnapshot.currentTurn,
        nextState.currentTurn,
      );
    });

    it("throws descriptive error when deserializing invalid JSON payload", () => {
      assert.throws(
        () => deserializeMatchHistoryFromJson("{}"),
        /Invalid HBC match history JSON: missing required fields/,
      );
    });
  });

  describe("HBC-PGN Serialization & Parsing", () => {
    it("serializes match history to PGN and parses it back into valid actions", () => {
      const initial = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const tracker = createMatchTracker(initial.state, "crossroads-match");

      // Play 2 turns
      const action1 = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };
      const res1 = dispatch(initial.state, action1);
      tracker.recordStep(action1, res1.nextState, res1.events);

      const action2 = {
        type: "PLACE_PIECE",
        playerId: 2,
        coord: { x: 6, y: 6 },
        skillType: "WALL",
      };
      // For testing, mock state step
      tracker.recordStep(action2, res1.nextState, []);

      const pgn = serializeToHbcPgn(tracker.getHistory());
      assert.ok(pgn.includes('[MapPreset "CROSSROADS"]'));
      assert.ok(pgn.includes('[BoardSize "16"]'));
      assert.ok(pgn.includes("1. P1:I7[NONE]"));
      assert.ok(pgn.includes("2. P2:G7[WALL]"));

      const parsed = parseHbcPgn(pgn);
      assert.strictEqual(parsed.mapPreset, "CROSSROADS");
      assert.strictEqual(parsed.boardSize, 16);
      assert.strictEqual(parsed.actions.length, 2);
      assert.deepStrictEqual(parsed.actions[0], action1);
      assert.deepStrictEqual(parsed.actions[1], action2);
    });

    it("correctly parses passes in PGN streams", () => {
      const pgnText = `
[Event "Test"]
[MapPreset "CROSSROADS"]
[BoardSize "16"]

1. P1:PASS 2. P2:H8[NONE]
`;
      const parsed = parseHbcPgn(pgnText);
      assert.strictEqual(parsed.actions.length, 2);
      assert.deepStrictEqual(parsed.actions[0], {
        type: "PASS_TURN",
        playerId: 1,
      });
      assert.deepStrictEqual(parsed.actions[1], {
        type: "PLACE_PIECE",
        playerId: 2,
        coord: { x: 7, y: 7 },
        skillType: "NONE",
      });
    });
  });

  describe("Deterministic Replay Actions Rebuilder", () => {
    it("reconstructs exact states and steps from an action sequence", () => {
      const initial = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });

      // Play move
      const action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };

      const liveResult = dispatch(initial.state, action);
      const { history, finalState } = replayMatchActions("CROSSROADS", 16, [
        action,
      ]);

      assert.strictEqual(history.steps.length, 1);
      assert.strictEqual(
        finalState.currentTurn,
        liveResult.nextState.currentTurn,
      );
      assert.strictEqual(finalState.board[6]?.[8]?.teamId, 1);
    });
  });

  describe("ReplaySession Step Navigation & Fog of War", () => {
    it("navigates forward, backward, jumpToStart, and jumpToEnd", () => {
      const history = buildTestHistory();
      const session = createReplaySession(history, -1);

      assert.strictEqual(session.getCurrentIndex(), -1);
      assert.strictEqual(session.getCurrentStep(), null);
      assert.strictEqual(session.canStepBackward(), false);
      assert.strictEqual(session.canStepForward(), true);

      // Step forward
      const fwd = session.stepForward();
      assert.notStrictEqual(fwd, null);
      assert.strictEqual(session.getCurrentIndex(), 0);
      assert.notStrictEqual(session.getCurrentStep(), null);
      assert.strictEqual(session.canStepForward(), false);
      assert.strictEqual(session.canStepBackward(), true);

      // Step backward to initial
      const bwd = session.stepBackward();
      assert.notStrictEqual(bwd, null);
      assert.strictEqual(session.getCurrentIndex(), -1);
      assert.strictEqual(session.getCurrentStep(), null);

      // Jump to end
      session.jumpToEnd();
      assert.strictEqual(session.getCurrentIndex(), 0);

      // Jump to start
      session.jumpToStart();
      assert.strictEqual(session.getCurrentIndex(), -1);

      // Jump to specific index
      session.jumpToStep(0);
      assert.strictEqual(session.getCurrentIndex(), 0);
    });

    it("sanitizes board states for specific viewer perspectives during replay", () => {
      const board = createEmptyBoard(16);
      // Place hidden enemy WALL at (5, 5) belonging to Team 2
      setCell(board, 5, 5, makePiece(2, 2, "WALL", false));
      const testState = makeTestState(board, 1);

      const history = {
        metadata: {
          id: "m-test",
          date: new Date().toISOString(),
          mapPreset: "CROSSROADS",
          boardSize: 16,
          players: testState.players.map((p) => ({
            id: p.id,
            teamId: p.teamId,
            name: p.name,
          })),
          winnerTeamId: null,
          totalTurns: 1,
          isGameOver: false,
        },
        initialState: testState,
        steps: [
          {
            stepIndex: 0,
            turnNumber: 1,
            playerId: 1,
            action: {
              type: "PLACE_PIECE",
              playerId: 1,
              coord: { x: 5, y: 6 },
              skillType: "NONE",
            },
            events: [],
            notation: "1. P1:F7[NONE]",
            stateSnapshot: testState,
          },
        ],
      };

      const session = createReplaySession(history, 0);

      // Spectator view (null viewer): reveals true WALL
      const spectatorState = session.getCurrentMaskedState(null);
      assert.strictEqual(spectatorState.board[5]?.[5]?.skillType, "WALL");

      // Player 1 (Enemy) perspective: masks WALL to NONE
      const enemyPerspective = session.getCurrentMaskedState(1);
      assert.strictEqual(enemyPerspective.board[5]?.[5]?.skillType, "NONE");

      // Player 2 (Friendly) perspective: reveals WALL
      const allyPerspective = session.getCurrentMaskedState(2);
      assert.strictEqual(allyPerspective.board[5]?.[5]?.skillType, "WALL");
    });
  });
});

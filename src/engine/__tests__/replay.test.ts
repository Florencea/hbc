import { describe, expect, it } from "vitest";
import { createInitialGame, dispatch } from "../pipeline.ts";
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
  type MatchHistory,
} from "../replay.ts";
import { type Action, type GameEvent, type GameState } from "../types.ts";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.ts";

describe("Phase 8: Match History & Visual Replay System (src/engine/replay.ts)", () => {
  describe("Algebraic Coordinate Conversion", () => {
    it("converts 0-indexed coordinates to standard algebraic notation", () => {
      expect(coordToAlgebraic({ x: 0, y: 0 })).toBe("A1");
      expect(coordToAlgebraic({ x: 7, y: 7 })).toBe("H8");
      expect(coordToAlgebraic({ x: 15, y: 15 })).toBe("P16");
      expect(coordToAlgebraic({ x: 2, y: 5 })).toBe("C6");
    });

    it("parses valid algebraic coordinates into 0-indexed coords", () => {
      expect(algebraicToCoord("A1")).toEqual({ x: 0, y: 0 });
      expect(algebraicToCoord("h8")).toEqual({ x: 7, y: 7 });
      expect(algebraicToCoord("P16")).toEqual({ x: 15, y: 15 });
      expect(algebraicToCoord("C6")).toEqual({ x: 2, y: 5 });
    });

    it("throws descriptive error on invalid algebraic coordinates", () => {
      expect(() => algebraicToCoord("Z1")).toThrow(
        'Invalid algebraic coordinate: "Z1"',
      );
      expect(() => algebraicToCoord("A0")).toThrow(
        'Invalid algebraic coordinate: "A0"',
      );
      expect(() => algebraicToCoord("A17")).toThrow(
        'Invalid algebraic coordinate: "A17"',
      );
      expect(() => algebraicToCoord("")).toThrow(
        'Invalid algebraic coordinate: ""',
      );
    });
  });

  describe("HBC-PGN Notation Formatting", () => {
    it("formats standard piece placements with flip count annotations", () => {
      const action: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 7, y: 7 },
        skillType: "NONE",
      };
      const events: GameEvent[] = [
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
      expect(notation).toBe("1. P1:H8[NONE] {flips:2}");
    });

    it("formats pass actions without coordinate or skills", () => {
      const action: Action = {
        type: "PASS_TURN",
        playerId: 2,
      };
      const notation = formatActionNotation(action, [], 4);
      expect(notation).toBe("4. P2:PASS");
    });

    it("formats special skills and complex combat events (block, penetrate, bomb, counter, purify, pioneer)", () => {
      const action: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 3, y: 4 },
        skillType: "PIERCE",
      };
      const events: GameEvent[] = [
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
      expect(notation).toContain("10. P1:D5[PIERCE]");
      expect(notation).toContain("pioneer:1");
      expect(notation).toContain("block:1");
      expect(notation).toContain("penetrate:1");
      expect(notation).toContain("bomb:1(3)");
      expect(notation).toContain("counter:1(1)");
      expect(notation).toContain("purify:1(1)");
    });
  });

  describe("JSON Serialization & Deserialization", () => {
    it("serializes and deserializes MatchHistory preserving Infinity in player hand", () => {
      const initial = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const tracker = createMatchTracker(initial.state, "test-match-1");

      const action: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };

      const { nextState, events } = dispatch(initial.state, action);
      tracker.recordStep(action, nextState, events);

      const history = tracker.getHistory();
      const jsonStr = serializeMatchHistoryToJson(history);
      expect(jsonStr).toContain("__HBC_INFINITY__");

      const restored = deserializeMatchHistoryFromJson(jsonStr);
      expect(restored.metadata.id).toBe("test-match-1");
      expect(restored.steps.length).toBe(1);

      // Verify Infinity hand value is preserved accurately
      const p1 = restored.initialState.players.find((p) => p.id === 1);
      expect(p1?.hand.NONE).toBe(Infinity);

      const restoredStep = restored.steps[0];
      expect(restoredStep?.action).toEqual(action);
      expect(restoredStep?.stateSnapshot.currentTurn).toBe(
        nextState.currentTurn,
      );
    });

    it("throws descriptive error when deserializing invalid JSON payload", () => {
      expect(() => deserializeMatchHistoryFromJson("{}")).toThrow(
        "Invalid HBC match history JSON: missing required fields",
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
      const action1: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };
      const res1 = dispatch(initial.state, action1);
      tracker.recordStep(action1, res1.nextState, res1.events);

      const action2: Action = {
        type: "PLACE_PIECE",
        playerId: 2,
        coord: { x: 6, y: 6 },
        skillType: "WALL",
      };
      // For testing, mock state step
      tracker.recordStep(action2, res1.nextState, []);

      const pgn = serializeToHbcPgn(tracker.getHistory());
      expect(pgn).toContain('[MapPreset "CROSSROADS"]');
      expect(pgn).toContain('[BoardSize "16"]');
      expect(pgn).toContain("1. P1:I7[NONE]");
      expect(pgn).toContain("2. P2:G7[WALL]");

      const parsed = parseHbcPgn(pgn);
      expect(parsed.mapPreset).toBe("CROSSROADS");
      expect(parsed.boardSize).toBe(16);
      expect(parsed.actions.length).toBe(2);
      expect(parsed.actions[0]).toEqual(action1);
      expect(parsed.actions[1]).toEqual(action2);
    });

    it("correctly parses passes in PGN streams", () => {
      const pgnText = `
[Event "Test"]
[MapPreset "CROSSROADS"]
[BoardSize "16"]

1. P1:PASS 2. P2:H8[NONE]
`;
      const parsed = parseHbcPgn(pgnText);
      expect(parsed.actions.length).toBe(2);
      expect(parsed.actions[0]).toEqual({
        type: "PASS_TURN",
        playerId: 1,
      });
      expect(parsed.actions[1]).toEqual({
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
      const action: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };

      const liveResult = dispatch(initial.state, action);
      const { history, finalState } = replayMatchActions("CROSSROADS", 16, [
        action,
      ]);

      expect(history.steps.length).toBe(1);
      expect(finalState.currentTurn).toBe(liveResult.nextState.currentTurn);
      expect(finalState.board[6]?.[8]?.teamId).toBe(1);
    });
  });

  describe("ReplaySession Step Navigation & Fog of War", () => {
    function buildTestHistory(): MatchHistory {
      const initial = createInitialGame({
        mapPreset: "CROSSROADS",
        boardSize: 16,
      });
      const tracker = createMatchTracker(initial.state);

      const action1: Action = {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 8, y: 6 },
        skillType: "NONE",
      };
      const res1 = dispatch(initial.state, action1);
      tracker.recordStep(action1, res1.nextState, res1.events);

      return tracker.getHistory();
    }

    it("navigates forward, backward, jumpToStart, and jumpToEnd", () => {
      const history = buildTestHistory();
      const session = createReplaySession(history, -1);

      expect(session.getCurrentIndex()).toBe(-1);
      expect(session.getCurrentStep()).toBeNull();
      expect(session.canStepBackward()).toBe(false);
      expect(session.canStepForward()).toBe(true);

      // Step forward
      const fwd = session.stepForward();
      expect(fwd).not.toBeNull();
      expect(session.getCurrentIndex()).toBe(0);
      expect(session.getCurrentStep()).not.toBeNull();
      expect(session.canStepForward()).toBe(false);
      expect(session.canStepBackward()).toBe(true);

      // Step backward to initial
      const bwd = session.stepBackward();
      expect(bwd).not.toBeNull();
      expect(session.getCurrentIndex()).toBe(-1);
      expect(session.getCurrentStep()).toBeNull();

      // Jump to end
      session.jumpToEnd();
      expect(session.getCurrentIndex()).toBe(0);

      // Jump to start
      session.jumpToStart();
      expect(session.getCurrentIndex()).toBe(-1);

      // Jump to specific index
      session.jumpToStep(0);
      expect(session.getCurrentIndex()).toBe(0);
    });

    it("sanitizes board states for specific viewer perspectives during replay", () => {
      const board = createEmptyBoard(16);
      // Place hidden enemy WALL at (5, 5) belonging to Team 2
      setCell(board, 5, 5, makePiece(2, 2, "WALL", false));
      const testState: GameState = makeTestState(board, 1);

      const history: MatchHistory = {
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
      expect(spectatorState.board[5]?.[5]?.skillType).toBe("WALL");

      // Player 1 (Enemy) perspective: masks WALL to NONE
      const enemyPerspective = session.getCurrentMaskedState(1);
      expect(enemyPerspective.board[5]?.[5]?.skillType).toBe("NONE");

      // Player 2 (Friendly) perspective: reveals WALL
      const allyPerspective = session.getCurrentMaskedState(2);
      expect(allyPerspective.board[5]?.[5]?.skillType).toBe("WALL");
    });
  });
});

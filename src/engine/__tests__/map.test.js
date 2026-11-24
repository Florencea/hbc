import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

import {
  createInitialGame,
  createInitialState,
  createNeutralPiece,
  dispatch,
  getDistance,
  getLegalMoves,
  getPiece,
  IllegalMoveError,
  isWithinDropZone,
} from "../index.js";

describe("Map Templates, Neutral Anchors & Drop Phase (map.test.ts)", () => {
  it("neutral_pieces_captured_by_any_team: Team 1 and Team 2 can sandwich neutral pieces and convert them", () => {
    const board = createEmptyBoard(16);
    // Team 1 test: Friendly at (2, 2), Neutral at (3, 2) & (4, 2)
    setCell(board, 2, 2, makePiece(1, 1, "NONE"));
    setCell(board, 2, 3, createNeutralPiece());
    setCell(board, 2, 4, createNeutralPiece());

    // Team 2 test: Friendly at (8, 8), Neutral at (8, 9)
    setCell(board, 8, 8, makePiece(2, 2, "NONE"));
    setCell(board, 9, 8, createNeutralPiece());

    const state = makeTestState(board, 1);

    // Player 1 plays at (5, 2), sandwiching neutral pieces (3, 2) and (4, 2) against (2, 2)
    const res1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 2 },
      skillType: "NONE",
    });

    assert.strictEqual(res1.nextState.board[2]?.[3]?.teamId, 1);
    assert.strictEqual(res1.nextState.board[2]?.[3]?.playerId, 1);
    assert.strictEqual(res1.nextState.board[2]?.[4]?.teamId, 1);
    assert.strictEqual(res1.nextState.board[2]?.[4]?.playerId, 1);

    const flipEvent1 = res1.events.find((e) => e.type === "FLIP_BATCH");
    assert.notStrictEqual(flipEvent1, undefined);
    assert.strictEqual(flipEvent1?.toTeamId, 1);
    assert.ok(flipEvent1?.fromTeamIds.includes(0));
    assert.ok(
      flipEvent1?.coords.some((c) => c.x === 3 && c.y === 2) &&
        flipEvent1.coords.some((c) => c.x === 4 && c.y === 2),
    );

    // Now active player is Player 2. Player 2 plays at (8, 10), sandwiching (8, 9) against (8, 8)
    const res2 = dispatch(res1.nextState, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 8, y: 10 },
      skillType: "NONE",
    });

    assert.strictEqual(res2.nextState.board[9]?.[8]?.teamId, 2);
    assert.strictEqual(res2.nextState.board[9]?.[8]?.playerId, 2);
  });

  it("drop_phase_restricts_out_of_bound_moves: Placing outside assigned drop zone throws IllegalMoveError", () => {
    const board = createEmptyBoard(16);
    // Player 1 anchor at (7, 7)
    setCell(board, 7, 7, makePiece(1, 1, "NONE"));
    setCell(board, 7, 6, createNeutralPiece());

    // Far away pieces that would constitute a legal reversi capture if not in drop phase
    setCell(board, 1, 1, makePiece(1, 1, "NONE"));
    setCell(board, 1, 2, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);
    state.isDropPhase = true;
    state.dropTurnsRemaining = 4;
    const player1 = state.players[0];
    if (player1) {
      player1.dropZone = {
        center: { x: 7, y: 7 },
        radius: 2,
      };
    }

    // (1, 3) would capture (1, 2) against (1, 1), but is far outside dropZone (center 7, 7 radius 2)
    const p1DropZone = player1?.dropZone;
    assert.notStrictEqual(p1DropZone, undefined);
    assert.ok(
      getDistance({ x: 3, y: 1 }, p1DropZone?.center ?? { x: 0, y: 0 }) >
        (p1DropZone?.radius ?? 0),
    );

    assert.throws(
      () =>
        dispatch(state, {
          type: "PLACE_PIECE",
          playerId: 1,
          coord: { x: 3, y: 1 },
          skillType: "NONE",
        }),
      IllegalMoveError,
    );

    assert.throws(
      () =>
        dispatch(state, {
          type: "PLACE_PIECE",
          playerId: 1,
          coord: { x: 3, y: 1 },
          skillType: "NONE",
        }),
      /Placement outside assigned drop zone during Drop Phase/,
    );

    // Also verify getLegalMoves filters out coordinates outside the drop zone
    const legalMoves = getLegalMoves(state, 1);
    assert.ok(
      !legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 3, y: 1 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.ok(
      legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 5, y: 7 });
          return true;
        } catch {
          return false;
        }
      }),
    ); // Captures (6, 7) against (7, 7)
  });

  it("drop_phase_allows_in_bound_moves: Placing within drop zone succeeds and captures neutral anchors", () => {
    const state = createInitialState(16, undefined, "CROSSROADS");
    assert.strictEqual(state.isDropPhase, true);
    assert.strictEqual(state.dropTurnsRemaining, 4);

    const p1 = state.players[0];
    assert.notStrictEqual(p1, undefined);
    if (!p1?.dropZone) {
      throw new Error("Drop zone not defined");
    }

    // In CROSSROADS, (7, 5) flanks neutral (7, 6) against friendly anchor (7, 7)
    const coord = { x: 7, y: 5 };
    assert.strictEqual(isWithinDropZone(coord, p1.dropZone), true);

    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: p1.id,
      coord,
      skillType: "NONE",
    });

    assert.strictEqual(nextState.board[5]?.[7]?.teamId, p1.teamId);
    assert.strictEqual(nextState.board[6]?.[7]?.teamId, p1.teamId);
    assert.strictEqual(nextState.dropTurnsRemaining, 3);
    assert.strictEqual(nextState.isDropPhase, true);

    const flip = events.find((e) => e.type === "FLIP_BATCH");
    assert.notStrictEqual(flip, undefined);
    assert.ok(
      flip?.coords.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 7, y: 6 });
          return true;
        } catch {
          return false;
        }
      }),
    );
  });

  it("drop_phase_ends_after_turns_exhausted: isDropPhase switches to false and allows full-board placement", () => {
    const state = createInitialState(16);
    assert.strictEqual(state.isDropPhase, true);
    assert.strictEqual(state.dropTurnsRemaining, 4);

    // Turn 1: Player 1 plays within drop zone at (8, 6)
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 8, y: 6 },
      skillType: "NONE",
    });
    assert.strictEqual(turn1.nextState.dropTurnsRemaining, 3);
    assert.strictEqual(turn1.nextState.isDropPhase, true);

    // Turn 2: Player 2 passes turn
    const turn2 = dispatch(turn1.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    assert.strictEqual(turn2.nextState.dropTurnsRemaining, 2);
    assert.strictEqual(turn2.nextState.isDropPhase, true);

    // Turn 3: Player 1 passes turn
    const turn3 = dispatch(turn2.nextState, {
      type: "PASS_TURN",
      playerId: 1,
    });
    assert.strictEqual(turn3.nextState.dropTurnsRemaining, 1);
    assert.strictEqual(turn3.nextState.isDropPhase, true);

    // Turn 4: Player 2 passes turn (final drop turn!)
    const turn4 = dispatch(turn3.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    assert.strictEqual(turn4.nextState.dropTurnsRemaining, 0);
    assert.strictEqual(turn4.nextState.isDropPhase, false);

    const dropEnded = turn4.events.find((e) => e.type === "DROP_PHASE_ENDED");
    assert.notStrictEqual(dropEnded, undefined);

    // Turn 5: Set up a board opportunity outside initial drop zone
    // Player 1 can now legally place outside their initial drop zone
    setCell(turn4.nextState.board, 1, 1, makePiece(1, 1, "NONE"));
    setCell(turn4.nextState.board, 1, 2, makePiece(2, 2, "NONE"));

    const turn5 = dispatch(turn4.nextState, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 3, y: 1 },
      skillType: "NONE",
    });

    assert.strictEqual(turn5.nextState.board[1]?.[3]?.teamId, 1);
    assert.strictEqual(turn5.nextState.board[1]?.[2]?.teamId, 1);
  });

  it("archipelago_and_trenches_presets: Verify correct board generation for ARCHIPELAGO and TRENCHES presets", () => {
    // 1. ARCHIPELAGO preset
    const archState = createInitialState({
      mapPreset: "ARCHIPELAGO",
      boardSize: 16,
    });
    assert.strictEqual(archState.mapPreset, "ARCHIPELAGO");

    // Count neutral pieces: 4 islands of 2x2 = 16 neutral pieces
    let neutralCount = 0;
    for (let y = 0; y < archState.size; y++) {
      for (let x = 0; x < archState.size; x++) {
        if (archState.board[y]?.[x]?.teamId === 0) {
          neutralCount++;
        }
      }
    }
    assert.strictEqual(neutralCount, 16);

    // Check that every player has a dropZone containing at least one neutral piece
    for (const player of archState.players) {
      assert.notStrictEqual(player.dropZone, undefined);
      if (!player.dropZone) continue;
      let neutralsInZone = 0;
      for (let y = 0; y < archState.size; y++) {
        for (let x = 0; x < archState.size; x++) {
          if (
            archState.board[y]?.[x]?.teamId === 0 &&
            isWithinDropZone({ x, y }, player.dropZone)
          ) {
            neutralsInZone++;
          }
        }
      }
      assert.ok(neutralsInZone >= 1);
    }

    // Verify Player 1 has legal opening moves and can capture an archipelago anchor
    const archLegalMoves = getLegalMoves(archState, archState.activePlayerId);
    assert.ok(archLegalMoves.length > 0);
    const archMove = archLegalMoves[0];
    if (!archMove) {
      throw new Error("No archipelago legal moves found");
    }

    const archRes = dispatch(archState, {
      type: "PLACE_PIECE",
      playerId: archState.activePlayerId,
      coord: archMove,
      skillType: "NONE",
    });
    const archFlip = archRes.events.find((e) => e.type === "FLIP_BATCH");
    assert.notStrictEqual(archFlip, undefined);
    assert.ok(archFlip?.fromTeamIds.includes(0));

    // 2. TRENCHES preset
    const trenchState = createInitialState({
      mapPreset: "TRENCHES",
      boardSize: 16,
    });
    assert.strictEqual(trenchState.mapPreset, "TRENCHES");

    // Neutral pieces form intersecting paths along row 8 and col 8
    const mid = 8;
    assert.strictEqual(getPiece(trenchState.board, 4, mid)?.teamId, 0);
    assert.strictEqual(getPiece(trenchState.board, mid, 4)?.teamId, 0);

    // Every player has a dropZone containing neutral pieces
    for (const player of trenchState.players) {
      assert.notStrictEqual(player.dropZone, undefined);
      if (!player.dropZone) continue;
      let neutralsInZone = 0;
      for (let y = 0; y < trenchState.size; y++) {
        for (let x = 0; x < trenchState.size; x++) {
          if (
            trenchState.board[y]?.[x]?.teamId === 0 &&
            isWithinDropZone({ x, y }, player.dropZone)
          ) {
            neutralsInZone++;
          }
        }
      }
      assert.ok(neutralsInZone >= 1);
    }

    // Verify Player 1 has legal moves along the trench
    const trenchLegalMoves = getLegalMoves(
      trenchState,
      trenchState.activePlayerId,
    );
    assert.ok(trenchLegalMoves.length > 0);
    const trenchMove = trenchLegalMoves[0];
    if (!trenchMove) {
      throw new Error("No trenches legal moves found");
    }

    const trenchRes = dispatch(trenchState, {
      type: "PLACE_PIECE",
      playerId: trenchState.activePlayerId,
      coord: trenchMove,
      skillType: "NONE",
    });
    const trenchFlip = trenchRes.events.find((e) => e.type === "FLIP_BATCH");
    assert.notStrictEqual(trenchFlip, undefined);
    assert.ok(trenchFlip?.fromTeamIds.includes(0));
  });

  it("createInitialGame: initializes game with DROP_PHASE_STARTED event and player drop zones", () => {
    const { state, events } = createInitialGame({
      mapPreset: "CROSSROADS",
      boardSize: 16,
    });
    assert.strictEqual(state.mapPreset, "CROSSROADS");
    assert.strictEqual(state.isDropPhase, true);

    const startEvent = events.find((e) => e.type === "DROP_PHASE_STARTED");
    assert.notStrictEqual(startEvent, undefined);
    assert.strictEqual(startEvent?.mapPreset, "CROSSROADS");
    assert.strictEqual(startEvent?.players.length, 2);
    assert.strictEqual(startEvent?.players[0]?.dropZone.radius, 3);
  });
});

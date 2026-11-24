import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IllegalMoveError } from "../map.js";
import { dispatch } from "../pipeline.js";
import {
  getAvailableMoves,
  getLegalMoves,
  getPioneerMoves,
} from "../raycast.js";

import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

describe("pioneer placement (開拓落子 / bridge step)", () => {
  it("pioneer_activates_when_no_standard_captures_exist", () => {
    const board = createEmptyBoard(16);
    // Player 1 at (5, 5), Player 2 far away at (12, 12)
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 12, 12, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Standard moves must be empty
    const standardMoves = getLegalMoves(state, 1);
    assert.strictEqual(standardMoves.length, 0);

    // Available moves should show Pioneer phase is active
    const available = getAvailableMoves(state, 1);
    assert.strictEqual(available.isPioneerActive, true);
    assert.strictEqual(available.standardMoves.length, 0);

    const pioneerMoves = getPioneerMoves(state, 1);
    assert.deepStrictEqual(available.pioneerMoves, pioneerMoves);

    // Chebyshev distance <= 2 forms a 5x5 square around (5, 5), minus the center (5, 5) = 24 cells
    assert.strictEqual(pioneerMoves.length, 24);

    // Every pioneer move must be within Chebyshev distance <= 2
    for (const coord of pioneerMoves) {
      const dist = Math.max(Math.abs(coord.x - 5), Math.abs(coord.y - 5));
      assert.ok(dist >= 1);
      assert.ok(dist <= 2);
    }

    // Cells outside distance 2 must NOT be included
    assert.ok(
      !pioneerMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 5, y: 8 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.ok(
      !pioneerMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 0, y: 0 });
          return true;
        } catch {
          return false;
        }
      }),
    );
  });

  it("pioneer_placement_succeeds_without_capture", () => {
    const board = createEmptyBoard(16);
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 12, 12, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Player 1 places at (5, 7), which is Chebyshev distance 2 from (5, 5)
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 7 },
      skillType: "NONE",
    });

    // Verify piece is placed on board
    assert.strictEqual(nextState.board[7]?.[5]?.teamId, 1);
    assert.strictEqual(nextState.board[7]?.[5]?.playerId, 1);

    // Turn advanced to Player 2
    assert.strictEqual(nextState.activePlayerId, 2);
    assert.strictEqual(nextState.currentTurn, 2);

    // Verify PIECE_PLACED and PIONEER_PLACED events were emitted
    const placedEvent = events.find((e) => e.type === "PIECE_PLACED");
    assert.notStrictEqual(placedEvent, undefined);

    const pioneerEvent = events.find((e) => e.type === "PIONEER_PLACED");
    assert.notStrictEqual(pioneerEvent, undefined);
    // consecutivePasses should be reset to 0
    assert.strictEqual(nextState.consecutivePasses, 0);
  });

  it("pioneer_placement_rejected_if_standard_capture_is_available", () => {
    const board = createEmptyBoard(16);
    // Standard sandwich setup: P1 at (5, 5), P2 at (5, 6). Placing at (5, 7) captures (5, 6).
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 6, 5, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Standard capture is available at (5, 7)
    const available = getAvailableMoves(state, 1);
    assert.strictEqual(available.isPioneerActive, false);
    assert.ok(
      available.standardMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 5, y: 7 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.strictEqual(available.pioneerMoves.length, 0);

    // Attempting a non-capturing move at (5, 4) (near (5, 5)) must be rejected
    assert.throws(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 5, y: 4 },
        skillType: "NONE",
      });
    }, new IllegalMoveError("Illegal move: must capture at least one piece"));
  });

  it("pioneer_bridging_enables_subsequent_captures", () => {
    const board = createEmptyBoard(16);
    // Island gap scenario across row y = 5:
    // (4, 5) = Team 1
    // (5, 5) = empty
    // (6, 5) = empty
    // (7, 5) = Team 2
    setCell(board, 5, 4, makePiece(1, 1, "NONE"));
    setCell(board, 5, 7, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Player 1 has 0 standard captures
    assert.strictEqual(getLegalMoves(state, 1).length, 0);

    // Player 1 bridges by placing a pioneer piece at (6, 5) (Chebyshev distance 2 from (4, 5))
    const { nextState: turn2State, events: p1Events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 6, y: 5 },
      skillType: "NONE",
    });

    assert.strictEqual(
      p1Events.some((e) => e.type === "PIONEER_PLACED"),
      true,
    );
    assert.strictEqual(turn2State.board[5]?.[6]?.teamId, 1);
    assert.strictEqual(turn2State.activePlayerId, 2);

    // Now on Player 2's turn:
    // Board has Team 1 at (6, 5) adjacent to Team 2 at (7, 5).
    // Placing at (5, 5) allows Player 2 to sandwich Team 1 at (6, 5) against (7, 5)!
    const p2LegalMoves = getLegalMoves(turn2State, 2);
    assert.ok(
      p2LegalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 5, y: 5 });
          return true;
        } catch {
          return false;
        }
      }),
    );

    const { nextState: turn3State, events: p2Events } = dispatch(turn2State, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 5, y: 5 },
      skillType: "NONE",
    });

    // Team 1's piece at (6, 5) was flipped to Team 2!
    assert.strictEqual(turn3State.board[5]?.[6]?.teamId, 2);

    const flipEvent = p2Events.find((e) => e.type === "FLIP_BATCH");
    assert.notStrictEqual(flipEvent, undefined);
    assert.strictEqual(flipEvent?.toTeamId, 2);
    assert.ok(
      flipEvent?.coords.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 6, y: 5 });
          return true;
        } catch {
          return false;
        }
      }),
    );
  });

  it("pioneer_with_special_skill_and_purify_pulse", () => {
    const board = createEmptyBoard(16);
    // Player 1 at (5, 5), Player 2 piece at (7, 6) (knight move: dx=2, dy=1, so no 8-dir line exists)
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 6, 7, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Verify no standard captures exist
    assert.strictEqual(getLegalMoves(state, 1).length, 0);

    // Player 1 places PURIFY as a pioneer piece at (6, 5) (distance 1 from (5, 5))
    // (6, 5) is also Chebyshev distance 1 from (7, 6) (which is at board[6][7])
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 6, y: 5 },
      skillType: "PURIFY",
    });

    // Hand deducted
    const p1 = nextState.players.find((p) => p.id === 1);
    assert.strictEqual(p1?.hand.PURIFY, Infinity); // In test state with infinite hand

    // Event sequence check
    assert.strictEqual(
      events.some((e) => e.type === "PIECE_PLACED"),
      true,
    );
    assert.strictEqual(
      events.some((e) => e.type === "PIONEER_PLACED"),
      true,
    );
    assert.strictEqual(
      events.some(
        (e) => e.type === "PIECE_REVEALED" && e.skillType === "PURIFY",
      ),
      true,
    );

    // PURIFY pulse activates at turn end, converting adjacent enemy at (7, 6)
    const pulseEvent = events.find((e) => e.type === "PURIFY_PULSE");
    assert.notStrictEqual(pulseEvent, undefined);
    assert.strictEqual(nextState.board[6]?.[7]?.teamId, 1);
  });

  it("pioneer_rejected_when_target_exceeds_distance_limit", () => {
    const board = createEmptyBoard(16);
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 12, 12, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Placing at (5, 8) has Chebyshev distance 3 from (5, 5) -> illegal pioneer move
    assert.throws(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 5, y: 8 },
        skillType: "NONE",
      });
    }, new IllegalMoveError("Illegal pioneer move: target must be within 2 tiles of friendly territory"));
  });

  it("pioneer_drop_phase_respects_drop_zone", () => {
    const board = createEmptyBoard(16);
    setCell(board, 4, 4, makePiece(1, 1, "NONE"));

    const state = makeTestState(board, 1);
    state.isDropPhase = true;
    state.dropTurnsRemaining = 4;
    const player1 = state.players.find((p) => p.id === 1);
    if (player1) {
      player1.dropZone = { center: { x: 4, y: 4 }, radius: 2 };
    }

    const pioneerMoves = getPioneerMoves(state, 1);
    // All pioneer moves must be within dropZone (Chebyshev distance <= 2 of center (4, 4))
    for (const c of pioneerMoves) {
      const dist = Math.max(Math.abs(c.x - 4), Math.abs(c.y - 4));
      assert.ok(dist <= 2);
    }

    // Target at (4, 7) is outside dropZone (radius 2)
    assert.throws(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 4, y: 7 },
        skillType: "NONE",
      });
    }, new IllegalMoveError("Placement outside assigned drop zone during Drop Phase"));
  });
});

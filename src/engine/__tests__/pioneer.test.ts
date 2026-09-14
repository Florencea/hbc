import { describe, expect, it } from "vitest";
import { IllegalMoveError } from "../map.ts";
import { dispatch } from "../pipeline.ts";
import {
  getAvailableMoves,
  getLegalMoves,
  getPioneerMoves,
} from "../raycast.ts";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.ts";

describe("pioneer placement (開拓落子 / bridge step)", () => {
  it("pioneer_activates_when_no_standard_captures_exist", () => {
    const board = createEmptyBoard(16);
    // Player 1 at (5, 5), Player 2 far away at (12, 12)
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 12, 12, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Standard moves must be empty
    const standardMoves = getLegalMoves(state, 1);
    expect(standardMoves).toHaveLength(0);

    // Available moves should show Pioneer phase is active
    const available = getAvailableMoves(state, 1);
    expect(available.isPioneerActive).toBe(true);
    expect(available.standardMoves).toHaveLength(0);

    const pioneerMoves = getPioneerMoves(state, 1);
    expect(available.pioneerMoves).toEqual(pioneerMoves);

    // Chebyshev distance <= 2 forms a 5x5 square around (5, 5), minus the center (5, 5) = 24 cells
    expect(pioneerMoves).toHaveLength(24);

    // Every pioneer move must be within Chebyshev distance <= 2
    for (const coord of pioneerMoves) {
      const dist = Math.max(Math.abs(coord.x - 5), Math.abs(coord.y - 5));
      expect(dist).toBeGreaterThanOrEqual(1);
      expect(dist).toBeLessThanOrEqual(2);
    }

    // Cells outside distance 2 must NOT be included
    expect(pioneerMoves).not.toContainEqual({ x: 5, y: 8 });
    expect(pioneerMoves).not.toContainEqual({ x: 0, y: 0 });
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
    expect(nextState.board[7]?.[5]?.teamId).toBe(1);
    expect(nextState.board[7]?.[5]?.playerId).toBe(1);

    // Turn advanced to Player 2
    expect(nextState.activePlayerId).toBe(2);
    expect(nextState.currentTurn).toBe(2);

    // Verify PIECE_PLACED and PIONEER_PLACED events were emitted
    const placedEvent = events.find((e) => e.type === "PIECE_PLACED");
    expect(placedEvent).toBeDefined();

    const pioneerEvent = events.find((e) => e.type === "PIONEER_PLACED");
    expect(pioneerEvent).toBeDefined();
    // consecutivePasses should be reset to 0
    expect(nextState.consecutivePasses).toBe(0);
  });

  it("pioneer_placement_rejected_if_standard_capture_is_available", () => {
    const board = createEmptyBoard(16);
    // Standard sandwich setup: P1 at (5, 5), P2 at (5, 6). Placing at (5, 7) captures (5, 6).
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 6, 5, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Standard capture is available at (5, 7)
    const available = getAvailableMoves(state, 1);
    expect(available.isPioneerActive).toBe(false);
    expect(available.standardMoves).toContainEqual({ x: 5, y: 7 });
    expect(available.pioneerMoves).toHaveLength(0);

    // Attempting a non-capturing move at (5, 4) (near (5, 5)) must be rejected
    expect(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 5, y: 4 },
        skillType: "NONE",
      });
    }).toThrow(
      new IllegalMoveError("Illegal move: must capture at least one piece"),
    );
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
    expect(getLegalMoves(state, 1)).toHaveLength(0);

    // Player 1 bridges by placing a pioneer piece at (6, 5) (Chebyshev distance 2 from (4, 5))
    const { nextState: turn2State, events: p1Events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 6, y: 5 },
      skillType: "NONE",
    });

    expect(p1Events.some((e) => e.type === "PIONEER_PLACED")).toBe(true);
    expect(turn2State.board[5]?.[6]?.teamId).toBe(1);
    expect(turn2State.activePlayerId).toBe(2);

    // Now on Player 2's turn:
    // Board has Team 1 at (6, 5) adjacent to Team 2 at (7, 5).
    // Placing at (5, 5) allows Player 2 to sandwich Team 1 at (6, 5) against (7, 5)!
    const p2LegalMoves = getLegalMoves(turn2State, 2);
    expect(p2LegalMoves).toContainEqual({ x: 5, y: 5 });

    const { nextState: turn3State, events: p2Events } = dispatch(turn2State, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 5, y: 5 },
      skillType: "NONE",
    });

    // Team 1's piece at (6, 5) was flipped to Team 2!
    expect(turn3State.board[5]?.[6]?.teamId).toBe(2);

    const flipEvent = p2Events.find((e) => e.type === "FLIP_BATCH");
    expect(flipEvent).toBeDefined();
    if (flipEvent?.type === "FLIP_BATCH") {
      expect(flipEvent.toTeamId).toBe(2);
      expect(flipEvent.coords).toContainEqual({ x: 6, y: 5 });
    }
  });

  it("pioneer_with_special_skill_and_purify_pulse", () => {
    const board = createEmptyBoard(16);
    // Player 1 at (5, 5), Player 2 piece at (7, 6) (knight move: dx=2, dy=1, so no 8-dir line exists)
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 6, 7, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Verify no standard captures exist
    expect(getLegalMoves(state, 1)).toHaveLength(0);

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
    expect(p1?.hand.PURIFY).toBe(Infinity); // In test state with infinite hand

    // Event sequence check
    expect(events.some((e) => e.type === "PIECE_PLACED")).toBe(true);
    expect(events.some((e) => e.type === "PIONEER_PLACED")).toBe(true);
    expect(
      events.some(
        (e) => e.type === "PIECE_REVEALED" && e.skillType === "PURIFY",
      ),
    ).toBe(true);

    // PURIFY pulse activates at turn end, converting adjacent enemy at (7, 6)
    const pulseEvent = events.find((e) => e.type === "PURIFY_PULSE");
    expect(pulseEvent).toBeDefined();
    expect(nextState.board[6]?.[7]?.teamId).toBe(1);
  });

  it("pioneer_rejected_when_target_exceeds_distance_limit", () => {
    const board = createEmptyBoard(16);
    setCell(board, 5, 5, makePiece(1, 1, "NONE"));
    setCell(board, 12, 12, makePiece(2, 2, "NONE"));

    const state = makeTestState(board, 1);

    // Placing at (5, 8) has Chebyshev distance 3 from (5, 5) -> illegal pioneer move
    expect(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 5, y: 8 },
        skillType: "NONE",
      });
    }).toThrow(
      new IllegalMoveError(
        "Illegal pioneer move: target must be within 2 tiles of friendly territory",
      ),
    );
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
      expect(dist).toBeLessThanOrEqual(2);
    }

    // Target at (4, 7) is outside dropZone (radius 2)
    expect(() => {
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 4, y: 7 },
        skillType: "NONE",
      });
    }).toThrow(
      new IllegalMoveError(
        "Placement outside assigned drop zone during Drop Phase",
      ),
    );
  });
});

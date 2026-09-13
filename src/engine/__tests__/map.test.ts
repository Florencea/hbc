import { describe, expect, it } from "vitest";
import { createEmptyBoard, makePiece, makeTestState } from "./helpers.ts";
import {
  createInitialGame,
  createInitialState,
  createNeutralPiece,
  dispatch,
  getDistance,
  getLegalMoves,
  IllegalMoveError,
  isWithinDropZone,
} from "../index.ts";

describe("Map Templates, Neutral Anchors & Drop Phase (map.test.ts)", () => {
  it("neutral_pieces_captured_by_any_team: Team 1 and Team 2 can sandwich neutral pieces and convert them", () => {
    const board = createEmptyBoard(16);
    // Team 1 test: Friendly at (2, 2), Neutral at (3, 2) & (4, 2)
    board[2][2] = makePiece(1, 1, "NONE");
    board[2][3] = createNeutralPiece();
    board[2][4] = createNeutralPiece();

    // Team 2 test: Friendly at (8, 8), Neutral at (8, 9)
    board[8][8] = makePiece(2, 2, "NONE");
    board[9][8] = createNeutralPiece();

    const state = makeTestState(board, 1);

    // Player 1 plays at (5, 2), sandwiching neutral pieces (3, 2) and (4, 2) against (2, 2)
    const res1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 2 },
      skillType: "NONE",
    });

    expect(res1.nextState.board[2]?.[3]?.teamId).toBe(1);
    expect(res1.nextState.board[2]?.[3]?.playerId).toBe(1);
    expect(res1.nextState.board[2]?.[4]?.teamId).toBe(1);
    expect(res1.nextState.board[2]?.[4]?.playerId).toBe(1);

    const flipEvent1 = res1.events.find((e) => e.type === "FLIP_BATCH");
    expect(flipEvent1).toBeDefined();
    if (flipEvent1?.type === "FLIP_BATCH") {
      expect(flipEvent1.toTeamId).toBe(1);
      expect(flipEvent1.fromTeamIds).toContain(0);
      expect(flipEvent1.coords).toEqual(
        expect.arrayContaining([
          { x: 3, y: 2 },
          { x: 4, y: 2 },
        ]),
      );
    }

    // Now active player is Player 2. Player 2 plays at (8, 10), sandwiching (8, 9) against (8, 8)
    const res2 = dispatch(res1.nextState, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 8, y: 10 },
      skillType: "NONE",
    });

    expect(res2.nextState.board[9]?.[8]?.teamId).toBe(2);
    expect(res2.nextState.board[9]?.[8]?.playerId).toBe(2);
  });

  it("drop_phase_restricts_out_of_bound_moves: Placing outside assigned drop zone throws IllegalMoveError", () => {
    const board = createEmptyBoard(16);
    // Player 1 anchor at (7, 7)
    board[7][7] = makePiece(1, 1, "NONE");
    board[7][6] = createNeutralPiece();

    // Far away pieces that would constitute a legal reversi capture if not in drop phase
    board[1][1] = makePiece(1, 1, "NONE");
    board[1][2] = makePiece(2, 2, "NONE");

    const state = makeTestState(board, 1);
    state.isDropPhase = true;
    state.dropTurnsRemaining = 4;
    state.players[0].dropZone = {
      center: { x: 7, y: 7 },
      radius: 2,
    };

    // (1, 3) would capture (1, 2) against (1, 1), but is far outside dropZone (center 7, 7 radius 2)
    const p1DropZone = state.players[0].dropZone;
    expect(p1DropZone).toBeDefined();
    expect(getDistance({ x: 3, y: 1 }, p1DropZone.center)).toBeGreaterThan(
      p1DropZone.radius,
    );

    expect(() =>
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 3, y: 1 },
        skillType: "NONE",
      }),
    ).toThrow(IllegalMoveError);

    expect(() =>
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 3, y: 1 },
        skillType: "NONE",
      }),
    ).toThrow("Placement outside assigned drop zone during Drop Phase");

    // Also verify getLegalMoves filters out coordinates outside the drop zone
    const legalMoves = getLegalMoves(state, 1);
    expect(legalMoves).not.toContainEqual({ x: 3, y: 1 });
    expect(legalMoves).toContainEqual({ x: 5, y: 7 }); // Captures (6, 7) against (7, 7)
  });

  it("drop_phase_allows_in_bound_moves: Placing within drop zone succeeds and captures neutral anchors", () => {
    const state = createInitialState(16, undefined, "CROSSROADS");
    expect(state.isDropPhase).toBe(true);
    expect(state.dropTurnsRemaining).toBe(4);

    const p1 = state.players[0];
    expect(p1.dropZone).toBeDefined();
    if (!p1.dropZone) {
      throw new Error("Drop zone not defined");
    }

    // In CROSSROADS, (7, 5) flanks neutral (7, 6) against friendly anchor (7, 7)
    const coord = { x: 7, y: 5 };
    expect(isWithinDropZone(coord, p1.dropZone)).toBe(true);

    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: p1.id,
      coord,
      skillType: "NONE",
    });

    expect(nextState.board[5]?.[7]?.teamId).toBe(p1.teamId);
    expect(nextState.board[6]?.[7]?.teamId).toBe(p1.teamId);
    expect(nextState.dropTurnsRemaining).toBe(3);
    expect(nextState.isDropPhase).toBe(true);

    const flip = events.find((e) => e.type === "FLIP_BATCH");
    expect(flip).toBeDefined();
    if (flip?.type === "FLIP_BATCH") {
      expect(flip.coords).toContainEqual({ x: 7, y: 6 });
    }
  });

  it("drop_phase_ends_after_turns_exhausted: isDropPhase switches to false and allows full-board placement", () => {
    const state = createInitialState(16);
    expect(state.isDropPhase).toBe(true);
    expect(state.dropTurnsRemaining).toBe(4);

    // Turn 1: Player 1 plays within drop zone at (8, 6)
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 8, y: 6 },
      skillType: "NONE",
    });
    expect(turn1.nextState.dropTurnsRemaining).toBe(3);
    expect(turn1.nextState.isDropPhase).toBe(true);

    // Turn 2: Player 2 passes turn
    const turn2 = dispatch(turn1.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    expect(turn2.nextState.dropTurnsRemaining).toBe(2);
    expect(turn2.nextState.isDropPhase).toBe(true);

    // Turn 3: Player 1 passes turn
    const turn3 = dispatch(turn2.nextState, {
      type: "PASS_TURN",
      playerId: 1,
    });
    expect(turn3.nextState.dropTurnsRemaining).toBe(1);
    expect(turn3.nextState.isDropPhase).toBe(true);

    // Turn 4: Player 2 passes turn (final drop turn!)
    const turn4 = dispatch(turn3.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    expect(turn4.nextState.dropTurnsRemaining).toBe(0);
    expect(turn4.nextState.isDropPhase).toBe(false);

    const dropEnded = turn4.events.find((e) => e.type === "DROP_PHASE_ENDED");
    expect(dropEnded).toBeDefined();

    // Turn 5: Set up a board opportunity outside initial drop zone
    // Player 1 can now legally place outside their initial drop zone
    turn4.nextState.board[1][1] = makePiece(1, 1, "NONE");
    turn4.nextState.board[1][2] = makePiece(2, 2, "NONE");

    const turn5 = dispatch(turn4.nextState, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 3, y: 1 },
      skillType: "NONE",
    });

    expect(turn5.nextState.board[1]?.[3]?.teamId).toBe(1);
    expect(turn5.nextState.board[1]?.[2]?.teamId).toBe(1);
  });

  it("archipelago_and_trenches_presets: Verify correct board generation for ARCHIPELAGO and TRENCHES presets", () => {
    // 1. ARCHIPELAGO preset
    const archState = createInitialState({
      mapPreset: "ARCHIPELAGO",
      boardSize: 16,
    });
    expect(archState.mapPreset).toBe("ARCHIPELAGO");

    // Count neutral pieces: 4 islands of 2x2 = 16 neutral pieces
    let neutralCount = 0;
    for (let y = 0; y < archState.size; y++) {
      for (let x = 0; x < archState.size; x++) {
        if (archState.board[y]?.[x]?.teamId === 0) {
          neutralCount++;
        }
      }
    }
    expect(neutralCount).toBe(16);

    // Check that every player has a dropZone containing at least one neutral piece
    for (const player of archState.players) {
      expect(player.dropZone).toBeDefined();
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
      expect(neutralsInZone).toBeGreaterThanOrEqual(1);
    }

    // Verify Player 1 has legal opening moves and can capture an archipelago anchor
    const archLegalMoves = getLegalMoves(archState, archState.activePlayerId);
    expect(archLegalMoves.length).toBeGreaterThan(0);
    const archMove = archLegalMoves[0];

    const archRes = dispatch(archState, {
      type: "PLACE_PIECE",
      playerId: archState.activePlayerId,
      coord: archMove,
      skillType: "NONE",
    });
    const archFlip = archRes.events.find((e) => e.type === "FLIP_BATCH");
    expect(archFlip).toBeDefined();
    if (archFlip?.type === "FLIP_BATCH") {
      expect(archFlip.fromTeamIds).toContain(0);
    }

    // 2. TRENCHES preset
    const trenchState = createInitialState({
      mapPreset: "TRENCHES",
      boardSize: 16,
    });
    expect(trenchState.mapPreset).toBe("TRENCHES");

    // Neutral pieces form intersecting paths along row 8 and col 8
    const mid = 8;
    expect(trenchState.board[mid]?.[4]?.teamId).toBe(0);
    expect(trenchState.board[4]?.[mid]?.teamId).toBe(0);

    // Every player has a dropZone containing neutral pieces
    for (const player of trenchState.players) {
      expect(player.dropZone).toBeDefined();
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
      expect(neutralsInZone).toBeGreaterThanOrEqual(1);
    }

    // Verify Player 1 has legal moves along the trench
    const trenchLegalMoves = getLegalMoves(
      trenchState,
      trenchState.activePlayerId,
    );
    expect(trenchLegalMoves.length).toBeGreaterThan(0);
    const trenchMove = trenchLegalMoves[0];

    const trenchRes = dispatch(trenchState, {
      type: "PLACE_PIECE",
      playerId: trenchState.activePlayerId,
      coord: trenchMove,
      skillType: "NONE",
    });
    const trenchFlip = trenchRes.events.find((e) => e.type === "FLIP_BATCH");
    expect(trenchFlip).toBeDefined();
    if (trenchFlip?.type === "FLIP_BATCH") {
      expect(trenchFlip.fromTeamIds).toContain(0);
    }
  });

  it("createInitialGame: initializes game with DROP_PHASE_STARTED event and player drop zones", () => {
    const { state, events } = createInitialGame({
      mapPreset: "CROSSROADS",
      boardSize: 16,
    });
    expect(state.mapPreset).toBe("CROSSROADS");
    expect(state.isDropPhase).toBe(true);

    const startEvent = events.find((e) => e.type === "DROP_PHASE_STARTED");
    expect(startEvent).toBeDefined();
    if (startEvent?.type === "DROP_PHASE_STARTED") {
      expect(startEvent.mapPreset).toBe("CROSSROADS");
      expect(startEvent.players).toHaveLength(2);
      expect(startEvent.players[0].dropZone.radius).toBe(3);
    }
  });
});

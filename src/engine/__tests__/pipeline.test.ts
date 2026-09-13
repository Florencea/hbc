import { describe, expect, it } from "vitest";
import { createEmptyBoard, makePiece, makeTestState } from "./helpers.ts";
import { createInitialState, dispatch } from "../pipeline.ts";

describe("pipeline", () => {
  it("initializes a standard center board", () => {
    const state = createInitialState(16);
    expect(state.size).toBe(16);
    expect(state.currentTurn).toBe(1);
    expect(state.board[7]?.[7]?.teamId).toBe(1);
    expect(state.board[7]?.[8]?.teamId).toBe(2);
    expect(state.board[8]?.[7]?.teamId).toBe(2);
    expect(state.board[8]?.[8]?.teamId).toBe(1);
  });

  it("handles standard piece placement, flip batch, and turn change", () => {
    const state = createInitialState(16);
    // Player 1 plays at (8, 6), which flanks (8, 7) [Team 2] against (8, 8) [Team 1]
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 8, y: 6 },
      skillType: "NONE",
    });

    expect(nextState.board[6]?.[8]?.teamId).toBe(1);
    expect(nextState.board[7]?.[8]?.teamId).toBe(1); // Flipped!
    expect(nextState.activePlayerId).toBe(2);
    expect(nextState.currentTurn).toBe(2);

    const placedEvent = events.find((e) => e.type === "PIECE_PLACED");
    expect(placedEvent).toBeDefined();

    const flipEvent = events.find((e) => e.type === "FLIP_BATCH");
    expect(flipEvent).toBeDefined();
    if (flipEvent?.type === "FLIP_BATCH") {
      expect(flipEvent.toTeamId).toBe(1);
      expect(flipEvent.coords).toContainEqual({ x: 8, y: 7 });
    }
  });

  it("Requirement 1: Raycast Blocking by WALL piece", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2)
    // Ray right: (3, 2) Team 2 NONE; (4, 2) Team 2 WALL (unrevealed); (5, 2) Team 1 NONE
    // Ray down: (2, 3) Team 2 NONE; (2, 4) Team 1 NONE (valid capture path)
    board[2][3] = makePiece(2, 2, "NONE");
    board[2][4] = makePiece(2, 2, "WALL", false);
    board[2][5] = makePiece(1, 1, "NONE");

    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // Wall at (4, 2) should be revealed
    expect(nextState.board[2]?.[4]?.isRevealed).toBe(true);
    // Piece at (3, 2) behind wall should NOT be flipped (still Team 2)
    expect(nextState.board[2]?.[3]?.teamId).toBe(2);

    // But downwards ray did capture (2, 3)
    expect(nextState.board[3]?.[2]?.teamId).toBe(1);

    // Verify events
    const blockedEvent = events.find((e) => e.type === "RAYCAST_BLOCKED");
    expect(blockedEvent).toBeDefined();
    if (blockedEvent?.type === "RAYCAST_BLOCKED") {
      expect(blockedEvent.coord).toEqual({ x: 4, y: 2 });
    }
  });

  it("Requirement 2: Pierce Penetration through a WALL", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2) using PIERCE
    // (3, 2) Team 2 WALL; (4, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "WALL", false);
    board[2][4] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    // Placed piece at (2, 2) is revealed as PIERCE
    expect(nextState.board[2]?.[2]?.isRevealed).toBe(true);
    expect(nextState.board[2]?.[2]?.skillType).toBe("PIERCE");

    // The WALL at (3, 2) is penetrated and flipped to Team 1
    expect(nextState.board[2]?.[3]?.teamId).toBe(1);

    const revealedEvent = events.find(
      (e) => e.type === "PIECE_REVEALED" && e.skillType === "PIERCE",
    );
    expect(revealedEvent).toBeDefined();
  });

  it("Requirement 3: Counter Trap reverses flip batch to defender faction", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2)
    // (3, 2) Team 2 NONE; (4, 2) Team 2 COUNTER (unrevealed); (5, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "NONE");
    board[2][4] = makePiece(2, 2, "COUNTER", false);
    board[2][5] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // The counter trap triggers and reverses the batch to Team 2!
    // (2, 2) newly placed was attacker, now converted to Team 2
    expect(nextState.board[2]?.[2]?.teamId).toBe(2);
    // (3, 2) remains Team 2
    expect(nextState.board[2]?.[3]?.teamId).toBe(2);
    // (4, 2) counter consumed and reverts to normal piece
    expect(nextState.board[2]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[2]?.[4]?.isRevealed).toBe(true);

    const counterEvent = events.find((e) => e.type === "COUNTER_TRIGGERED");
    expect(counterEvent).toBeDefined();
    if (counterEvent?.type === "COUNTER_TRIGGERED") {
      expect(counterEvent.defenderTeamId).toBe(2);
      expect(counterEvent.reversedCoords).toContainEqual({ x: 2, y: 2 });
    }
  });

  it("Requirement 4: Bomb Chain Reaction via Counter reversal hitting adjacent BOMB", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2)
    // (3, 2) Team 2 COUNTER; (4, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "COUNTER", false);
    board[2][4] = makePiece(1, 1, "NONE");

    // Adjacent to the COUNTER at (3, 2), place an unexploded BOMB belonging to Team 1 at (3, 3)
    board[3][3] = makePiece(1, 1, "BOMB", false);
    // Surrounding cell at (3, 4) Team 1 NONE
    board[4][3] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // COUNTER triggered -> chained into BOMB at (3, 3)
    const bombEvent = events.find((e) => e.type === "BOMB_TRIGGERED");
    expect(bombEvent).toBeDefined();
    if (bombEvent?.type === "BOMB_TRIGGERED") {
      expect(bombEvent.coord).toEqual({ x: 3, y: 3 });
    }

    // Bomb detonated -> reverted to NONE
    expect(nextState.board[3]?.[3]?.skillType).toBe("NONE");
    expect(nextState.board[3]?.[3]?.isRevealed).toBe(true);
  });

  it("Requirement 6: Purify Pulse aura converts 3x3 without triggering traps", () => {
    const board = createEmptyBoard(16);
    // Placed piece at (5, 5) PURIFY (Team 1)
    // Flanks (5, 6) [Team 2] against (5, 7) [Team 1]
    board[5][6] = makePiece(2, 2, "NONE");
    board[5][7] = makePiece(1, 1, "NONE");

    // Inside 3x3 of (5, 5), there is an enemy BOMB at (4, 4)
    board[4][4] = makePiece(2, 2, "BOMB", false);

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 5 },
      skillType: "PURIFY",
    });

    // PURIFY pulse event emitted
    const purifyEvent = events.find((e) => e.type === "PURIFY_PULSE");
    expect(purifyEvent).toBeDefined();

    // The enemy BOMB at (4, 4) was dissolved into Team 1 without triggering an explosion!
    expect(nextState.board[4]?.[4]?.teamId).toBe(1);
    expect(nextState.board[4]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[4]?.[4]?.isRevealed).toBe(true);

    // No BOMB_TRIGGERED event
    const bombEvent = events.find((e) => e.type === "BOMB_TRIGGERED");
    expect(bombEvent).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { createEmptyBoard, makePiece, makeTestState } from "./helpers.ts";
import { dispatch, resolveAction } from "../pipeline.ts";

describe("Skill Engine Specification Suite (skills.test.ts)", () => {
  it("wall_blocks_raycast_and_reveals: A hidden WALL stops non-pierce flip line; wall becomes isRevealed = true", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2)
    // Downward ray: valid capture (2, 3) [Team 2] against (2, 4) [Team 1]
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    // Rightward ray: hidden enemy WALL at (4, 2), Team 2 piece at (3, 2)
    board[2][4] = makePiece(2, 2, "WALL", false);
    board[2][3] = makePiece(2, 2, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // Wall at (4, 2) is revealed
    const wallPiece = nextState.board[2]?.[4];
    expect(wallPiece?.isRevealed).toBe(true);
    expect(wallPiece?.skillType).toBe("WALL");

    // Piece behind wall is not flipped (still Team 2)
    expect(nextState.board[2]?.[3]?.teamId).toBe(2);

    // Downward ray captured (2, 3)
    expect(nextState.board[3]?.[2]?.teamId).toBe(1);

    // Event assertions
    const blockedEvent = events.find((e) => e.type === "RAYCAST_BLOCKED");
    expect(blockedEvent).toBeDefined();

    const revealedEvent = events.find(
      (e) => e.type === "PIECE_REVEALED" && e.skillType === "WALL",
    );
    expect(revealedEvent).toBeDefined();
  });

  it("pierce_ignores_wall: PIERCE piece flips through a WALL, flips the wall, and PIERCE becomes revealed", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2) plays PIERCE
    // (3, 2) is Team 2 WALL (hidden); (4, 2) is Team 1 NONE
    board[2][3] = makePiece(2, 2, "WALL", false);
    board[2][4] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    // Placed PIERCE becomes revealed
    expect(nextState.board[2]?.[2]?.isRevealed).toBe(true);
    expect(nextState.board[2]?.[2]?.skillType).toBe("PIERCE");

    // The WALL at (3, 2) is penetrated and flipped to Team 1, reverting to NONE
    expect(nextState.board[2]?.[3]?.teamId).toBe(1);
    expect(nextState.board[2]?.[3]?.skillType).toBe("NONE");

    const revealedEvent = events.find(
      (e) => e.type === "PIECE_REVEALED" && e.skillType === "PIERCE",
    );
    expect(revealedEvent).toBeDefined();
  });

  it("pierce_immune_to_counter: PIERCE flips a hidden COUNTER without triggering backlash", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2) plays PIERCE
    // (3, 2) is Team 2 COUNTER (hidden); (4, 2) is Team 1 NONE
    board[2][3] = makePiece(2, 2, "COUNTER", false);
    board[2][4] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    // No COUNTER_TRIGGERED event
    const counterEvent = events.find((e) => e.type === "COUNTER_TRIGGERED");
    expect(counterEvent).toBeUndefined();

    // PIERCE piece remains Team 1
    expect(nextState.board[2]?.[2]?.teamId).toBe(1);
    expect(nextState.board[2]?.[2]?.skillType).toBe("PIERCE");
    expect(nextState.board[2]?.[2]?.isRevealed).toBe(true);

    // Counter piece at (3, 2) is flipped to Team 1 and reverts to NONE
    expect(nextState.board[2]?.[3]?.teamId).toBe(1);
    expect(nextState.board[2]?.[3]?.skillType).toBe("NONE");
  });

  it("counter_hijacks_flip_line: Normal piece flipping a COUNTER causes the entire line to turn into the defender's faction", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2) plays NONE
    // (3, 2) Team 2 NONE; (4, 2) Team 2 COUNTER (hidden); (5, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "NONE");
    board[2][4] = makePiece(2, 2, "COUNTER", false);
    board[2][5] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // Counter triggers and hijacks entire flip line + placed piece to Team 2
    expect(nextState.board[2]?.[2]?.teamId).toBe(2);
    expect(nextState.board[2]?.[3]?.teamId).toBe(2);
    expect(nextState.board[2]?.[4]?.teamId).toBe(2);

    // Counter consumed to NONE
    expect(nextState.board[2]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[2]?.[4]?.isRevealed).toBe(true);

    const counterEvent = events.find((e) => e.type === "COUNTER_TRIGGERED");
    expect(counterEvent).toBeDefined();
    if (counterEvent?.type === "COUNTER_TRIGGERED") {
      expect(counterEvent.defenderTeamId).toBe(2);
    }
  });

  it("counter_triggers_bomb_chain: COUNTER backlash engulfs an adjacent BOMB -> triggers 3x3 explosion", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2)
    // (3, 2) Team 2 COUNTER (hidden); (4, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "COUNTER", false);
    board[2][4] = makePiece(1, 1, "NONE");

    // Adjacent to the COUNTER at (3, 2), place an unexploded BOMB belonging to Team 1 at (3, 3)
    board[3][3] = makePiece(1, 1, "BOMB", false);
    // Surrounding cell at (3, 4) Team 1 NONE
    board[4][3] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    const counterEvent = events.find((e) => e.type === "COUNTER_TRIGGERED");
    expect(counterEvent).toBeDefined();

    const bombEvent = events.find((e) => e.type === "BOMB_TRIGGERED");
    expect(bombEvent).toBeDefined();

    // The BOMB detonated and converted to Team 2 normal piece
    expect(nextState.board[3]?.[3]?.skillType).toBe("NONE");
    expect(nextState.board[3]?.[3]?.isRevealed).toBe(true);
    expect(nextState.board[3]?.[3]?.teamId).toBe(2);

    // Surrounding cell at (3, 4) converted to Team 2
    expect(nextState.board[4]?.[3]?.teamId).toBe(2);
  });

  it("bomb_chains_bomb: BOMB 3x3 blast hits second BOMB -> triggers second 3x3 blast sequentially", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 2 at (2, 2)
    // (3, 2) is Team 1 BOMB (hidden); (4, 2) is Team 2 NONE
    board[2][3] = makePiece(1, 1, "BOMB", false);
    board[2][4] = makePiece(2, 2, "NONE");

    // Inside 3x3 blast of BOMB 1, place BOMB 2 at (4, 3) [Team 1 BOMB]
    board[3][4] = makePiece(1, 1, "BOMB", false);
    // Inside 3x3 blast of BOMB 2, place another piece at (5, 4) [Team 2 NONE]
    board[4][5] = makePiece(2, 2, "NONE");

    const state = makeTestState(board, 2);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // Both bombs should trigger sequentially
    const bombEvents = events.filter((e) => e.type === "BOMB_TRIGGERED");
    expect(bombEvents.length).toBe(2);

    // First bomb triggered at (3, 2) for Team 1
    expect(bombEvents[0]?.coord).toEqual({ x: 3, y: 2 });
    expect(bombEvents[0]?.teamId).toBe(1);

    // Second bomb triggered at (4, 3) for Team 1
    expect(bombEvents[1]?.coord).toEqual({ x: 4, y: 3 });
    expect(bombEvents[1]?.teamId).toBe(1);

    // Both bombs consumed to NONE and belong to Team 1
    expect(nextState.board[2]?.[3]?.skillType).toBe("NONE");
    expect(nextState.board[2]?.[3]?.teamId).toBe(1);

    expect(nextState.board[3]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[3]?.[4]?.teamId).toBe(1);

    // Placed piece of Team 2 at (2, 2) caught in BOMB 1 blast converted to Team 1
    expect(nextState.board[2]?.[2]?.teamId).toBe(1);

    // Piece at (5, 4) hit by second bomb converted to Team 1
    expect(nextState.board[4]?.[5]?.teamId).toBe(1);
  });

  it("purify_silent_conversion: PURIFY pulses 3x3 containing a BOMB and a COUNTER -> both convert quietly without exploding or counter-attacking", () => {
    const board = createEmptyBoard(16);
    // Placed piece at (5, 5) PURIFY (Team 1)
    // Flanks (5, 6) [Team 2] against (5, 7) [Team 1]
    board[5][6] = makePiece(2, 2, "NONE");
    board[5][7] = makePiece(1, 1, "NONE");

    // Inside 3x3 of (5, 5):
    // Enemy BOMB at (4, 4)
    board[4][4] = makePiece(2, 2, "BOMB", false);
    // Enemy COUNTER at (4, 5)
    board[5][4] = makePiece(2, 2, "COUNTER", false);

    const state = makeTestState(board, 1);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 5 },
      skillType: "PURIFY",
    });

    // PURIFY pulse event emitted
    const purifyEvent = events.find((e) => e.type === "PURIFY_PULSE");
    expect(purifyEvent).toBeDefined();

    // Neither BOMB nor COUNTER triggered
    expect(events.find((e) => e.type === "BOMB_TRIGGERED")).toBeUndefined();
    expect(events.find((e) => e.type === "COUNTER_TRIGGERED")).toBeUndefined();

    // Both quietly converted to Team 1 and neutralized to NONE
    expect(nextState.board[4]?.[4]?.teamId).toBe(1);
    expect(nextState.board[4]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[4]?.[4]?.isRevealed).toBe(true);

    expect(nextState.board[5]?.[4]?.teamId).toBe(1);
    expect(nextState.board[5]?.[4]?.skillType).toBe("NONE");
    expect(nextState.board[5]?.[4]?.isRevealed).toBe(true);
  });

  it("purify_dissolves_after_duration: PURIFY self-dissolves to normal piece after 3 turns", () => {
    const board = createEmptyBoard(16);
    // Placed piece at (5, 5) PURIFY (Team 1)
    // Flanks (5, 6) [Team 2] against (5, 7) [Team 1]
    board[5][6] = makePiece(2, 2, "NONE");
    board[5][7] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);

    // Turn 1: Player 1 places PURIFY
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 5 },
      skillType: "PURIFY",
    });
    // Turn 1 upkeep applied: remaining duration 2
    expect(turn1.nextState.board[5]?.[5]?.skillType).toBe("PURIFY");
    expect(turn1.nextState.board[5]?.[5]?.duration).toBe(2);

    // Turn 2: Player 2 passes
    const turn2 = dispatch(turn1.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    // Turn 2 upkeep applied: remaining duration 1
    expect(turn2.nextState.board[5]?.[5]?.skillType).toBe("PURIFY");
    expect(turn2.nextState.board[5]?.[5]?.duration).toBe(1);

    // Turn 3: Player 1 passes
    const turn3 = dispatch(turn2.nextState, {
      type: "PASS_TURN",
      playerId: 1,
    });
    // Turn 3 upkeep applied: duration <= 0, self-dissolves to NONE
    expect(turn3.nextState.board[5]?.[5]?.skillType).toBe("NONE");
  });

  it("user_scenario_team1_bomb_triggers_for_team1_when_flipped_by_team2: When Team 2 flips Team 1's BOMB at (9, 7), it explodes for Team 1", () => {
    const board = createEmptyBoard(16);
    // Setup exact board state from user's event log:
    // (8, 7) Team 1 NONE
    board[7][8] = makePiece(1, 1, "NONE");
    // (9, 7) Team 1 BOMB (unrevealed)
    board[7][9] = makePiece(1, 1, "BOMB", false);
    // (9, 8) Team 2 NONE
    board[8][9] = makePiece(2, 2, "NONE");
    // (8, 8) Team 2 NONE
    board[8][8] = makePiece(2, 2, "NONE");

    // Player 2 plays at (9, 6), which flanks (9, 7) [Team 1 BOMB] against (9, 8) [Team 2]
    const state = makeTestState(board, 2);
    const { nextState, events } = resolveAction(state, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 9, y: 6 },
      skillType: "NONE",
    });

    const bombEvent = events.find((e) => e.type === "BOMB_TRIGGERED");
    expect(bombEvent).toBeDefined();

    // The BOMB at (9, 7) belonged to Team 1, so it must detonate FOR Team 1
    if (bombEvent?.type === "BOMB_TRIGGERED") {
      expect(bombEvent.coord).toEqual({ x: 9, y: 7 });
      expect(bombEvent.teamId).toBe(1);
      expect(bombEvent.factionId).toBe(1);
    }

    // Surrounding pieces in 3x3 of (9, 7) converted to Team 1:
    // Placed piece (9, 6) converted to Team 1
    expect(nextState.board[6]?.[9]?.teamId).toBe(1);
    // (9, 7) BOMB itself consumed to NONE and is Team 1
    expect(nextState.board[7]?.[9]?.teamId).toBe(1);
    expect(nextState.board[7]?.[9]?.skillType).toBe("NONE");
    // (8, 7) remains Team 1
    expect(nextState.board[7]?.[8]?.teamId).toBe(1);
    // (9, 8) converted to Team 1
    expect(nextState.board[8]?.[9]?.teamId).toBe(1);
    // (8, 8) converted to Team 1
    expect(nextState.board[8]?.[8]?.teamId).toBe(1);
  });

  it("wall_penetrated_by_pierce_reverts_to_none_and_does_not_block_later: WALL penetrated by PIERCE becomes NONE and no longer blocks raycasts", () => {
    const board = createEmptyBoard(16);
    // (2, 1) Team 2 NONE anchor
    board[1][2] = makePiece(2, 2, "NONE");
    // (2, 3) Team 2 WALL, (2, 4) Team 1 NONE
    board[3][2] = makePiece(2, 2, "WALL", false);
    board[4][2] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    // Turn 1: Player 1 plays PIERCE at (2, 2)
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    // (2, 3) was WALL, now flipped to Team 1 and reverted to NONE
    expect(turn1.nextState.board[3]?.[2]?.teamId).toBe(1);
    expect(turn1.nextState.board[3]?.[2]?.skillType).toBe("NONE");

    // Turn 2: Player 2 plays at (2, 5). Path upward through (2, 4) [Team 1], (2, 3) [Team 1], (2, 2) [Team 1] against (2, 1) [Team 2]
    // Since (2, 3) is now NONE, raycast from (2, 5) to (2, 1) is NOT blocked
    const turn2 = dispatch(turn1.nextState, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 2, y: 5 },
      skillType: "NONE",
    });

    // Both (2, 4), (2, 3) and (2, 2) are captured by Team 2
    expect(turn2.nextState.board[4]?.[2]?.teamId).toBe(2);
    expect(turn2.nextState.board[3]?.[2]?.teamId).toBe(2);
    expect(turn2.nextState.board[2]?.[2]?.teamId).toBe(2);
    expect(
      turn2.events.find((e) => e.type === "RAYCAST_BLOCKED"),
    ).toBeUndefined();
  });

  it("counter_bypassed_by_pierce_reverts_to_none_and_does_not_counter_later: COUNTER bypassed by PIERCE becomes NONE and does not trigger on next flip", () => {
    const board = createEmptyBoard(16);
    // (2, 1) Team 2 NONE anchor
    board[1][2] = makePiece(2, 2, "NONE");
    // (2, 3) Team 2 COUNTER, (2, 4) Team 1 NONE
    board[3][2] = makePiece(2, 2, "COUNTER", false);
    board[4][2] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    // Turn 1: Player 1 plays PIERCE at (2, 2)
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    // COUNTER was bypassed and converted to Team 1 NONE
    expect(turn1.nextState.board[3]?.[2]?.teamId).toBe(1);
    expect(turn1.nextState.board[3]?.[2]?.skillType).toBe("NONE");

    // Turn 2: Player 2 plays at (2, 5), sandwiching (2, 4), (2, 3), and (2, 2) against (2, 1)
    const turn2 = dispatch(turn1.nextState, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 2, y: 5 },
      skillType: "NONE",
    });

    // Normal flip, COUNTER does not trigger
    expect(
      turn2.events.find((e) => e.type === "COUNTER_TRIGGERED"),
    ).toBeUndefined();
    expect(turn2.nextState.board[3]?.[2]?.teamId).toBe(2);
  });

  it("purify_clears_duration_and_reverts_to_none_when_flipped: PURIFY flipped by sandwiching clears duration and stops pulsing", () => {
    const board = createEmptyBoard(16);
    // (2, 3) Team 2 PURIFY (duration = 3), (2, 4) Team 1 NONE
    board[3][2] = { ...makePiece(2, 2, "PURIFY", true), duration: 3 };
    board[4][2] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // (2, 3) flipped to Team 1, skillType becomes NONE, duration cleared
    expect(nextState.board[3]?.[2]?.teamId).toBe(1);
    expect(nextState.board[3]?.[2]?.skillType).toBe("NONE");
    expect(nextState.board[3]?.[2]?.duration).toBeUndefined();

    // No PURIFY_PULSE emitted from (2, 3)
    const purifyPulse = events.find(
      (e) => e.type === "PURIFY_PULSE" && e.coord.x === 2 && e.coord.y === 3,
    );
    expect(purifyPulse).toBeUndefined();
  });

  it("pierce_reverts_to_none_when_flipped_by_normal_piece: PIERCE flipped by raycast reverts to standard piece", () => {
    const board = createEmptyBoard(16);
    // (2, 3) Team 2 PIERCE, (2, 4) Team 1 NONE
    board[3][2] = makePiece(2, 2, "PIERCE", true);
    board[4][2] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    // (2, 3) flipped to Team 1 and reverts to NONE
    expect(nextState.board[3]?.[2]?.teamId).toBe(1);
    expect(nextState.board[3]?.[2]?.skillType).toBe("NONE");
  });

  it("counter_backlash_pierce_immunity: PIERCE piece is immune to COUNTER backlash reversal stream", () => {
    const board = createEmptyBoard(16);
    // Attacker Team 1 at (2, 2) plays NONE
    // Line: (3, 2) Team 2 PIERCE; (4, 2) Team 2 COUNTER; (5, 2) Team 1 NONE
    board[2][3] = makePiece(2, 2, "PIERCE", false);
    board[2][4] = makePiece(2, 2, "COUNTER", false);
    board[2][5] = makePiece(1, 1, "NONE");

    const state = makeTestState(board, 1);
    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    const counterEvent = events.find((e) => e.type === "COUNTER_TRIGGERED");
    expect(counterEvent).toBeDefined();

    // Placed piece at (2, 2) hijacked by defender Team 2
    expect(nextState.board[2]?.[2]?.teamId).toBe(2);

    // PIERCE piece at (3, 2) is IMMUNE to backlash: retains Team 2, skillType PIERCE, and becomes revealed
    expect(nextState.board[2]?.[3]?.teamId).toBe(2);
    expect(nextState.board[2]?.[3]?.skillType).toBe("PIERCE");
    expect(nextState.board[2]?.[3]?.isRevealed).toBe(true);

    // COUNTER at (4, 2) consumed to NONE
    expect(nextState.board[2]?.[4]?.skillType).toBe("NONE");
  });

  it("purify_pulse_retains_wall_skill_on_conversion: PURIFY converts enemy WALL faction without clearing WALL skill", () => {
    const board = createEmptyBoard(16);
    // Flanking line for Player 1 PURIFY at (5, 5): (5, 6) Team 2 NONE, (5, 7) Team 1 NONE
    board[5][6] = makePiece(2, 2, "NONE");
    board[5][7] = makePiece(1, 1, "NONE");

    // Adjacent at (4, 5): Team 2 WALL
    board[5][4] = makePiece(2, 2, "WALL", false);

    const state = makeTestState(board, 1);
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 5 },
      skillType: "PURIFY",
    });

    // PURIFY pulse converts (4, 5) to Team 1, but retains WALL skill and reveals it
    expect(turn1.nextState.board[5]?.[4]?.teamId).toBe(1);
    expect(turn1.nextState.board[5]?.[4]?.skillType).toBe("WALL");
    expect(turn1.nextState.board[5]?.[4]?.isRevealed).toBe(true);

    // Turn 2: Player 2 plays at (3, 5).
    // Setup rightward ray obstacle: (4, 5) is Team 1 WALL, (5, 5) is Team 1, (6, 5) is Team 2 NONE.
    turn1.nextState.board[5][6] = makePiece(2, 2, "NONE");
    // Setup downward legal capture for Player 2 at (3, 5):
    // (3, 6) Team 1 NONE, (3, 7) Team 2 NONE
    turn1.nextState.board[6][3] = makePiece(1, 1, "NONE");
    turn1.nextState.board[7][3] = makePiece(2, 2, "NONE");

    // Player 2 plays at (3, 5). Downward ray captures (3, 6). Rightward ray is BLOCKED by (4, 5) WALL!
    const turn2 = dispatch(turn1.nextState, {
      type: "PLACE_PIECE",
      playerId: 2,
      coord: { x: 3, y: 5 },
      skillType: "NONE",
    });

    // Downward piece (3, 6) is captured to Team 2
    expect(turn2.nextState.board[6]?.[3]?.teamId).toBe(2);

    // Rightward ray was blocked by WALL at (4, 5)
    const blockedEvent = turn2.events.find(
      (e) => e.type === "RAYCAST_BLOCKED" && e.coord.x === 4 && e.coord.y === 5,
    );
    expect(blockedEvent).toBeDefined();

    // Piece behind wall (5, 5) was NOT captured (remains Team 1)
    expect(turn2.nextState.board[5]?.[5]?.teamId).toBe(1);
  });

  it("purify_pulse_retains_purify_skill_on_conversion: PURIFY assimilates enemy PURIFY without clearing PURIFY skill", () => {
    const board = createEmptyBoard(16);
    // Flanking line for Player 1 PURIFY at (5, 5): (5, 6) Team 2 NONE, (5, 7) Team 1 NONE
    board[5][6] = makePiece(2, 2, "NONE");
    board[5][7] = makePiece(1, 1, "NONE");

    // Adjacent at (4, 5): Team 2 PURIFY
    board[5][4] = { ...makePiece(2, 2, "PURIFY", true), duration: 2 };

    const state = makeTestState(board, 1);
    const turn1 = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 5, y: 5 },
      skillType: "PURIFY",
    });

    // Converted to Team 1, retains PURIFY skill
    expect(turn1.nextState.board[5]?.[4]?.teamId).toBe(1);
    expect(turn1.nextState.board[5]?.[4]?.skillType).toBe("PURIFY");
  });
});

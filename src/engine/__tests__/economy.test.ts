import { describe, expect, it } from "vitest";
import { dispatch } from "../pipeline.ts";
import { sanitizeForViewer } from "../sanitize.ts";
import {
  SKILL_SPECS,
  type Board,
  type GameState,
  type Player,
} from "../types.ts";
import { createEmptyBoard, makePiece } from "./helpers.ts";

function createEconomyPlayer(
  id: number,
  teamId: number,
  name: string,
  overrides?: Partial<Player>,
): Player {
  return {
    id,
    teamId,
    name,
    hand: {
      NONE: Infinity,
      WALL: 0,
      PIERCE: 0,
      BOMB: 0,
      PURIFY: 0,
      COUNTER: 0,
      ...overrides?.hand,
    },
    charge: {
      NONE: 0,
      WALL: 0,
      PIERCE: 0,
      BOMB: 0,
      PURIFY: 0,
      COUNTER: 0,
      ...overrides?.charge,
    },
    isForcedSpecial: overrides?.isForcedSpecial ?? false,
  };
}

function makeEconomyTestState(
  board: Board,
  players: Player[],
  activePlayerId = 1,
): GameState {
  return {
    board,
    size: 16,
    currentTurn: 1,
    activePlayerId,
    players,
    isGameOver: false,
    winnerTeamId: null,
    mapPreset: "CROSSROADS",
    isDropPhase: false,
    dropTurnsRemaining: 0,
  };
}

describe("Economy Engine Suite (economy.test.ts)", () => {
  it("cannot_play_skill_without_hand_stock: Throws error when playing a skill with count 0", () => {
    const board = createEmptyBoard(16);
    // Standard capture setup: (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
      }),
      createEconomyPlayer(2, 2, "Player 2"),
    ];

    const state = makeEconomyTestState(board, players, 1);

    expect(() =>
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 2, y: 2 },
        skillType: "WALL",
      }),
    ).toThrow("Player does not have this skill in hand");
  });

  it("playing_skill_decrements_hand_stock: Placing a skill reduces hand count by 1", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 2,
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
      }),
      createEconomyPlayer(2, 2, "Player 2"),
    ];

    const state = makeEconomyTestState(board, players, 1);

    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "WALL",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    expect(player1After?.hand.WALL).toBe(1);

    // Ensure pure state transitions: original state remains untouched
    expect(state.players[0]?.hand.WALL).toBe(2);
  });

  it("cooldown_increments_and_grants_skill: Accumulating charges grants a skill and resets charge counter", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    // PIERCE has CD = 2, maxHand = 3
    // Set charge to 1 so that after 1 move it reaches CD (2)
    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        charge: { NONE: 0, WALL: 0, PIERCE: 1, BOMB: 0, PURIFY: 0, COUNTER: 0 },
      }),
      createEconomyPlayer(2, 2, "Player 2"),
    ];

    const state = makeEconomyTestState(board, players, 1);

    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    expect(player1After?.hand.PIERCE).toBe(1);
    expect(player1After?.charge.PIERCE).toBe(0);

    const acquiredEvent = events.find(
      (e) => e.type === "SKILL_ACQUIRED" && e.skillType === "PIERCE",
    );
    expect(acquiredEvent).toBeDefined();
    if (acquiredEvent?.type === "SKILL_ACQUIRED") {
      expect(acquiredEvent.playerId).toBe(1);
      expect(acquiredEvent.skillType).toBe("PIERCE");
      expect(acquiredEvent.currentHandCount).toBe(1);
    }
  });

  it("forced_discharge_triggers_on_cap_overflow: Reaching cap and completing CD enforces isForcedSpecial: true", () => {
    const board = createEmptyBoard(16);
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    // BOMB: CD = 2, maxHand = 3
    // Hand is already capped at 3, charge is at 1 (1 turn away from CD)
    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: 0,
          BOMB: SKILL_SPECS.BOMB.maxHand,
          PURIFY: 0,
          COUNTER: 0,
        },
        charge: {
          NONE: 0,
          WALL: 0,
          PIERCE: 0,
          BOMB: SKILL_SPECS.BOMB.cd - 1,
          PURIFY: 0,
          COUNTER: 0,
        },
      }),
      createEconomyPlayer(2, 2, "Player 2"),
    ];

    const state = makeEconomyTestState(board, players, 1);

    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    expect(player1After?.isForcedSpecial).toBe(true);

    const forcedEvent = events.find(
      (e) => e.type === "FORCED_SPECIAL_TRIGGERED",
    );
    expect(forcedEvent).toBeDefined();
    if (forcedEvent?.type === "FORCED_SPECIAL_TRIGGERED") {
      expect(forcedEvent.playerId).toBe(1);
    }
  });

  it("forced_discharge_rejects_none_placement: When isForcedSpecial: true, playing NONE throws an error", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    board[3][2] = makePiece(2, 2, "NONE");
    board[4][2] = makePiece(1, 1, "NONE");

    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: 0,
          BOMB: 1,
          PURIFY: 0,
          COUNTER: 0,
        },
        isForcedSpecial: true,
      }),
      createEconomyPlayer(2, 2, "Player 2"),
    ];

    const state = makeEconomyTestState(board, players, 1);

    // Playing NONE explicitly
    expect(() =>
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 2, y: 2 },
        skillType: "NONE",
      }),
    ).toThrow("Forced special move required: hand cap reached");

    // Playing with omitted skillType (defaults to NONE)
    expect(() =>
      dispatch(state, {
        type: "PLACE_PIECE",
        playerId: 1,
        coord: { x: 2, y: 2 },
      }),
    ).toThrow("Forced special move required: hand cap reached");

    // Playing with special piece from hand succeeds and clears isForcedSpecial
    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "BOMB",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    expect(player1After?.isForcedSpecial).toBe(false);
    expect(player1After?.hand.BOMB).toBe(0);
  });

  it("sanitize_masks_opponent_economy: Opponent hand, charges, and forced flag are completely hidden from opponent view, but visible to allies", () => {
    const board = createEmptyBoard(16);

    const players = [
      createEconomyPlayer(1, 1, "Player 1 (Viewer)", {
        hand: {
          NONE: Infinity,
          WALL: 1,
          PIERCE: 2,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        charge: { NONE: 0, WALL: 1, PIERCE: 0, BOMB: 1, PURIFY: 2, COUNTER: 3 },
        isForcedSpecial: false,
      }),
      createEconomyPlayer(2, 2, "Player 2 (Opponent)", {
        hand: {
          NONE: Infinity,
          WALL: 2,
          PIERCE: 1,
          BOMB: 3,
          PURIFY: 1,
          COUNTER: 1,
        },
        charge: { NONE: 0, WALL: 2, PIERCE: 1, BOMB: 2, PURIFY: 3, COUNTER: 4 },
        isForcedSpecial: true,
      }),
      createEconomyPlayer(3, 1, "Player 3 (Teammate of P1)", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: 3,
          BOMB: 1,
          PURIFY: 2,
          COUNTER: 0,
        },
        charge: { NONE: 0, WALL: 2, PIERCE: 1, BOMB: 0, PURIFY: 1, COUNTER: 2 },
        isForcedSpecial: true,
      }),
    ];

    const state = makeEconomyTestState(board, players, 1);

    // Sanitize from Player 1's perspective (Team 1)
    const sanitized = sanitizeForViewer(state, 1);

    const viewerSelf = sanitized.players.find((p) => p.id === 1);
    expect(viewerSelf?.hand.WALL).toBe(1);
    expect(viewerSelf?.charge.PURIFY).toBe(2);

    // Opponent (Player 2, Team 2) must have hand, charges, and isForcedSpecial masked
    const opponent = sanitized.players.find((p) => p.id === 2);
    expect(opponent?.isForcedSpecial).toBe(false);
    expect(opponent?.hand.NONE).toBe(0);
    expect(opponent?.hand.WALL).toBe(0);
    expect(opponent?.hand.PIERCE).toBe(0);
    expect(opponent?.hand.BOMB).toBe(0);
    expect(opponent?.hand.PURIFY).toBe(0);
    expect(opponent?.hand.COUNTER).toBe(0);
    expect(opponent?.charge.NONE).toBe(0);
    expect(opponent?.charge.WALL).toBe(0);
    expect(opponent?.charge.PIERCE).toBe(0);
    expect(opponent?.charge.BOMB).toBe(0);
    expect(opponent?.charge.PURIFY).toBe(0);
    expect(opponent?.charge.COUNTER).toBe(0);

    // Teammate (Player 3, Team 1) must be completely visible to Player 1
    const teammate = sanitized.players.find((p) => p.id === 3);
    expect(teammate?.isForcedSpecial).toBe(true);
    expect(teammate?.hand.PIERCE).toBe(3);
    expect(teammate?.hand.BOMB).toBe(1);
    expect(teammate?.charge.WALL).toBe(2);
  });
});

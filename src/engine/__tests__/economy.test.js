import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dispatch } from "../pipeline.js";
import { sanitizeForViewer } from "../sanitize.js";
import { SKILL_SPECS } from "../constants.js";
import { createEmptyBoard, makePiece, setCell } from "./helpers.js";

function createEconomyPlayer(id, teamId, name, overrides) {
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

function makeEconomyTestState(board, players, activePlayerId = 1) {
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
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

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

    assert.throws(
      () =>
        dispatch(state, {
          type: "PLACE_PIECE",
          playerId: 1,
          coord: { x: 2, y: 2 },
          skillType: "WALL",
        }),
      /Player does not have this skill in hand/,
    );
  });

  it("playing_skill_decrements_hand_stock: Placing a skill reduces hand count by 1", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

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
    assert.strictEqual(player1After?.hand.WALL, 1);

    // Ensure pure state transitions: original state remains untouched
    assert.strictEqual(state.players[0]?.hand.WALL, 2);
  });

  it("cooldown_increments_and_grants_skill: Accumulating charges grants a skill and resets charge counter", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

    // PIERCE has CD = 3, maxHand = 2
    // Set charge to 2 (cd - 1) so that after 1 move it reaches CD (3)
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
        charge: {
          NONE: 0,
          WALL: 0,
          PIERCE: SKILL_SPECS.PIERCE.cd - 1,
          BOMB: 0,
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
    assert.strictEqual(player1After?.hand.PIERCE, 1);
    assert.strictEqual(player1After?.charge.PIERCE, 0);

    const acquiredEvent = events.find(
      (e) => e.type === "SKILL_ACQUIRED" && e.skillType === "PIERCE",
    );
    assert.notStrictEqual(acquiredEvent, undefined);
    assert.strictEqual(acquiredEvent?.playerId, 1);
    assert.strictEqual(acquiredEvent?.skillType, "PIERCE");
    assert.strictEqual(acquiredEvent?.currentHandCount, 1);
  });

  it("forced_discharge_triggers_on_cap_overflow: Reaching cap and completing CD enforces isForcedSpecial: true", () => {
    const board = createEmptyBoard(16);
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

    // All skills at maxHand except BOMB which is at maxHand - 1 with charge at cd - 1
    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: SKILL_SPECS.WALL.maxHand,
          PIERCE: SKILL_SPECS.PIERCE.maxHand,
          BOMB: SKILL_SPECS.BOMB.maxHand - 1,
          PURIFY: SKILL_SPECS.PURIFY.maxHand,
          COUNTER: SKILL_SPECS.COUNTER.maxHand,
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
    assert.strictEqual(player1After?.hand.BOMB, SKILL_SPECS.BOMB.maxHand);
    assert.strictEqual(player1After?.charge.BOMB, 0);
    assert.strictEqual(player1After?.isForcedSpecial, true);

    const forcedEvent = events.find(
      (e) => e.type === "FORCED_SPECIAL_TRIGGERED",
    );
    assert.notStrictEqual(forcedEvent, undefined);
    assert.strictEqual(forcedEvent?.playerId, 1);
  });

  it("forced_discharge_rejects_none_placement: When isForcedSpecial: true, playing NONE throws an error", () => {
    const board = createEmptyBoard(16);
    // (2, 2) [Team 1] captures (2, 3) [Team 2] against (2, 4) [Team 1]
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

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
    assert.throws(
      () =>
        dispatch(state, {
          type: "PLACE_PIECE",
          playerId: 1,
          coord: { x: 2, y: 2 },
          skillType: "NONE",
        }),
      /Forced special move required: hand cap reached/,
    );

    // Playing with omitted skillType (defaults to NONE)
    assert.throws(
      () =>
        dispatch(state, {
          type: "PLACE_PIECE",
          playerId: 1,
          coord: { x: 2, y: 2 },
        }),
      /Forced special move required: hand cap reached/,
    );

    // Playing with special piece from hand succeeds and clears isForcedSpecial
    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "BOMB",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    assert.strictEqual(player1After?.isForcedSpecial, false);
    assert.strictEqual(player1After?.hand.BOMB, 0);
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
    assert.strictEqual(viewerSelf?.hand.WALL, 1);
    assert.strictEqual(viewerSelf?.charge.PURIFY, 2);

    // Opponent (Player 2, Team 2) must have hand, charges, and isForcedSpecial masked
    const opponent = sanitized.players.find((p) => p.id === 2);
    assert.strictEqual(opponent?.isForcedSpecial, false);
    assert.strictEqual(opponent?.hand.NONE, 0);
    assert.strictEqual(opponent?.hand.WALL, 0);
    assert.strictEqual(opponent?.hand.PIERCE, 0);
    assert.strictEqual(opponent?.hand.BOMB, 0);
    assert.strictEqual(opponent?.hand.PURIFY, 0);
    assert.strictEqual(opponent?.hand.COUNTER, 0);
    assert.strictEqual(opponent?.charge.NONE, 0);
    assert.strictEqual(opponent?.charge.WALL, 0);
    assert.strictEqual(opponent?.charge.PIERCE, 0);
    assert.strictEqual(opponent?.charge.BOMB, 0);
    assert.strictEqual(opponent?.charge.PURIFY, 0);
    assert.strictEqual(opponent?.charge.COUNTER, 0);

    // Teammate (Player 3, Team 1) must be completely visible to Player 1
    const teammate = sanitized.players.find((p) => p.id === 3);
    assert.strictEqual(teammate?.isForcedSpecial, true);
    assert.strictEqual(teammate?.hand.PIERCE, 3);
    assert.strictEqual(teammate?.hand.BOMB, 1);
    assert.strictEqual(teammate?.charge.WALL, 2);
  });

  it("charge_freezes_when_hand_is_at_cap: A player holding max hand capacity for a skill does not accumulate charge points for that skill", () => {
    const board = createEmptyBoard(16);
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

    // PIERCE is at maxHand (2), charge is 0. BOMB is at 0, charge is 0.
    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: SKILL_SPECS.PIERCE.maxHand,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        charge: {
          NONE: 0,
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

    const { nextState, events } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    // PIERCE must remain at maxHand and charge must NOT increment (frozen at 0)
    assert.strictEqual(player1After?.hand.PIERCE, SKILL_SPECS.PIERCE.maxHand);
    assert.strictEqual(player1After?.charge.PIERCE, 0);

    // Uncapped skill (BOMB) must accumulate charge normally
    assert.strictEqual(player1After?.charge.BOMB, 1);

    // No SKILL_ACQUIRED event for PIERCE
    const pierceAcquired = events.find(
      (e) => e.type === "SKILL_ACQUIRED" && e.skillType === "PIERCE",
    );
    assert.strictEqual(pierceAcquired, undefined);

    // Not saturated across all skills, so isForcedSpecial must remain false
    assert.strictEqual(player1After?.isForcedSpecial, false);
  });

  it("charge_resumes_after_skill_consumed: After placing a skill from max hand, the skill count decrements and charge resumes from 0 on the next turn", () => {
    const board = createEmptyBoard(16);
    setCell(board, 3, 2, makePiece(2, 2, "NONE"));
    setCell(board, 4, 2, makePiece(1, 1, "NONE"));

    // Player 1 holds maxHand PIERCE (2) with charge frozen at 0
    const players = [
      createEconomyPlayer(1, 1, "Player 1", {
        hand: {
          NONE: Infinity,
          WALL: 0,
          PIERCE: SKILL_SPECS.PIERCE.maxHand,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        charge: {
          NONE: 0,
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

    // Player 1 places PIERCE from max hand
    const { nextState } = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "PIERCE",
    });

    const player1After = nextState.players.find((p) => p.id === 1);
    // Count decremented below maxHand: (2 -> 1)
    assert.strictEqual(
      player1After?.hand.PIERCE,
      SKILL_SPECS.PIERCE.maxHand - 1,
    );
    // Charge unfreezes and resumes accumulating from 0 (gains +1 at placement turn end)
    assert.strictEqual(player1After?.charge.PIERCE, 1);
    assert.strictEqual(player1After?.isForcedSpecial, false);
  });

  it("rebalanced_specs_adhere_to_matrix: Verify all skills conform to the new (3, 4, 4, 5, 7) cooldown values", () => {
    assert.deepStrictEqual(SKILL_SPECS.PIERCE, { cd: 3, maxHand: 2 });
    assert.deepStrictEqual(SKILL_SPECS.BOMB, { cd: 4, maxHand: 2 });
    assert.deepStrictEqual(SKILL_SPECS.WALL, { cd: 4, maxHand: 1 });
    assert.deepStrictEqual(SKILL_SPECS.PURIFY, { cd: 5, maxHand: 1 });
    assert.deepStrictEqual(SKILL_SPECS.COUNTER, { cd: 7, maxHand: 1 });
  });
});

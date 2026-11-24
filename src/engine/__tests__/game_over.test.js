import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dispatch } from "../pipeline.js";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

describe("Game Over Mechanics", () => {
  it("consecutive passes trigger game over when both players pass outside drop phase", () => {
    const board = createEmptyBoard(4);
    setCell(board, 1, 1, makePiece(1, 1));
    setCell(board, 1, 2, makePiece(1, 1));
    setCell(board, 2, 1, makePiece(2, 2));

    const state = makeTestState(board, 1, undefined, {
      isDropPhase: false,
      dropTurnsRemaining: 0,
    });

    // Turn 1: Player 1 passes
    const res1 = dispatch(state, {
      type: "PASS_TURN",
      playerId: 1,
    });
    assert.strictEqual(res1.nextState.isGameOver, false);
    assert.strictEqual(res1.nextState.consecutivePasses, 1);

    // Turn 2: Player 2 passes (2 consecutive passes = player count)
    const res2 = dispatch(res1.nextState, {
      type: "PASS_TURN",
      playerId: 2,
    });
    assert.strictEqual(res2.nextState.isGameOver, true);
    assert.strictEqual(res2.nextState.winnerTeamId, 1); // Team 1 has 2 pieces, Team 2 has 1 piece

    const gameOverEvent = res2.events.find((e) => e.type === "GAME_OVER");
    assert.notStrictEqual(gameOverEvent, undefined);
    assert.strictEqual(gameOverEvent?.winnerTeamId, 1);
  });

  it("piece placement resets consecutive passes", () => {
    const board = createEmptyBoard(4);
    // (1,1) T1, (1,2) T2, (1,3) empty -> P1 can place at (1,3)
    setCell(board, 1, 1, makePiece(1, 1));
    setCell(board, 1, 2, makePiece(2, 2));

    const state = makeTestState(board, 1, undefined, {
      isDropPhase: false,
      dropTurnsRemaining: 0,
      consecutivePasses: 1,
    });

    const res = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 3, y: 1 },
      skillType: "NONE",
    });

    assert.strictEqual(res.nextState.consecutivePasses, 0);
    assert.strictEqual(res.nextState.isGameOver, false);
  });

  it("full board triggers game over", () => {
    const board3 = createEmptyBoard(3);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        setCell(board3, y, x, makePiece(1, 1));
      }
    }
    setCell(board3, 1, 1, makePiece(2, 2));
    setCell(board3, 2, 2, null); // Single empty cell

    const state = makeTestState(board3, 1, undefined, {
      isDropPhase: false,
      dropTurnsRemaining: 0,
    });

    const res = dispatch(state, {
      type: "PLACE_PIECE",
      playerId: 1,
      coord: { x: 2, y: 2 },
      skillType: "NONE",
    });

    assert.strictEqual(res.nextState.isGameOver, true);
    assert.strictEqual(res.nextState.winnerTeamId, 1);
  });

  it("neutral anchors (teamId: 0) are excluded from winner calculation", () => {
    const board = createEmptyBoard(4);
    setCell(board, 0, 0, makePiece(0, 0));
    setCell(board, 0, 1, makePiece(0, 0));
    setCell(board, 0, 2, makePiece(0, 0));
    setCell(board, 0, 3, makePiece(0, 0));
    setCell(board, 1, 0, makePiece(0, 0));
    // 5 neutral pieces!
    // Team 1 has 2 pieces, Team 2 has 1 piece
    setCell(board, 2, 1, makePiece(1, 1));
    setCell(board, 2, 2, makePiece(1, 1));
    setCell(board, 3, 1, makePiece(2, 2));

    const state = makeTestState(board, 2, undefined, {
      isDropPhase: false,
      dropTurnsRemaining: 0,
      consecutivePasses: 1,
    });

    // Player 2 passes, triggering game over via 2 consecutive passes
    const res = dispatch(state, {
      type: "PASS_TURN",
      playerId: 2,
    });

    assert.strictEqual(res.nextState.isGameOver, true);
    // Neutral has 5 pieces, Team 1 has 2, Team 2 has 1. Winner MUST be Team 1, not 0!
    assert.strictEqual(res.nextState.winnerTeamId, 1);
  });

  it("equal piece count results in a tie (winnerTeamId: null)", () => {
    const board = createEmptyBoard(4);
    setCell(board, 1, 1, makePiece(1, 1));
    setCell(board, 2, 2, makePiece(2, 2));

    const state = makeTestState(board, 2, undefined, {
      isDropPhase: false,
      dropTurnsRemaining: 0,
      consecutivePasses: 1,
    });

    const res = dispatch(state, {
      type: "PASS_TURN",
      playerId: 2,
    });

    assert.strictEqual(res.nextState.isGameOver, true);
    assert.strictEqual(res.nextState.winnerTeamId, null);
  });
});

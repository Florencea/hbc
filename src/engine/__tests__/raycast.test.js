import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { traceRay, getLegalMoves, isValidCoord } from "../raycast.js";
import {
  createEmptyBoard,
  makePiece,
  makeTestState,
  setCell,
} from "./helpers.js";

describe("raycast", () => {
  it("validates coordinate boundaries correctly", () => {
    assert.strictEqual(isValidCoord(16, { x: 0, y: 0 }), true);
    assert.strictEqual(isValidCoord(16, { x: 15, y: 15 }), true);
    assert.strictEqual(isValidCoord(16, { x: -1, y: 0 }), false);
    assert.strictEqual(isValidCoord(16, { x: 0, y: 16 }), false);
  });

  it("finds captures in a standard line of opponent pieces", () => {
    const board = createEmptyBoard(16);
    // Attacker at (2, 2). Opponent pieces at (3, 2), (4, 2). Friendly piece at (5, 2).
    setCell(board, 2, 3, makePiece(2, 2));
    setCell(board, 2, 4, makePiece(2, 2));
    setCell(board, 2, 5, makePiece(1, 1));

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    assert.deepStrictEqual(result.capturedCoords, [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
    assert.strictEqual(result.isBlockedByWall, false);
    assert.deepStrictEqual(result.penetratedWallCoords, []);
  });

  it("does not capture if ray hits an empty space before a friendly piece", () => {
    const board = createEmptyBoard(16);
    setCell(board, 2, 3, makePiece(2, 2));
    // (4, 2) is empty, (5, 2) is friendly
    setCell(board, 2, 5, makePiece(1, 1));

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    assert.deepStrictEqual(result.capturedCoords, []);
    assert.strictEqual(result.isBlockedByWall, false);
  });

  it("does not capture if adjacent piece is already friendly", () => {
    const board = createEmptyBoard(16);
    setCell(board, 2, 3, makePiece(1, 1));

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    assert.deepStrictEqual(result.capturedCoords, []);
    assert.strictEqual(result.isBlockedByWall, false);
  });

  it("supports multi-team sandwiches (Team 1 sandwiching Team 2 and Team 3)", () => {
    const board = createEmptyBoard(16);
    setCell(board, 2, 3, makePiece(2, 2)); // Team 2
    setCell(board, 2, 4, makePiece(3, 3)); // Team 3
    setCell(board, 2, 5, makePiece(1, 4)); // Team 1 ally

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    assert.deepStrictEqual(result.capturedCoords, [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("blocks non-PIERCE ray when encountering a WALL piece", () => {
    const board = createEmptyBoard(16);
    setCell(board, 2, 3, makePiece(2, 2));
    setCell(board, 2, 4, makePiece(2, 2, "WALL", false)); // Unrevealed WALL
    setCell(board, 2, 5, makePiece(1, 1));

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    assert.deepStrictEqual(result.capturedCoords, []);
    assert.strictEqual(result.isBlockedByWall, true);
    assert.deepStrictEqual(result.blockedCoord, { x: 4, y: 2 });
    assert.deepStrictEqual(result.penetratedWallCoords, []);
  });

  it("penetrates a WALL piece when attacker uses PIERCE", () => {
    const board = createEmptyBoard(16);
    setCell(board, 2, 3, makePiece(2, 2));
    setCell(board, 2, 4, makePiece(2, 2, "WALL", false));
    setCell(board, 2, 5, makePiece(1, 1));

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "PIERCE",
    );
    assert.deepStrictEqual(result.capturedCoords, [
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
    assert.strictEqual(result.isBlockedByWall, false);
    assert.deepStrictEqual(result.penetratedWallCoords, [{ x: 4, y: 2 }]);
  });

  it("calculates all legal moves on a board", () => {
    const board = createEmptyBoard(16);
    // Standard 2x2 center at (7, 7), (7, 8), (8, 7), (8, 8)
    setCell(board, 7, 7, makePiece(1, 1));
    setCell(board, 7, 8, makePiece(2, 2));
    setCell(board, 8, 7, makePiece(2, 2));
    setCell(board, 8, 8, makePiece(1, 1));

    const state = makeTestState(board, 1);

    const legalMoves = getLegalMoves(state, 1, "NONE");
    assert.strictEqual(legalMoves.length, 4);
    assert.ok(
      legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 8, y: 6 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.ok(
      legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 6, y: 8 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.ok(
      legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 9, y: 7 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    assert.ok(
      legalMoves.some((item) => {
        try {
          assert.deepStrictEqual(item, { x: 7, y: 9 });
          return true;
        } catch {
          return false;
        }
      }),
    );
  });
});

import { describe, expect, it } from "vitest";
import { traceRay, getLegalMoves, isValidCoord } from "../raycast.ts";
import type { Board, GameState, Piece } from "../types.ts";

function createEmptyBoard(size = 16): Board {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
}

function makePiece(
  teamId: number,
  playerId: number,
  skillType: Piece["skillType"] = "NONE",
  isRevealed = false,
): Piece {
  return { teamId, playerId, skillType, isRevealed };
}

describe("raycast", () => {
  it("validates coordinate boundaries correctly", () => {
    expect(isValidCoord(16, { x: 0, y: 0 })).toBe(true);
    expect(isValidCoord(16, { x: 15, y: 15 })).toBe(true);
    expect(isValidCoord(16, { x: -1, y: 0 })).toBe(false);
    expect(isValidCoord(16, { x: 0, y: 16 })).toBe(false);
  });

  it("finds captures in a standard line of opponent pieces", () => {
    const board = createEmptyBoard(16);
    // Attacker at (2, 2). Opponent pieces at (3, 2), (4, 2). Friendly piece at (5, 2).
    board[2][3] = makePiece(2, 2);
    board[2][4] = makePiece(2, 2);
    board[2][5] = makePiece(1, 1);

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    expect(result.capturedCoords).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
    expect(result.isBlockedByWall).toBe(false);
    expect(result.penetratedWallCoords).toEqual([]);
  });

  it("does not capture if ray hits an empty space before a friendly piece", () => {
    const board = createEmptyBoard(16);
    board[2][3] = makePiece(2, 2);
    // (4, 2) is empty, (5, 2) is friendly
    board[2][5] = makePiece(1, 1);

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    expect(result.capturedCoords).toEqual([]);
    expect(result.isBlockedByWall).toBe(false);
  });

  it("does not capture if adjacent piece is already friendly", () => {
    const board = createEmptyBoard(16);
    board[2][3] = makePiece(1, 1);

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    expect(result.capturedCoords).toEqual([]);
    expect(result.isBlockedByWall).toBe(false);
  });

  it("supports multi-team sandwiches (Team 1 sandwiching Team 2 and Team 3)", () => {
    const board = createEmptyBoard(16);
    board[2][3] = makePiece(2, 2); // Team 2
    board[2][4] = makePiece(3, 3); // Team 3
    board[2][5] = makePiece(1, 4); // Team 1 ally

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    expect(result.capturedCoords).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it("blocks non-PIERCE ray when encountering a WALL piece", () => {
    const board = createEmptyBoard(16);
    board[2][3] = makePiece(2, 2);
    board[2][4] = makePiece(2, 2, "WALL", false); // Unrevealed WALL
    board[2][5] = makePiece(1, 1);

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "NONE",
    );
    expect(result.capturedCoords).toEqual([]);
    expect(result.isBlockedByWall).toBe(true);
    expect(result.blockedCoord).toEqual({ x: 4, y: 2 });
    expect(result.penetratedWallCoords).toEqual([]);
  });

  it("penetrates a WALL piece when attacker uses PIERCE", () => {
    const board = createEmptyBoard(16);
    board[2][3] = makePiece(2, 2);
    board[2][4] = makePiece(2, 2, "WALL", false);
    board[2][5] = makePiece(1, 1);

    const result = traceRay(
      board,
      16,
      { x: 2, y: 2 },
      { x: 1, y: 0 },
      1,
      "PIERCE",
    );
    expect(result.capturedCoords).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
    expect(result.isBlockedByWall).toBe(false);
    expect(result.penetratedWallCoords).toEqual([{ x: 4, y: 2 }]);
  });

  it("calculates all legal moves on a board", () => {
    const board = createEmptyBoard(16);
    // Standard 2x2 center at (7, 7), (7, 8), (8, 7), (8, 8)
    board[7][7] = makePiece(1, 1);
    board[7][8] = makePiece(2, 2);
    board[8][7] = makePiece(2, 2);
    board[8][8] = makePiece(1, 1);

    const state: GameState = {
      board,
      size: 16,
      currentTurn: 1,
      activePlayerId: 1,
      players: [
        { id: 1, teamId: 1, name: "Player 1" },
        { id: 2, teamId: 2, name: "Player 2" },
      ],
      isGameOver: false,
      winnerTeamId: null,
    };

    const legalMoves = getLegalMoves(state, 1, "NONE");
    expect(legalMoves.length).toBe(4);
    expect(legalMoves).toContainEqual({ x: 8, y: 6 });
    expect(legalMoves).toContainEqual({ x: 6, y: 8 });
    expect(legalMoves).toContainEqual({ x: 9, y: 7 });
    expect(legalMoves).toContainEqual({ x: 7, y: 9 });
  });
});

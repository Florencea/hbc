import { describe, expect, it } from "vitest";
import { sanitizeForViewer } from "../sanitize.ts";
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

describe("sanitizeForViewer (Fog of War)", () => {
  const board = createEmptyBoard(16);
  // (2, 2) is Team 1 BOMB (unrevealed)
  board[2][2] = makePiece(1, 1, "BOMB", false);
  // (3, 3) is Team 2 COUNTER (unrevealed)
  board[3][3] = makePiece(2, 2, "COUNTER", false);
  // (4, 4) is Team 2 WALL (revealed)
  board[4][4] = makePiece(2, 2, "WALL", true);

  const state: GameState = {
    board,
    size: 16,
    currentTurn: 1,
    activePlayerId: 1,
    players: [
      {
        id: 1,
        teamId: 1,
        name: "Player 1",
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
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        isForcedSpecial: false,
      },
      {
        id: 2,
        teamId: 2,
        name: "Player 2",
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
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        isForcedSpecial: false,
      },
      {
        id: 3,
        teamId: 1,
        name: "Player 3 (Teammate of P1)",
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
          PIERCE: 0,
          BOMB: 0,
          PURIFY: 0,
          COUNTER: 0,
        },
        isForcedSpecial: false,
      },
    ],
    isGameOver: false,
    winnerTeamId: null,
    mapPreset: "CROSSROADS",
    isDropPhase: false,
    dropTurnsRemaining: 0,
  };

  it("hides unrevealed enemy skill types from opponent perspective", () => {
    const sanitized = sanitizeForViewer(state, 1); // Viewed by Player 1 (Team 1)

    // Opponent piece at (3, 3) must be masked to NONE
    const enemyPiece = sanitized.board[3]?.[3];
    expect(enemyPiece?.skillType).toBe("NONE");
    expect(enemyPiece?.teamId).toBe(2);

    // Opponent revealed piece at (4, 4) remains WALL
    const revealedEnemyPiece = sanitized.board[4]?.[4];
    expect(revealedEnemyPiece?.skillType).toBe("WALL");
  });

  it("reveals unrevealed skill types to allies/teammates", () => {
    const sanitized = sanitizeForViewer(state, 3); // Viewed by Player 3 (Team 1, ally of P1)

    // Friendly piece at (2, 2) shows true BOMB skill
    const allyPiece = sanitized.board[2]?.[2];
    expect(allyPiece?.skillType).toBe("BOMB");
  });
});

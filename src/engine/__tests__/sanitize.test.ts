import { describe, expect, it } from "vitest";
import { getAvailableMoves } from "../raycast.ts";
import { sanitizeForViewer } from "../sanitize.ts";
import type { GameState } from "../types.ts";
import { createEmptyBoard, makePiece, setCell } from "./helpers.ts";

describe("sanitizeForViewer (Fog of War)", () => {
  const board = createEmptyBoard(16);
  // (2, 2) is Team 1 BOMB (unrevealed)
  setCell(board, 2, 2, makePiece(1, 1, "BOMB", false));
  // (3, 3) is Team 2 COUNTER (unrevealed)
  setCell(board, 3, 3, makePiece(2, 2, "COUNTER", false));
  // (4, 4) is Team 2 WALL (revealed)
  setCell(board, 4, 4, makePiece(2, 2, "WALL", true));

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

  it("prevents sonar probe: getAvailableMoves on sanitized state yields identical moves for NONE and PIERCE against unrevealed pieces", () => {
    const freshBoard = createEmptyBoard(16);
    // Unrevealed enemy WALL at (5, 5), friendly piece at (5, 6)
    setCell(freshBoard, 5, 5, makePiece(2, 2, "WALL", false));
    setCell(freshBoard, 5, 6, makePiece(1, 1, "NONE"));

    const testState: GameState = {
      board: freshBoard,
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
            WALL: 1,
            PIERCE: 1,
            BOMB: 1,
            PURIFY: 1,
            COUNTER: 1,
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
      ],
      isGameOver: false,
      winnerTeamId: null,
      mapPreset: "CROSSROADS",
      isDropPhase: false,
      dropTurnsRemaining: 0,
    };

    const sanitized = sanitizeForViewer(testState, 1);

    const movesNone = getAvailableMoves(sanitized, 1, "NONE");
    const movesPierce = getAvailableMoves(sanitized, 1, "PIERCE");

    // Under sanitized state, (4, 5) captures through (5, 5) for BOTH NONE and PIERCE
    expect(movesNone.standardMoves).toEqual(movesPierce.standardMoves);
    expect(movesNone.standardMoves.some((c) => c.x === 4 && c.y === 5)).toBe(
      true,
    );
  });
});

import type { Board, GameState, Piece } from "../types.ts";

export function createEmptyBoard(size = 16): Board {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
}

export function makePiece(
  teamId: number,
  playerId: number,
  skillType: Piece["skillType"] = "NONE",
  isRevealed = false,
): Piece {
  return { teamId, playerId, skillType, isRevealed };
}

export function makeTestState(board: Board, activePlayerId = 1): GameState {
  return {
    board,
    size: 16,
    currentTurn: 1,
    activePlayerId,
    players: [
      { id: 1, teamId: 1, name: "Player 1" },
      { id: 2, teamId: 2, name: "Player 2" },
    ],
    isGameOver: false,
    winnerTeamId: null,
  };
}

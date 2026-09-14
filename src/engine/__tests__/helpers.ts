import type { Board, GameState, Piece, Player } from "../types.ts";

export function createEmptyBoard(size = 16): Board {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
}

export function setCell(
  board: Board,
  y: number,
  x: number,
  piece: Piece | null,
): void {
  const row = board[y];
  if (row) {
    row[x] = piece;
  }
}

export function makePiece(
  teamId: number,
  playerId: number,
  skillType: Piece["skillType"] = "NONE",
  isRevealed = false,
): Piece {
  return { teamId, playerId, skillType, isRevealed };
}

function createTestPlayer(
  id: number,
  teamId: number,
  name: string,
  infiniteHand = true,
): Player {
  return {
    id,
    teamId,
    name,
    hand: {
      NONE: Infinity,
      WALL: infiniteHand ? Infinity : 0,
      PIERCE: infiniteHand ? Infinity : 0,
      BOMB: infiniteHand ? Infinity : 0,
      PURIFY: infiniteHand ? Infinity : 0,
      COUNTER: infiniteHand ? Infinity : 0,
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
  };
}

export function makeTestState(
  board: Board,
  activePlayerId = 1,
  players?: Player[],
  overrides?: Partial<GameState>,
): GameState {
  return {
    board,
    size: board.length,
    currentTurn: 1,
    activePlayerId,
    players: players ?? [
      createTestPlayer(1, 1, "Player 1", true),
      createTestPlayer(2, 2, "Player 2", true),
    ],
    isGameOver: false,
    winnerTeamId: null,
    mapPreset: "CROSSROADS",
    isDropPhase: false,
    dropTurnsRemaining: 0,
    consecutivePasses: 0,
    ...overrides,
  };
}

import type {
  Board,
  Coord,
  GameState,
  RaycastResult,
  SkillType,
} from "./types.ts";

export const DIRECTIONS: readonly Coord[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function isValidCoord(boardSize: number, coord: Coord): boolean {
  return (
    coord.x >= 0 && coord.x < boardSize && coord.y >= 0 && coord.y < boardSize
  );
}

export function traceRay(
  board: Board,
  boardSize: number,
  startCoord: Coord,
  direction: Coord,
  attackerTeamId: number,
  attackerSkillType: SkillType,
): RaycastResult {
  const intermediateCoords: Coord[] = [];
  const penetratedWallCoords: Coord[] = [];
  let currX = startCoord.x + direction.x;
  let currY = startCoord.y + direction.y;

  while (isValidCoord(boardSize, { x: currX, y: currY })) {
    const piece = board[currY]?.[currX];
    if (!piece) {
      return {
        direction,
        capturedCoords: [],
        isBlockedByWall: false,
        penetratedWallCoords: [],
      };
    }

    if (piece.teamId !== attackerTeamId) {
      if (piece.skillType === "WALL" && attackerSkillType !== "PIERCE") {
        return {
          direction,
          capturedCoords: [],
          isBlockedByWall: true,
          blockedCoord: { x: currX, y: currY },
          penetratedWallCoords: [],
        };
      }

      if (piece.skillType === "WALL" && attackerSkillType === "PIERCE") {
        penetratedWallCoords.push({ x: currX, y: currY });
      }

      intermediateCoords.push({ x: currX, y: currY });
      currX += direction.x;
      currY += direction.y;
    } else {
      if (intermediateCoords.length > 0) {
        return {
          direction,
          capturedCoords: intermediateCoords,
          isBlockedByWall: false,
          penetratedWallCoords,
        };
      }
      return {
        direction,
        capturedCoords: [],
        isBlockedByWall: false,
        penetratedWallCoords: [],
      };
    }
  }

  return {
    direction,
    capturedCoords: [],
    isBlockedByWall: false,
    penetratedWallCoords: [],
  };
}

export function collectAllRaycasts(
  board: Board,
  boardSize: number,
  startCoord: Coord,
  attackerTeamId: number,
  attackerSkillType: SkillType,
): RaycastResult[] {
  return DIRECTIONS.map((direction) =>
    traceRay(
      board,
      boardSize,
      startCoord,
      direction,
      attackerTeamId,
      attackerSkillType,
    ),
  );
}

export function getLegalMoves(
  state: GameState,
  playerId: number,
  skillType: SkillType = "NONE",
): Coord[] {
  if (state.isGameOver) return [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const legalMoves: Coord[] = [];

  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.board[y]?.[x] !== null) continue;

      const hasCapture = DIRECTIONS.some((direction) => {
        const result = traceRay(
          state.board,
          state.size,
          { x, y },
          direction,
          player.teamId,
          skillType,
        );
        return result.capturedCoords.length > 0;
      });

      if (hasCapture) {
        legalMoves.push({ x, y });
      }
    }
  }

  return legalMoves;
}

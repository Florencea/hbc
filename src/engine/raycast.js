import { getDistance, isWithinDropZone } from "./map.js";

export const DIRECTIONS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function isValidCoord(boardSize, coord) {
  return (
    coord.x >= 0 && coord.x < boardSize && coord.y >= 0 && coord.y < boardSize
  );
}

export function traceRay(
  board,
  boardSize,
  startCoord,
  direction,
  attackerTeamId,
  attackerSkillType,
) {
  const intermediateCoords = [];
  const penetratedWallCoords = [];
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
  board,
  boardSize,
  startCoord,
  attackerTeamId,
  attackerSkillType,
) {
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

export function getLegalMoves(state, playerId, skillType = "NONE") {
  if (state.isGameOver) return [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const legalMoves = [];

  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.board[y]?.[x] !== null) continue;

      if (
        state.isDropPhase &&
        player.dropZone &&
        !isWithinDropZone({ x, y }, player.dropZone)
      ) {
        continue;
      }

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

export function getPioneerMoves(state, playerId) {
  if (state.isGameOver) return [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const friendlyCoords = [];
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      const piece = state.board[y]?.[x];
      if (piece?.teamId === player.teamId) {
        friendlyCoords.push({ x, y });
      }
    }
  }

  if (friendlyCoords.length === 0) return [];

  const pioneerMoves = [];

  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (state.board[y]?.[x] !== null) continue;

      if (
        state.isDropPhase &&
        player.dropZone &&
        !isWithinDropZone({ x, y }, player.dropZone)
      ) {
        continue;
      }

      const isNearFriendly = friendlyCoords.some(
        (c) => getDistance({ x, y }, c) <= 2,
      );

      if (isNearFriendly) {
        pioneerMoves.push({ x, y });
      }
    }
  }

  return pioneerMoves;
}

export function getAvailableMoves(state, playerId, skillType = "NONE") {
  if (state.isGameOver) {
    return {
      standardMoves: [],
      pioneerMoves: [],
      isPioneerActive: false,
    };
  }

  const standardMoves = getLegalMoves(state, playerId, skillType);
  if (standardMoves.length > 0) {
    return {
      standardMoves,
      pioneerMoves: [],
      isPioneerActive: false,
    };
  }

  const pioneerMoves = getPioneerMoves(state, playerId);
  return {
    standardMoves: [],
    pioneerMoves,
    isPioneerActive: true,
  };
}

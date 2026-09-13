import type {
  Board,
  Coord,
  DropZone,
  MapPreset,
  Piece,
  Player,
} from "./types.ts";

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalMoveError";
  }
}

export function getDistance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function isWithinDropZone(coord: Coord, dropZone: DropZone): boolean {
  return getDistance(coord, dropZone.center) <= dropZone.radius;
}

export function createNeutralPiece(): Piece {
  return {
    teamId: 0,
    playerId: 0,
    skillType: "NONE",
    isRevealed: true,
  };
}

export interface GeneratedMap {
  board: Board;
  dropZones: Map<number, DropZone>;
}

function generateCrossroadsMap(size: number, players: Player[]): GeneratedMap {
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const dropZones = new Map<number, DropZone>();
  const mid = Math.floor(size / 2);

  const p1 = players.length > 0 ? players[0] : undefined;
  const p2 = players.length > 1 ? players[1] : undefined;
  const p3 = players.length > 2 ? players[2] : undefined;
  const p4 = players.length > 3 ? players[3] : undefined;

  // Standard center formation
  board[mid - 1][mid - 1] = {
    teamId: p1 ? p1.teamId : 1,
    playerId: p1 ? p1.id : 1,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid - 1][mid] = {
    teamId: p2 ? p2.teamId : 2,
    playerId: p2 ? p2.id : 2,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid][mid - 1] = {
    teamId: p2 ? p2.teamId : 2,
    playerId: p2 ? p2.id : 2,
    skillType: "NONE",
    isRevealed: true,
  };
  board[mid][mid] = {
    teamId: p1 ? p1.teamId : 1,
    playerId: p1 ? p1.id : 1,
    skillType: "NONE",
    isRevealed: true,
  };

  // Clustered center neutral anchors (4x4 cross pattern around center)
  const neutralCoords: Coord[] = [
    // Outer arms of the 4x4 cluster
    { x: mid - 2, y: mid - 1 },
    { x: mid - 2, y: mid },
    { x: mid + 1, y: mid - 1 },
    { x: mid + 1, y: mid },
    { x: mid - 1, y: mid - 2 },
    { x: mid, y: mid + 1 },
    // 4x4 corners
    { x: mid - 2, y: mid - 2 },
    { x: mid + 1, y: mid - 2 },
    { x: mid - 2, y: mid + 1 },
    { x: mid + 1, y: mid + 1 },
  ];

  for (const coord of neutralCoords) {
    if (
      coord.x >= 0 &&
      coord.x < size &&
      coord.y >= 0 &&
      coord.y < size &&
      board[coord.y][coord.x] === null
    ) {
      board[coord.y][coord.x] = createNeutralPiece();
    }
  }

  // Assign drop zones centered at players' initial anchors
  if (p1) {
    dropZones.set(p1.id, {
      center: { x: mid - 1, y: mid - 1 },
      radius: 3,
    });
  }
  if (p2) {
    dropZones.set(p2.id, {
      center: { x: mid, y: mid },
      radius: 3,
    });
  }
  if (p3) {
    dropZones.set(p3.id, {
      center: { x: mid, y: mid - 1 },
      radius: 3,
    });
  }
  if (p4) {
    dropZones.set(p4.id, {
      center: { x: mid - 1, y: mid },
      radius: 3,
    });
  }

  return { board, dropZones };
}

function generateArchipelagoMap(size: number, players: Player[]): GeneratedMap {
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const dropZones = new Map<number, DropZone>();
  const offset = Math.max(2, Math.floor(size / 5));

  // 4 separate 2x2 neutral islands in quadrants
  const islands: Coord[][] = [
    // Q1: Top-Left island
    [
      { x: offset, y: offset },
      { x: offset + 1, y: offset },
      { x: offset, y: offset + 1 },
      { x: offset + 1, y: offset + 1 },
    ],
    // Q4: Bottom-Right island
    [
      { x: size - offset - 2, y: size - offset - 2 },
      { x: size - offset - 1, y: size - offset - 2 },
      { x: size - offset - 2, y: size - offset - 1 },
      { x: size - offset - 1, y: size - offset - 1 },
    ],
    // Q2: Top-Right island
    [
      { x: size - offset - 2, y: offset },
      { x: size - offset - 1, y: offset },
      { x: size - offset - 2, y: offset + 1 },
      { x: size - offset - 1, y: offset + 1 },
    ],
    // Q3: Bottom-Left island
    [
      { x: offset, y: size - offset - 2 },
      { x: offset + 1, y: size - offset - 2 },
      { x: offset, y: size - offset - 1 },
      { x: offset + 1, y: size - offset - 1 },
    ],
  ];

  for (const island of islands) {
    for (const coord of island) {
      if (coord.x >= 0 && coord.x < size && coord.y >= 0 && coord.y < size) {
        board[coord.y][coord.x] = createNeutralPiece();
      }
    }
  }

  // Player anchor coords adjacent to islands:
  const playerAnchorPositions: Coord[] = [
    { x: offset - 1, y: offset },
    { x: size - offset, y: size - offset - 1 },
    { x: size - offset, y: offset },
    { x: offset - 1, y: size - offset - 1 },
  ];

  players.forEach((player, idx) => {
    const anchor = playerAnchorPositions[idx % playerAnchorPositions.length];
    if (anchor.x >= 0 && anchor.x < size && anchor.y >= 0 && anchor.y < size) {
      board[anchor.y][anchor.x] = {
        teamId: player.teamId,
        playerId: player.id,
        skillType: "NONE",
        isRevealed: true,
      };
      dropZones.set(player.id, {
        center: { ...anchor },
        radius: 3,
      });
    }
  });

  return { board, dropZones };
}

function generateTrenchesMap(size: number, players: Player[]): GeneratedMap {
  const board: Board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const dropZones = new Map<number, DropZone>();
  const mid = Math.floor(size / 2);

  // Linear neutral paths intersecting across the board with placement gaps
  // Center intersection segment:
  for (let x = mid - 2; x <= mid + 1; x++) {
    board[mid][x] = createNeutralPiece();
  }
  for (let y = mid - 2; y <= mid + 1; y++) {
    board[y][mid] = createNeutralPiece();
  }

  // Outer trench segments
  board[mid][3] = createNeutralPiece();
  board[mid][4] = createNeutralPiece();
  board[mid][size - 5] = createNeutralPiece();
  board[mid][size - 4] = createNeutralPiece();

  board[3][mid] = createNeutralPiece();
  board[4][mid] = createNeutralPiece();
  board[size - 5][mid] = createNeutralPiece();
  board[size - 4][mid] = createNeutralPiece();

  // Player anchors at the extremities of the intersecting trenches
  const anchorPositions: Coord[] = [
    { x: 2, y: mid },
    { x: size - 3, y: mid },
    { x: mid, y: 2 },
    { x: mid, y: size - 3 },
  ];

  players.forEach((player, idx) => {
    const anchor = anchorPositions[idx % anchorPositions.length];
    if (anchor.x >= 0 && anchor.x < size && anchor.y >= 0 && anchor.y < size) {
      board[anchor.y][anchor.x] = {
        teamId: player.teamId,
        playerId: player.id,
        skillType: "NONE",
        isRevealed: true,
      };
      dropZones.set(player.id, {
        center: { ...anchor },
        radius: 3,
      });
    }
  });

  return { board, dropZones };
}

export function generateMap(
  preset: MapPreset,
  size: number,
  players: Player[],
): GeneratedMap {
  switch (preset) {
    case "ARCHIPELAGO":
      return generateArchipelagoMap(size, players);
    case "TRENCHES":
      return generateTrenchesMap(size, players);
    case "CROSSROADS":
    default:
      return generateCrossroadsMap(size, players);
  }
}

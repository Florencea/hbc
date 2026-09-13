export interface Coord {
  x: number;
  y: number;
}

export type SkillType =
  "NONE" | "WALL" | "PIERCE" | "BOMB" | "PURIFY" | "COUNTER";

export interface Piece {
  teamId: number;
  playerId: number;
  skillType: SkillType;
  isRevealed: boolean;
  duration?: number;
}

export type Board = (Piece | null)[][];

export interface Player {
  id: number;
  teamId: number;
  name: string;
}

export interface GameState {
  board: Board;
  size: number;
  currentTurn: number;
  activePlayerId: number;
  players: Player[];
  isGameOver: boolean;
  winnerTeamId: number | null;
}

export interface MaskedPiece {
  teamId: number;
  playerId: number;
  skillType: SkillType;
  isRevealed: boolean;
  duration?: number;
}

export interface MaskedGameState {
  board: (MaskedPiece | null)[][];
  size: number;
  currentTurn: number;
  activePlayerId: number;
  players: Player[];
  isGameOver: boolean;
  winnerTeamId: number | null;
}

export type GameEvent =
  | {
      type: "PIECE_PLACED";
      coord: Coord;
      piece: Piece;
    }
  | {
      type: "RAYCAST_BLOCKED";
      coord: Coord;
      blockerPiece: Piece;
      direction: Coord;
    }
  | {
      type: "PIECE_REVEALED";
      coord: Coord;
      skillType: SkillType;
      reason: "BLOCK" | "PENETRATE" | "AURA" | "TRIGGER";
    }
  | {
      type: "FLIP_BATCH";
      coords: Coord[];
      fromTeamIds: number[];
      toTeamId: number;
    }
  | {
      type: "COUNTER_TRIGGERED";
      coord: Coord;
      defenderTeamId: number;
      reversedCoords: Coord[];
    }
  | {
      type: "BOMB_TRIGGERED";
      coord: Coord;
      teamId: number;
      blastCoords: Coord[];
    }
  | {
      type: "PURIFY_PULSE";
      coord: Coord;
      teamId: number;
      affectedCoords: Coord[];
      remainingDuration: number;
    }
  | {
      type: "TURN_CHANGED";
      previousPlayerId: number;
      nextPlayerId: number;
      turn: number;
    }
  | {
      type: "GAME_OVER";
      winnerTeamId: number | null;
    };

export type Action =
  | {
      type: "PLACE_PIECE";
      playerId: number;
      coord: Coord;
      skillType?: SkillType;
    }
  | {
      type: "PASS_TURN";
      playerId: number;
    };

export interface RaycastResult {
  direction: Coord;
  capturedCoords: Coord[];
  isBlockedByWall: boolean;
  blockedCoord?: Coord;
  penetratedWallCoords: Coord[];
}

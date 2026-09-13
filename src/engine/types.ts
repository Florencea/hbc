export interface Coord {
  x: number;
  y: number;
}

export type SkillType =
  "NONE" | "WALL" | "PIERCE" | "BOMB" | "PURIFY" | "COUNTER";

export const SKILL_SPECS: Record<
  Exclude<SkillType, "NONE">,
  { cd: number; maxHand: number }
> = {
  WALL: { cd: 3, maxHand: 2 },
  PIERCE: { cd: 2, maxHand: 3 },
  BOMB: { cd: 2, maxHand: 3 },
  PURIFY: { cd: 4, maxHand: 2 },
  COUNTER: { cd: 5, maxHand: 1 },
};

export interface Piece {
  teamId: number;
  playerId: number;
  skillType: SkillType;
  isRevealed: boolean;
  duration?: number;
}

export type Board = (Piece | null)[][];

export type MapPreset = "CROSSROADS" | "ARCHIPELAGO" | "TRENCHES";

export interface DropZone {
  center: Coord;
  radius: number;
}

export interface Player {
  id: number;
  teamId: number;
  name: string;
  hand: Record<SkillType, number>;
  charge: Record<SkillType, number>;
  isForcedSpecial: boolean;
  dropZone?: DropZone;
}

export interface GameState {
  board: Board;
  size: number;
  currentTurn: number;
  activePlayerId: number;
  players: Player[];
  isGameOver: boolean;
  winnerTeamId: number | null;
  mapPreset: MapPreset;
  isDropPhase: boolean;
  dropTurnsRemaining: number;
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
  mapPreset: MapPreset;
  isDropPhase: boolean;
  dropTurnsRemaining: number;
}

export type GameEvent =
  | {
      type: "PIECE_PLACED";
      coord: Coord;
      pos?: Coord;
      piece: Piece;
    }
  | {
      type: "PIONEER_PLACED";
      coord: Coord;
      playerId: number;
      piece: Piece;
    }
  | {
      type: "RAYCAST_BLOCKED";
      coord: Coord;
      pos?: Coord;
      wallPos?: Coord;
      blockerPiece: Piece;
      direction: Coord;
    }
  | {
      type: "PIECE_REVEALED";
      coord: Coord;
      pos?: Coord;
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
      source?: Coord;
      defenderTeamId: number;
      factionId?: number;
      reversedCoords: Coord[];
      hijackedBatch?: Coord[];
    }
  | {
      type: "BOMB_TRIGGERED";
      coord: Coord;
      center?: Coord;
      teamId: number;
      factionId?: number;
      blastCoords: Coord[];
      affected?: Coord[];
    }
  | {
      type: "PURIFY_PULSE";
      coord: Coord;
      center?: Coord;
      teamId: number;
      factionId?: number;
      affectedCoords: Coord[];
      affected?: Coord[];
      remainingDuration: number;
    }
  | {
      type: "TURN_CHANGED";
      previousPlayerId: number;
      nextPlayerId: number;
      turn: number;
    }
  | {
      type: "SKILL_ACQUIRED";
      playerId: number;
      skillType: SkillType;
      currentHandCount: number;
    }
  | {
      type: "FORCED_SPECIAL_TRIGGERED";
      playerId: number;
    }
  | {
      type: "GAME_OVER";
      winnerTeamId: number | null;
    }
  | {
      type: "DROP_PHASE_STARTED";
      mapPreset: MapPreset;
      players: { playerId: number; dropZone: DropZone }[];
    }
  | {
      type: "DROP_PHASE_ENDED";
    };

export interface ResolutionResult {
  nextState: GameState;
  events: GameEvent[];
}

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

export interface AvailableMoves {
  standardMoves: Coord[];
  pioneerMoves: Coord[];
  isPioneerActive: boolean;
}

export type AIDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface AIMoveDecision {
  action: Action;
  score: number;
}

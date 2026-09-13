import type { Coord, GameEvent, Piece, SkillType } from "../engine/types.ts";
import {
  playBlockSound,
  playBombSound,
  playCounterSound,
  playFlipSound,
  playPlaceSound,
  playPurifySound,
} from "./sound.ts";

export type CombatTextVariant = "blocked" | "counter" | "bomb" | "purify";

export interface EventHandlers {
  onPiecePlaced?: (coord: Coord, piece: Piece) => void;
  onPioneerPlaced?: (coord: Coord, piece: Piece) => void;
  onRaycastBlocked?: (wallCoord: Coord) => void;
  onPieceFlip?: (coord: Coord, toTeamId: number) => void;
  onCounterTriggered?: (
    center: Coord,
    reversedCoords: Coord[],
    defenderTeamId: number,
  ) => void;
  onBombTriggered?: (
    center: Coord,
    blastCoords: Coord[],
    teamId: number,
  ) => void;
  onPurifyPulse?: (
    center: Coord,
    affectedCoords: Coord[],
    teamId: number,
  ) => void;
  onPieceRevealed?: (
    coord: Coord,
    skillType: SkillType,
    reason: string,
  ) => void;
  onAddFloatingText?: (
    text: string,
    coord: Coord,
    variant: CombatTextVariant,
  ) => void;
  onTriggerScreenShake?: (durationMs?: number) => void;
  onTriggerScreenFlash?: (color: string, durationMs?: number) => void;
  delayFn?: (ms: number) => Promise<void>;
}

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Executes a sequence of game events with choreographed animation delays,
 * visual callbacks, and synchronized audio playback.
 */
export async function playEvents(
  events: GameEvent[],
  handlers: EventHandlers,
): Promise<void> {
  const delay = handlers.delayFn ?? defaultDelay;

  for (const event of events) {
    switch (event.type) {
      case "PIECE_PLACED": {
        handlers.onPiecePlaced?.(event.coord, event.piece);
        playPlaceSound();
        await delay(100);
        break;
      }

      case "PIONEER_PLACED": {
        handlers.onPioneerPlaced?.(event.coord, event.piece);
        playPlaceSound();
        await delay(150);
        break;
      }

      case "RAYCAST_BLOCKED": {
        const wallCoord = event.wallPos ?? event.coord;
        handlers.onRaycastBlocked?.(wallCoord);
        handlers.onAddFloatingText?.("BLOCKED!", wallCoord, "blocked");
        playBlockSound();
        await delay(250);
        break;
      }

      case "PIECE_REVEALED": {
        handlers.onPieceRevealed?.(event.coord, event.skillType, event.reason);
        break;
      }

      case "FLIP_BATCH": {
        for (const coord of event.coords) {
          handlers.onPieceFlip?.(coord, event.toTeamId);
          playFlipSound();
          await delay(60);
        }
        break;
      }

      case "COUNTER_TRIGGERED": {
        handlers.onTriggerScreenFlash?.("purple", 250);
        await delay(120); // Hitstop

        handlers.onCounterTriggered?.(
          event.coord,
          event.reversedCoords,
          event.defenderTeamId,
        );
        handlers.onAddFloatingText?.("ABYSS COUNTER!", event.coord, "counter");
        playCounterSound();
        await delay(150);
        break;
      }

      case "BOMB_TRIGGERED": {
        handlers.onTriggerScreenShake?.(200);
        handlers.onBombTriggered?.(
          event.coord,
          event.blastCoords,
          event.teamId,
        );
        handlers.onAddFloatingText?.("CHAIN BOMB!", event.coord, "bomb");
        playBombSound();
        await delay(200);
        break;
      }

      case "PURIFY_PULSE": {
        handlers.onPurifyPulse?.(
          event.coord,
          event.affectedCoords,
          event.teamId,
        );
        handlers.onAddFloatingText?.("PURIFIED", event.coord, "purify");
        playPurifySound();
        await delay(250);
        break;
      }

      default:
        break;
    }
  }
}

import type { Coord, GameEvent, Piece, SkillType } from "../engine/types.ts";
import {
  playBlockSound,
  playBombSound,
  playCounterSound,
  playFlipSound,
  playPierceSound,
  playPlaceSound,
  playPurifySound,
  playGameOverSound,
} from "./sound.ts";

export type CombatTextVariant =
  "blocked" | "counter" | "bomb" | "purify" | "pierce";

export interface EventHandlers {
  onPiecePlaced?: (coord: Coord, piece: Piece) => void;
  onPioneerPlaced?: (coord: Coord, piece: Piece) => void;
  onRaycastBlocked?: (wallCoord: Coord) => void;
  onPierceTriggered?: (coord: Coord) => void;
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
  onGameOver?: (winnerTeamId: number | null) => void;
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
        handlers.onAddFloatingText?.("翡翠城壁 格擋！", wallCoord, "blocked");
        playBlockSound();
        await delay(500);
        break;
      }

      case "PIECE_REVEALED": {
        handlers.onPieceRevealed?.(event.coord, event.skillType, event.reason);
        if (event.skillType === "PIERCE") {
          handlers.onPierceTriggered?.(event.coord);
          handlers.onAddFloatingText?.(
            "天空守望者 貫穿！",
            event.coord,
            "pierce",
          );
          playPierceSound();
          await delay(450);
        }
        break;
      }

      case "FLIP_BATCH": {
        for (const coord of event.coords) {
          handlers.onPieceFlip?.(coord, event.toTeamId);
          playFlipSound();
          await delay(70);
        }
        break;
      }

      case "COUNTER_TRIGGERED": {
        handlers.onTriggerScreenFlash?.("purple", 350);
        await delay(180); // Hitstop

        handlers.onCounterTriggered?.(
          event.coord,
          event.reversedCoords,
          event.defenderTeamId,
        );
        handlers.onAddFloatingText?.(
          "深淵復仇者 反擊！",
          event.coord,
          "counter",
        );
        playCounterSound();
        await delay(520);
        break;
      }

      case "BOMB_TRIGGERED": {
        handlers.onTriggerScreenShake?.(350);
        handlers.onBombTriggered?.(
          event.coord,
          event.blastCoords,
          event.teamId,
        );
        handlers.onAddFloatingText?.("殺戮盛宴 引爆！", event.coord, "bomb");
        playBombSound();
        await delay(650);
        break;
      }

      case "PURIFY_PULSE": {
        handlers.onPurifyPulse?.(
          event.coord,
          event.affectedCoords,
          event.teamId,
        );
        handlers.onAddFloatingText?.("救贖之光 淨化！", event.coord, "purify");
        playPurifySound();
        await delay(650);
        break;
      }

      case "GAME_OVER": {
        handlers.onGameOver?.(event.winnerTeamId);
        playGameOverSound();
        await delay(200);
        break;
      }

      default:
        break;
    }
  }
}

import { isWithinDropZone } from "../engine/map.ts";
import type { Coord, DropZone, GameState, MaskedPiece, Piece } from "../engine/types.ts";
import { cn } from "../lib/cn.ts";
import {
  BoardOverlay,
  type AbyssVortexEffect,
  type AuraPulseEffect,
  type BlastWaveEffect,
  type PierceStrikeEffect,
  type PioneerBridgeEffect,
  type ShieldRippleEffect,
} from "./BoardOverlay.tsx";
import { FloatingCombatText, type CombatTextItem } from "./FloatingCombatText.tsx";
import {
  getLegalMarkerClass,
  getSpecialPieceGlowClass,
  getTeamColorClass,
  SKILL_CONFIG,
  type GameMode,
} from "./gameUiConstants.ts";

export interface GameBoardProps {
  gameState: GameState;
  currentBoard: (Piece | MaskedPiece | null)[][];
  activePlayerTeamId: number;
  viewerTeamId: number | null;
  isAnimating: boolean;
  isScreenShaking: boolean;
  isCurrentPlayerAi: boolean;
  gameMode: GameMode;
  standardMoveSet: Set<string>;
  pioneerMoveSet: Set<string>;
  previewCapturedSet: Set<string>;
  flippingCoords: Set<string>;
  poppingCoord: Coord | null;
  hoveredCoord: Coord | null;
  setHoveredCoord: (coord: Coord | null) => void;
  effectiveDropZone?: DropZone | undefined;
  blastWaves: BlastWaveEffect[];
  auraPulses: AuraPulseEffect[];
  shieldRipples: ShieldRippleEffect[];
  pierceStrikes: PierceStrikeEffect[];
  abyssVortices: AbyssVortexEffect[];
  pioneerBridges: PioneerBridgeEffect[];
  floatingTexts: CombatTextItem[];
  onCellClick: (coord: Coord) => void;
}

export function GameBoard({
  gameState,
  currentBoard,
  activePlayerTeamId,
  viewerTeamId,
  isAnimating,
  isScreenShaking,
  isCurrentPlayerAi,
  gameMode,
  standardMoveSet,
  pioneerMoveSet,
  previewCapturedSet,
  flippingCoords,
  poppingCoord,
  hoveredCoord,
  setHoveredCoord,
  effectiveDropZone,
  blastWaves,
  auraPulses,
  shieldRipples,
  pierceStrikes,
  abyssVortices,
  pioneerBridges,
  floatingTexts,
  onCellClick,
}: GameBoardProps) {
  return (
    <div
      className={cn(
        "flex justify-center rounded-xl border border-emerald-900/60 bg-emerald-950/70 p-3 shadow-2xl transition-transform",
        isScreenShaking && "animate-board-shake",
      )}
    >
      <div className="relative">
        {/* Visual FX Overlays strictly aligned to board grid */}
        <BoardOverlay
          boardSize={gameState.size}
          blastWaves={blastWaves}
          auraPulses={auraPulses}
          shieldRipples={shieldRipples}
          pierceStrikes={pierceStrikes}
          abyssVortices={abyssVortices}
          pioneerBridges={pioneerBridges}
        />
        <FloatingCombatText items={floatingTexts} boardSize={gameState.size} />

        <div
          className="grid gap-0.5 rounded bg-emerald-950 p-0.5"
          style={{
            gridTemplateColumns: `repeat(${gameState.size.toString()}, minmax(0, 1fr))`,
          }}
          onMouseLeave={() => {
            setHoveredCoord(null);
          }}
        >
          {currentBoard.map((row, y) =>
            row.map((piece, x) => {
              const key = `${x.toString()},${y.toString()}`;
              const isStandardLegal = standardMoveSet.has(key);
              const isPioneerLegal = pioneerMoveSet.has(key);
              const isLegal = isStandardLegal || isPioneerLegal;
              const inDropZone =
                gameState.isDropPhase &&
                effectiveDropZone !== undefined &&
                isWithinDropZone({ x, y }, effectiveDropZone);
              const isFlipping = flippingCoords.has(key);
              const isPopping = poppingCoord?.x === x && poppingCoord.y === y;

              const isHovered = hoveredCoord?.x === x && hoveredCoord.y === y;
              const isPreviewPlacement =
                !isAnimating && piece === null && isHovered && isStandardLegal;
              const isPreviewFlipped = !isAnimating && previewCapturedSet.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  onMouseEnter={() => {
                    if (!isAnimating && !isCurrentPlayerAi && isStandardLegal) {
                      setHoveredCoord({ x, y });
                    }
                  }}
                  onMouseLeave={() => {
                    if (hoveredCoord?.x === x && hoveredCoord.y === y) {
                      setHoveredCoord(null);
                    }
                  }}
                  onClick={() => {
                    setHoveredCoord(null);
                    onCellClick({ x, y });
                  }}
                  disabled={
                    isAnimating ||
                    gameState.isGameOver ||
                    (gameMode === "PVE" && gameState.activePlayerId === 2) ||
                    (piece !== null && !isLegal)
                  }
                  className={cn(
                    "relative flex h-6 w-6 items-center justify-center rounded-xs transition-all sm:h-7 sm:w-7 md:h-8 md:w-8",
                    (x + y) % 2 === 0 ? "bg-emerald-900/90" : "bg-emerald-800/80",
                    gameState.isDropPhase &&
                      inDropZone &&
                      ((gameMode === "PVE" ? 1 : activePlayerTeamId) === 1
                        ? "bg-emerald-800/90 ring-2 ring-zinc-300/80 ring-inset"
                        : "bg-emerald-800/90 ring-2 ring-white/90 ring-inset"),
                    gameState.isDropPhase && !inDropZone && "opacity-45",
                    isAnimating && "cursor-not-allowed",
                    !isAnimating &&
                      isLegal &&
                      (activePlayerTeamId === 1
                        ? "cursor-pointer hover:bg-emerald-700/90 hover:ring-1 hover:ring-zinc-300/80"
                        : "cursor-pointer hover:bg-emerald-700/90 hover:ring-1 hover:ring-white/90"),
                    !isAnimating && !isLegal && "hover:bg-emerald-800/50",
                  )}
                >
                  {/* Legal Move Marker matching active team color (hidden during preview ghost piece) */}
                  {piece === null && !isAnimating && isStandardLegal && !isPreviewPlacement && (
                    <span className={getLegalMarkerClass(activePlayerTeamId, false)} />
                  )}
                  {piece === null && !isAnimating && isPioneerLegal && (
                    <span className={getLegalMarkerClass(activePlayerTeamId, true)} />
                  )}

                  {/* Hover Preview Ghost Piece */}
                  {isPreviewPlacement && (
                    <div
                      className={cn(
                        "relative flex h-5 w-5 items-center justify-center rounded-full border border-dashed shadow-xs transition-all sm:h-6 sm:w-6 md:h-7 md:w-7",
                        activePlayerTeamId === 1
                          ? "border-zinc-400/80 bg-zinc-950/60 text-zinc-100 ring-2 ring-zinc-500/70"
                          : "border-zinc-200/80 bg-white/70 text-zinc-900 ring-2 ring-white/70",
                      )}
                    >
                      <span className="text-[9px] font-black opacity-90 sm:text-[10px]">+</span>
                    </div>
                  )}

                  {/* Piece Representation (including Preview Flipped State) */}
                  {piece && (
                    <div
                      className={cn(
                        "relative flex h-5 w-5 items-center justify-center rounded-full border shadow-xs transition-transform sm:h-6 sm:w-6 md:h-7 md:w-7",
                        isPreviewFlipped
                          ? cn(
                              getTeamColorClass(activePlayerTeamId),
                              "scale-95 shadow-md ring-2 ring-amber-300",
                            )
                          : getTeamColorClass(piece.teamId),
                        !piece.isRevealed &&
                          !isPreviewFlipped &&
                          piece.teamId === viewerTeamId &&
                          "border-dashed ring-1 ring-slate-400/50",
                        !isPreviewFlipped && getSpecialPieceGlowClass(piece),
                        piece.skillType === "PURIFY" &&
                          piece.duration !== undefined &&
                          "shadow-xs ring-1 shadow-amber-500/30 ring-amber-400/80",
                        isFlipping && "animate-piece-flip",
                        isPopping && "animate-piece-pop",
                      )}
                    >
                      {isPreviewFlipped ? null : piece.teamId === 0 ? (
                        <span className="text-[10px] sm:text-xs">⚓</span>
                      ) : SKILL_CONFIG[piece.skillType].code ? (
                        <span
                          className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black sm:h-4 sm:w-4 sm:text-[10px]",
                            SKILL_CONFIG[piece.skillType].annotationStyle,
                          )}
                        >
                          {SKILL_CONFIG[piece.skillType].code}
                        </span>
                      ) : null}

                      {/* Revealed PURIFY Remaining Duration Marker */}
                      {!isPreviewFlipped &&
                        piece.skillType === "PURIFY" &&
                        piece.duration !== undefined && (
                          <span
                            title={`救贖之光：淨化光環生效中（剩餘 ${piece.duration.toString()} 回合）`}
                            className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300 bg-amber-400 text-[8px] font-black text-slate-950 shadow-md ring-1 ring-slate-950 sm:h-4 sm:w-4 sm:text-[9px]"
                          >
                            {piece.duration.toString()}
                          </span>
                        )}
                    </div>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

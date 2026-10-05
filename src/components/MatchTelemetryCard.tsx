import type { AIDifficulty, DropZone, GameState } from "../engine/types.ts";
import { cn } from "../lib/cn.ts";
import { getTeamName, type GameMode } from "./gameUiConstants.ts";

export interface MatchTelemetryCardProps {
  gameState: GameState;
  activePlayerName?: string | undefined;
  activePlayerTeamId: number;
  onPassTurn: () => void;
  isAnimating: boolean;
  isCurrentPlayerAi: boolean;
  gameMode: GameMode;
  aiDifficulty: AIDifficulty;
  setAiDifficulty: (diff: AIDifficulty) => void;
  dropZone?: DropZone | undefined;
  team1Count: number;
  team2Count: number;
  neutralCount: number;
}

export function MatchTelemetryCard({
  gameState,
  activePlayerName,
  activePlayerTeamId,
  onPassTurn,
  isAnimating,
  isCurrentPlayerAi,
  gameMode,
  aiDifficulty,
  setAiDifficulty,
  dropZone,
  team1Count,
  team2Count,
  neutralCount,
}: MatchTelemetryCardProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          對局遙測資訊
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-200">
          第 {gameState.currentTurn.toString()} 回合
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">當前回合：</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full border shadow-xs ring-1",
                activePlayerTeamId === 1
                  ? "border-zinc-500 bg-zinc-950 ring-zinc-700/60"
                  : "border-zinc-300 bg-white ring-zinc-200/80",
              )}
            />
            <span>
              {activePlayerName ?? "未知玩家"} ({getTeamName(activePlayerTeamId)})
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onPassTurn}
          disabled={isAnimating || gameState.isGameOver || isCurrentPlayerAi}
          className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          跳過回合
        </button>
      </div>

      {/* AI Difficulty Selector (Visible in PVE and AI_VS_AI modes) */}
      {(gameMode === "PVE" || gameMode === "AI_VS_AI") && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
          <span className="text-xs text-slate-400">AI 難度：</span>
          <div className="flex rounded-md border border-slate-800 bg-slate-900 p-0.5 shadow-inner">
            {(
              [
                { id: "EASY", label: "簡單 (EASY)" },
                { id: "MEDIUM", label: "普通 (MEDIUM)" },
                { id: "HARD", label: "困難 (HARD)" },
              ] as const
            ).map(({ id, label }) => {
              const isSelected = aiDifficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setAiDifficulty(id);
                  }}
                  disabled={isAnimating}
                  className={cn(
                    "cursor-pointer rounded px-2 py-1 text-[11px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                    isSelected
                      ? id === "HARD"
                        ? "bg-purple-600 text-white shadow-xs"
                        : id === "MEDIUM"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Game Phase & Drop Zone Status */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
        <span>遊戲階段：</span>
        <span className="font-semibold text-slate-200">
          {gameState.isDropPhase ? (
            <span className="text-amber-400">
              初始空降階段（剩餘 {gameState.dropTurnsRemaining.toString()} 回合）
            </span>
          ) : (
            <span className="text-emerald-400">全域對局</span>
          )}
        </span>
      </div>

      {dropZone && gameState.isDropPhase && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>當前空降區：</span>
          <span className="font-mono text-slate-300">
            中心 ({dropZone.center.x.toString()}, {dropZone.center.y.toString()})，半徑=
            {dropZone.radius.toString()}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">盤面棋數統計：</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-0.5 font-bold text-zinc-100">
            {team1Count.toString()} 黑棋
          </span>
          <span className="text-slate-600">/</span>
          <span className="rounded-md border border-slate-300/80 bg-slate-100 px-2 py-0.5 font-bold text-slate-900">
            {team2Count.toString()} 白棋
          </span>
          <span className="text-slate-600">/</span>
          <span className="rounded-md border border-amber-500/40 bg-slate-800 px-2 py-0.5 font-bold text-amber-300">
            {neutralCount.toString()} 錨點
          </span>
        </div>
      </div>
    </div>
  );
}

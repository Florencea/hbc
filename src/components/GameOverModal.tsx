import { cn } from "../lib/cn.ts";
import type { GameMode } from "./gameUiConstants.ts";

export interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  winnerTeamId: number | null;
  team1Count: number;
  team2Count: number;
  neutralCount: number;
  currentTurn: number;
  mapPreset: string;
  gameMode: GameMode;
  onReset: () => void;
  onOpenReplay: () => void;
  onOpenExport: () => void;
}

export function GameOverModal({
  isOpen,
  onClose,
  winnerTeamId,
  team1Count,
  team2Count,
  neutralCount,
  currentTurn,
  mapPreset,
  gameMode,
  onReset,
  onOpenReplay,
  onOpenExport,
}: GameOverModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          ✕
        </button>

        {/* Winner Announcement Header */}
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-3xl shadow-inner">
            {winnerTeamId === 1 || winnerTeamId === 2 ? "🏆" : "🤝"}
          </div>
          <h2 className="text-xl font-black tracking-wide text-white">
            {winnerTeamId === 1
              ? "第一隊（黑方）獲勝！"
              : winnerTeamId === 2
                ? "第二隊（白方）獲勝！"
                : "勢均力敵・平局結算！"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {winnerTeamId === null
              ? "雙方棋子數完全相同，平分秋色"
              : `恭喜 ${winnerTeamId === 1 ? "黑方" : "白方"} 奪得本局對戰勝利！`}
          </p>
        </div>

        {/* Score Comparison Display */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Team 1 (Black) */}
          <div
            className={cn(
              "flex flex-col items-center rounded-xl border p-4 transition-all",
              winnerTeamId === 1
                ? "border-zinc-500 bg-zinc-950 shadow-lg ring-2 ring-zinc-400/80"
                : "border-slate-800 bg-slate-950/60",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-500 bg-zinc-950 shadow-xs ring-1 ring-zinc-700/60" />
              <span className="text-xs font-bold text-slate-300">第一隊（黑方）</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white">{team1Count.toString()}</div>
            <span className="mt-1 text-[10px] text-slate-400">枚棋子</span>
            {winnerTeamId === 1 && (
              <span className="mt-2 rounded-full border border-amber-400/80 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                👑 優勝
              </span>
            )}
          </div>

          {/* Team 2 (White) */}
          <div
            className={cn(
              "flex flex-col items-center rounded-xl border p-4 transition-all",
              winnerTeamId === 2
                ? "border-slate-300 bg-slate-800 shadow-lg ring-2 ring-slate-200/80"
                : "border-slate-800 bg-slate-950/60",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 bg-white shadow-xs ring-1 ring-slate-200/80" />
              <span className="text-xs font-bold text-slate-300">第二隊（白方）</span>
            </div>
            <div className="mt-2 text-3xl font-black text-white">{team2Count.toString()}</div>
            <span className="mt-1 text-[10px] text-slate-400">枚棋子</span>
            {winnerTeamId === 2 && (
              <span className="mt-2 rounded-full border border-amber-400/80 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                👑 優勝
              </span>
            )}
          </div>
        </div>

        {/* Match Summary Telemetry */}
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
          <div className="flex justify-between border-b border-slate-800/60 py-1">
            <span>對戰模式</span>
            <span className="font-semibold text-slate-200">
              {gameMode === "PVP"
                ? "👥 同機雙人"
                : gameMode === "PVE"
                  ? "🤖 人機對戰"
                  : "⚔️ 雙 AI 演示"}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 py-1">
            <span>總對局回合</span>
            <span className="font-mono font-bold text-slate-200">
              {currentTurn.toString()} 回合
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800/60 py-1">
            <span>地圖預設</span>
            <span className="font-semibold text-slate-200">{mapPreset}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>中立錨點存留</span>
            <span className="font-mono font-bold text-amber-300">{neutralCount.toString()} 顆</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 text-center text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-500"
          >
            🔄 再玩一局
          </button>
          <button
            type="button"
            onClick={onOpenReplay}
            className="flex-1 cursor-pointer rounded-lg border border-indigo-500/80 bg-indigo-600/90 py-2.5 text-center text-xs font-bold text-white shadow-md transition-colors hover:bg-indigo-500"
          >
            🎬 觀看重播
          </button>
          <button
            type="button"
            onClick={onOpenExport}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-center text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            📥 匯出
          </button>
        </div>
      </div>
    </div>
  );
}

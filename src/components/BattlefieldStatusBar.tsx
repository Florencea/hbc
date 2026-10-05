import type { DropZone } from "../engine/types.ts";
import { getTeamName, type GameMode } from "./gameUiConstants.ts";

export interface BattlefieldStatusBarProps {
  isReplayMode: boolean;
  replayIndex: number;
  replayStepNotation?: string | undefined;
  isGameOver: boolean;
  winnerTeamId: number | null;
  team1Count: number;
  team2Count: number;
  isAnimating: boolean;
  gameMode: GameMode;
  isAiPlaying: boolean;
  activePlayerName?: string | undefined;
  activePlayerTeamId: number;
  isCurrentPlayerAi: boolean;
  isPioneerActive: boolean;
  pioneerMovesCount: number;
  isDropPhase: boolean;
  dropTurnsRemaining: number;
  dropZone?: DropZone | undefined;
  mapPreset: string;
  onExitReplay: () => void;
  onShowGameOverModal: () => void;
  onReset: () => void;
}

export function BattlefieldStatusBar({
  isReplayMode,
  replayIndex,
  replayStepNotation,
  isGameOver,
  winnerTeamId,
  team1Count,
  team2Count,
  isAnimating,
  gameMode,
  isAiPlaying,
  activePlayerName,
  activePlayerTeamId,
  isCurrentPlayerAi,
  isPioneerActive,
  pioneerMovesCount,
  isDropPhase,
  dropTurnsRemaining,
  dropZone,
  mapPreset,
  onExitReplay,
  onShowGameOverModal,
  onReset,
}: BattlefieldStatusBarProps) {
  return (
    <div className="mb-3 flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2 text-xs shadow-sm">
      {isReplayMode ? (
        <div className="flex items-center gap-2 text-indigo-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </span>
          <span className="font-bold tracking-wider">對局重播進行中：</span>
          <span className="text-slate-200">
            {replayIndex === -1
              ? "初始盤面（Turn 0）"
              : `第 ${(replayIndex + 1).toString()} 手 · ${replayStepNotation ?? ""}`}
          </span>
        </div>
      ) : isGameOver ? (
        <div className="flex items-center gap-2 text-amber-300">
          <span className="text-base">🏆</span>
          <span className="font-bold tracking-wider">
            對局結束：
            {winnerTeamId === 1
              ? "第一隊（黑方）獲勝！"
              : winnerTeamId === 2
                ? "第二隊（白方）獲勝！"
                : "雙方勢均力敵・平手！"}
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            (黑 {team1Count.toString()} : 白 {team2Count.toString()})
          </span>
        </div>
      ) : isAnimating ? (
        <div className="flex items-center gap-2 text-purple-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
          </span>
          <span className="font-bold tracking-wider">連鎖結算中...</span>
          <span className="text-slate-400">正在執行事件序列與戰鬥動畫</span>
        </div>
      ) : gameMode === "AI_VS_AI" ? (
        <div className="flex items-center gap-2 text-purple-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
          </span>
          <span className="font-bold tracking-wider">雙 AI 演示進行中：</span>
          <span className="text-slate-300">
            {isAiPlaying
              ? `${activePlayerName ?? "AI"}（${getTeamName(activePlayerTeamId)}）思考中...`
              : "已暫停，點擊播放或單步執行推演"}
          </span>
        </div>
      ) : gameMode === "PVE" && isCurrentPlayerAi ? (
        <div className="flex items-center gap-2 text-slate-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-300" />
          </span>
          <span className="font-bold tracking-wider">AI 電腦思考中...</span>
          <span className="text-slate-400">正在評估最佳落子戰略與連鎖效應</span>
        </div>
      ) : isPioneerActive ? (
        <div className="flex items-center gap-2 text-amber-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <span className="font-bold tracking-wider">拓荒階段啟動：</span>
          <span className="text-slate-300">無可夾殺路徑，請於領地 2 格內放置拓荒橋樑棋</span>
        </div>
      ) : isDropPhase ? (
        <div className="flex items-center gap-2 text-amber-300">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          <span className="font-bold tracking-wider">初始空降階段（Turn 0 配置）：</span>
          <span className="text-slate-300">棋子落點限制於專屬空降區域內</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-semibold">全域棋局階段：解除空降限制，套用標準黑白棋規則</span>
        </div>
      )}

      {/* Right Status Badge */}
      <div className="flex shrink-0 items-center gap-2">
        {isReplayMode ? (
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-indigo-500/40 bg-indigo-950/60 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300 ring-1 ring-indigo-500/40">
              🎬 重播進行中
            </span>
            <button
              type="button"
              onClick={onExitReplay}
              className="cursor-pointer rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
            >
              返回對局
            </button>
          </div>
        ) : isGameOver ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onShowGameOverModal}
              className="cursor-pointer rounded bg-blue-600 px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-xs hover:bg-blue-500"
            >
              📊 查看結算
            </button>
            <button
              type="button"
              onClick={onReset}
              className="cursor-pointer rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-200 hover:bg-slate-700"
            >
              🔄 重新開局
            </button>
          </div>
        ) : isAnimating ? (
          <span className="rounded bg-purple-900/60 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-300 ring-1 ring-purple-500/40">
            操作鎖定
          </span>
        ) : gameMode === "AI_VS_AI" ? (
          <span className="rounded border border-purple-500/40 bg-purple-950/60 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-300 ring-1 ring-purple-500/40">
            {isAiPlaying ? "AI 自主演示" : "演示暫停"}
          </span>
        ) : gameMode === "PVE" && isCurrentPlayerAi ? (
          <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200 ring-1 ring-slate-500/40">
            電腦回合
          </span>
        ) : isPioneerActive ? (
          <span className="rounded bg-amber-900/60 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/40">
            {pioneerMovesCount.toString()} 個拓荒目標點
          </span>
        ) : isDropPhase ? (
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="rounded bg-amber-900/60 px-2 py-0.5 text-amber-300">
              剩餘 {dropTurnsRemaining.toString()} 回合
            </span>
            {dropZone && (
              <span className="hidden rounded bg-slate-800 px-2 py-0.5 text-slate-300 sm:inline">
                中心 ({dropZone.center.x.toString()}, {dropZone.center.y.toString()}) 半徑=
                {dropZone.radius.toString()}
              </span>
            )}
          </div>
        ) : (
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
            地圖：{mapPreset}
          </span>
        )}
      </div>
    </div>
  );
}

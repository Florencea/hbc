import { toggleAudioMuted } from "../fx/sound.ts";
import type { SkillType } from "../engine/types.ts";
import { cn } from "../lib/cn.ts";
import type { GameMode } from "./gameUiConstants.ts";

export interface GameHeaderProps {
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  setSelectedSkill: (skill: SkillType) => void;
  isAnimating: boolean;
  isGodMode: boolean;
  setIsGodMode: (god: boolean) => void;
  isAiPlaying: boolean;
  setIsAiPlaying: (playing: boolean) => void;
  isGameOver: boolean;
  onAiStep: () => void;
  aiSpeed: "NORMAL" | "FAST";
  setAiSpeed: (speed: "NORMAL" | "FAST") => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  onReset: () => void;
  isReplayMode: boolean;
  recordedTurns: number;
  onOpenReplay: () => void;
  onExitReplay: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
}

export function GameHeader({
  gameMode,
  setGameMode,
  setSelectedSkill,
  isAnimating,
  isGodMode,
  setIsGodMode,
  isAiPlaying,
  setIsAiPlaying,
  isGameOver,
  onAiStep,
  aiSpeed,
  setAiSpeed,
  isMuted,
  setIsMuted,
  onReset,
  isReplayMode,
  recordedTurns,
  onOpenReplay,
  onExitReplay,
  onOpenExport,
  onOpenImport,
}: GameHeaderProps) {
  return (
    <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <span className="text-blue-500">HBC</span>
          <span>多陣營黑白棋核心引擎</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          五大技能棋、隱藏陷阱與連鎖反應（16x16 無頭引擎）
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Game Mode Selector */}
        <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setGameMode("PVP");
              setSelectedSkill("NONE");
            }}
            disabled={isAnimating}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              gameMode === "PVP"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            👥 同機雙人
          </button>
          <button
            type="button"
            onClick={() => {
              setGameMode("PVE");
              setSelectedSkill("NONE");
            }}
            disabled={isAnimating}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              gameMode === "PVE"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            🤖 人機對戰
          </button>
          <button
            type="button"
            onClick={() => {
              setGameMode("AI_VS_AI");
              setSelectedSkill("NONE");
              setIsGodMode(true);
              setIsAiPlaying(true);
            }}
            disabled={isAnimating}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              gameMode === "AI_VS_AI"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            ⚔️ 雙 AI 演示
          </button>
        </div>

        {/* AI vs AI Spectator Controls Toolbar */}
        {gameMode === "AI_VS_AI" && (
          <div className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-950/50 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setIsAiPlaying(!isAiPlaying);
              }}
              disabled={isGameOver}
              className={cn(
                "cursor-pointer rounded px-2.5 py-1 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                isAiPlaying
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-500",
              )}
            >
              {isAiPlaying ? "⏸️ 暫停" : "▶️ 繼續"}
            </button>
            <button
              type="button"
              onClick={onAiStep}
              disabled={isAnimating || isGameOver || isAiPlaying}
              title="單步執行 AI 決策"
              className="cursor-pointer rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⏭️ 單步
            </button>
            <button
              type="button"
              onClick={() => {
                setAiSpeed(aiSpeed === "NORMAL" ? "FAST" : "NORMAL");
              }}
              className="cursor-pointer rounded bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-purple-300 hover:bg-slate-700"
            >
              {aiSpeed === "NORMAL" ? "1x 正常" : "2x 快速"}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            const nextMuted = toggleAudioMuted();
            setIsMuted(nextMuted);
          }}
          className={cn(
            "cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors",
            isMuted
              ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
              : "border border-sky-500/40 bg-sky-950/40 text-sky-200 hover:bg-sky-900/60",
          )}
        >
          {isMuted ? "🔇 靜音" : "🔊 音效開啟"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (gameMode !== "PVE") {
              setIsGodMode(!isGodMode);
            }
          }}
          disabled={isAnimating || gameMode === "PVE"}
          title={gameMode === "PVE" ? "人機對戰時強制維持玩家視角" : undefined}
          className={cn(
            "cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            gameMode === "PVE"
              ? "border border-slate-700 bg-slate-800 text-slate-400"
              : isGodMode
                ? "bg-purple-700 text-white hover:bg-purple-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700",
          )}
        >
          {gameMode === "PVE"
            ? "戰爭迷霧（玩家視角）"
            : isGodMode
              ? "上帝視角（全揭示）"
              : "戰爭迷霧（玩家視角）"}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={isAnimating}
          className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          重設對局
        </button>
        <button
          type="button"
          onClick={() => {
            if (isReplayMode) {
              onExitReplay();
            } else {
              onOpenReplay();
            }
          }}
          disabled={isAnimating || recordedTurns === 0}
          title={
            recordedTurns === 0
              ? "尚無已下棋步可回放"
              : isReplayMode
                ? "結束回放模式"
                : "進入對局重播模式"
          }
          className={cn(
            "cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40",
            isReplayMode
              ? "border border-indigo-400 bg-indigo-600 text-white shadow-md ring-1 ring-indigo-400"
              : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white",
          )}
        >
          🎬 {isReplayMode ? "結束回放" : "對局回放"}
          {recordedTurns > 0 ? ` (${recordedTurns.toString()})` : ""}
        </button>
        <button
          type="button"
          onClick={onOpenExport}
          disabled={isAnimating || recordedTurns === 0}
          title={recordedTurns === 0 ? "尚無已下棋步可匯出" : "匯出 HBC-PGN / JSON 棋譜"}
          className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          📥 匯出
        </button>
        <button
          type="button"
          onClick={onOpenImport}
          disabled={isAnimating}
          title="載入 HBC-PGN 或 JSON 外部棋譜"
          className="cursor-pointer rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          📤 載入
        </button>
      </div>
    </header>
  );
}

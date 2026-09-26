import type { MatchStepRecord, ReplaySession } from "../engine/replay.ts";
import { coordToAlgebraic } from "../engine/replay.ts";
import type { SkillType } from "../engine/types.ts";

export interface ReplayControlsProps {
  session: ReplaySession;
  replayIndex: number;
  isPlaying: boolean;
  speed: "0.5x" | "1x" | "2x";
  viewerId: number | null;
  onStepChange: (index: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: "0.5x" | "1x" | "2x") => void;
  onViewerChange: (viewerId: number | null) => void;
  onExitReplay: () => void;
  onOpenExport: () => void;
}

const SKILL_NAMES: Record<SkillType, { name: string; color: string }> = {
  NONE: { name: "常規棋", color: "text-slate-300" },
  WALL: { name: "翡翠城壁", color: "text-emerald-400" },
  PIERCE: { name: "天空守望者", color: "text-cyan-400" },
  BOMB: { name: "殺戮盛宴", color: "text-rose-400" },
  PURIFY: { name: "救贖之光", color: "text-amber-400" },
  COUNTER: { name: "深淵復仇者", color: "text-purple-400" },
};

function formatEventSummary(step: MatchStepRecord): string[] {
  const summaries: string[] = [];

  for (const ev of step.events) {
    switch (ev.type) {
      case "PIONEER_PLACED":
        summaries.push("開拓落子（建立領域連通橋樑）");
        break;
      case "FLIP_BATCH":
        summaries.push(`翻轉 ${ev.coords.length.toString()} 顆棋子`);
        break;
      case "RAYCAST_BLOCKED":
        summaries.push("翡翠城壁 格擋！");
        break;
      case "PIECE_REVEALED":
        if (ev.reason === "PENETRATE") {
          summaries.push("天空守望者 貫穿！");
        }
        break;
      case "BOMB_TRIGGERED":
        summaries.push(
          `殺戮盛宴 引爆！（波及 ${ev.blastCoords.length.toString()} 顆）`,
        );
        break;
      case "COUNTER_TRIGGERED":
        summaries.push(
          `深淵復仇者 反擊！（逆轉 ${ev.reversedCoords.length.toString()} 顆）`,
        );
        break;
      case "PURIFY_PULSE":
        summaries.push(
          `救贖之光 淨化！（感化 ${ev.affectedCoords.length.toString()} 顆）`,
        );
        break;
      case "GAME_OVER":
        summaries.push("對局分出勝負（遊戲結束）");
        break;
    }
  }

  if (step.action.type === "PASS_TURN") {
    summaries.push("無合法落子點，跳過回合");
  }

  return summaries;
}

export function ReplayControls({
  session,
  replayIndex,
  isPlaying,
  speed,
  viewerId,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
  onViewerChange,
  onExitReplay,
  onOpenExport,
}: ReplayControlsProps) {
  const totalSteps = session.getTotalSteps();
  const currentStep = session.getCurrentStep();
  const canPrev = session.canStepBackward();
  const canNext = session.canStepForward();

  const handleNextSpeed = () => {
    if (speed === "0.5x") onSpeedChange("1x");
    else if (speed === "1x") onSpeedChange("2x");
    else onSpeedChange("0.5x");
  };

  const summaries = currentStep ? formatEventSummary(currentStep) : [];

  return (
    <div className="mb-4 flex w-full flex-col gap-3 rounded-xl border border-indigo-500/50 bg-slate-950/90 p-4 shadow-xl backdrop-blur-md">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/30 text-base ring-1 ring-indigo-400">
            🎬
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-wide text-white">
              對局重播模式 (Visual Replay)
            </h3>
            <p className="text-[11px] text-indigo-300">
              {replayIndex === -1
                ? "開局初始佈局（Turn 0）"
                : `第 ${(replayIndex + 1).toString()} / ${totalSteps.toString()} 手 · 回合 ${currentStep?.turnNumber.toString() ?? ""}`}
            </p>
          </div>
        </div>

        {/* Perspective and Exit buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Fog-of-War Perspective Switcher */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
            <span className="px-1.5 text-[10px] text-slate-400">視角：</span>
            <button
              type="button"
              onClick={() => {
                onViewerChange(null);
              }}
              className={`cursor-pointer rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                viewerId === null
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              上帝視角
            </button>
            <button
              type="button"
              onClick={() => {
                onViewerChange(1);
              }}
              className={`cursor-pointer rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                viewerId === 1
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              黑方視角
            </button>
            <button
              type="button"
              onClick={() => {
                onViewerChange(2);
              }}
              className={`cursor-pointer rounded px-2 py-0.5 text-xs font-semibold transition-all ${
                viewerId === 2
                  ? "bg-slate-300 text-slate-950 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              白方視角
            </button>
          </div>

          {/* Export PGN/JSON button */}
          <button
            type="button"
            onClick={onOpenExport}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            📥 匯出棋譜
          </button>

          {/* Exit Replay Mode */}
          <button
            type="button"
            onClick={onExitReplay}
            className="cursor-pointer rounded-lg bg-rose-600/80 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-500"
          >
            ✕ 結束回放
          </button>
        </div>
      </div>

      {/* Scrubber Timeline */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
          <span>開局初始 (0)</span>
          <span className="font-mono text-indigo-300">
            {replayIndex === -1
              ? "初始盤面"
              : `落子第 ${(replayIndex + 1).toString()} 手`}
          </span>
          <span>終局 (第 {totalSteps.toString()} 手)</span>
        </div>
        <input
          type="range"
          min={-1}
          max={totalSteps - 1}
          value={replayIndex}
          onChange={(e) => {
            onStepChange(parseInt(e.target.value, 10));
          }}
          className="h-2 w-full cursor-pointer rounded-lg bg-slate-800 accent-indigo-500"
        />
      </div>

      {/* Playback Transport Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Jump to start */}
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              onStepChange(-1);
            }}
            title="回到開局"
            className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ⏮ 首步
          </button>

          {/* Previous step */}
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              if (canPrev) onStepChange(replayIndex - 1);
            }}
            title="上一手"
            className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ◀ 上一手
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={totalSteps === 0}
            className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-black transition-all ${
              isPlaying
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {isPlaying ? "⏸ 暫停" : "▶ 自動播放"}
          </button>

          {/* Next step */}
          <button
            type="button"
            disabled={!canNext}
            onClick={() => {
              if (canNext) onStepChange(replayIndex + 1);
            }}
            title="下一手"
            className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            下一手 ▶
          </button>

          {/* Jump to end */}
          <button
            type="button"
            disabled={!canNext}
            onClick={() => {
              onStepChange(totalSteps - 1);
            }}
            title="前往終局"
            className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            末步 ⏭
          </button>

          {/* Playback speed toggle */}
          <button
            type="button"
            onClick={handleNextSpeed}
            className="cursor-pointer rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-1.5 font-mono text-xs font-bold text-indigo-300 hover:bg-indigo-900/60"
          >
            {speed}
          </button>
        </div>

        {/* Current Move Notation Badge */}
        {currentStep && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
            <span className="font-mono font-semibold text-slate-400">
              {currentStep.notation}
            </span>
          </div>
        )}
      </div>

      {/* Step Event Narrative Card */}
      {currentStep && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                currentStep.playerId === 1
                  ? "bg-zinc-800 text-white ring-1 ring-zinc-500"
                  : "bg-slate-200 text-slate-900 ring-1 ring-slate-400"
              }`}
            >
              {currentStep.playerId === 1 ? "第一隊（黑方）" : "第二隊（白方）"}
            </span>

            {currentStep.action.type === "PLACE_PIECE" && (
              <>
                <span className="text-slate-300">落子於</span>
                <span className="font-mono font-black text-amber-300">
                  {coordToAlgebraic(currentStep.action.coord)} (
                  {currentStep.action.coord.x.toString()},{" "}
                  {currentStep.action.coord.y.toString()})
                </span>
                <span className="text-slate-300">部署棋子：</span>
                <span
                  className={`font-bold ${SKILL_NAMES[currentStep.action.skillType ?? "NONE"].color}`}
                >
                  {SKILL_NAMES[currentStep.action.skillType ?? "NONE"].name}
                </span>
              </>
            )}

            {currentStep.action.type === "PASS_TURN" && (
              <span className="font-bold text-amber-400">跳過回合 (PASS)</span>
            )}
          </div>

          {/* Event Narrative List */}
          {summaries.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {summaries.map((text, idx) => (
                <span
                  key={`${text}-${idx.toString()}`}
                  className="rounded border border-indigo-500/30 bg-indigo-950/40 px-2 py-0.5 text-[11px] font-medium text-indigo-200"
                >
                  {text}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

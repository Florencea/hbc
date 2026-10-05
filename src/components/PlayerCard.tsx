import type { Player, SkillType } from "../engine/types.ts";
import { SKILL_SPECS } from "../engine/types.ts";
import { cn } from "../lib/cn.ts";
import { SKILL_CONFIG, SKILL_OPTIONS, type GameMode } from "./gameUiConstants.ts";
import { SkillDetailTooltip } from "./SkillDetailTooltip.tsx";

export interface PlayerCardProps {
  teamId: 1 | 2;
  player: Player | undefined;
  isActive: boolean;
  isAi: boolean;
  isGodMode: boolean;
  specialsCount: number;
  boardPieceCount: number;
  isAnimating: boolean;
  effectiveSkill: SkillType;
  onSelectSkill: (skill: SkillType) => void;
  gameMode: GameMode;
}

export function PlayerCard({
  teamId,
  player,
  isActive,
  isAi,
  isGodMode,
  specialsCount,
  boardPieceCount,
  isAnimating,
  effectiveSkill,
  onSelectSkill,
  gameMode,
}: PlayerCardProps) {
  const isTeam1 = teamId === 1;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition-all",
        isActive
          ? isTeam1
            ? "border-zinc-500/80 bg-slate-950 shadow-lg ring-1 shadow-zinc-950/50 ring-zinc-500/40"
            : "border-slate-300/80 bg-slate-950 shadow-lg ring-1 shadow-slate-200/20 ring-slate-300/40"
          : "border-slate-800/80 bg-slate-950/60 opacity-80",
      )}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full border shadow-xs ring-1",
              isTeam1
                ? "border-zinc-500 bg-zinc-950 ring-zinc-700/60"
                : "border-slate-300 bg-white ring-slate-200/80",
            )}
          />
          <span className="text-xs font-bold text-slate-200">
            {isTeam1 ? "第一隊（黑方）" : "第二隊（白方）"}
            {isAi ? " (AI 電腦)" : ""}
          </span>
          {isActive ? (
            <span
              className={cn(
                "animate-pulse rounded border px-2 py-0.5 text-[10px] font-bold",
                isTeam1
                  ? "border-zinc-500/40 bg-zinc-800/60 text-zinc-200"
                  : "border-slate-300/40 bg-slate-100/20 text-slate-200",
              )}
            >
              {isAi ? "思考中" : "行動中"}
            </span>
          ) : (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
              等待中
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isAi && player?.isForcedSpecial && (
            <span className="animate-pulse rounded border border-amber-500/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300 ring-1 ring-amber-400/40">
              ⚡ 強制特技
            </span>
          )}
          <span className="rounded-md border border-purple-400/60 bg-purple-950/80 px-2.5 py-0.5 text-[11px] font-black text-purple-200 shadow-sm ring-1 ring-purple-500/40">
            特技: {isAi && !isGodMode ? "迷霧隱藏" : `${specialsCount.toString()} 枚`}
          </span>
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px] font-black shadow-xs",
              isTeam1
                ? "border-zinc-700 bg-zinc-900 text-zinc-200"
                : "border-slate-300/40 bg-slate-800/80 text-slate-200",
            )}
          >
            盤面: {boardPieceCount.toString()} 顆
          </span>
        </div>
      </div>

      {/* AI Fog Mode or Interactive Hand Buttons */}
      {isAi && !isGodMode ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <span className="font-bold text-slate-200">
                AI 電腦決策核心（{isTeam1 ? "黑方" : "白方"}）
              </span>
            </div>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold",
                isActive
                  ? isTeam1
                    ? "animate-pulse border border-zinc-500/50 bg-zinc-800/60 text-zinc-200"
                    : "animate-pulse border border-slate-400/50 bg-slate-700/60 text-slate-200"
                  : "bg-slate-800 text-slate-400",
              )}
            >
              {isActive ? "即時運算中" : "待命狀態"}
            </span>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            {gameMode === "PVE" && !isTeam1
              ? "單人對戰模式：電腦戰略佈局與特技手牌均受戰爭迷霧嚴格保護，不公開顯示。"
              : `演示模式：${isTeam1 ? "黑方" : "白方"}戰略佈局與特技手牌受戰爭迷霧保護（切換為上帝視角可查看完整手牌）。`}
          </p>

          <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-400">
            <span>戰術策略：全域啟發式權重評估</span>
            <span className="font-mono font-bold text-zinc-300">MEDIUM</span>
          </div>
        </div>
      ) : (
        <>
          {player?.isForcedSpecial && isActive && (
            <div className="flex items-center justify-between rounded-md border border-amber-500/60 bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold">
                <span>⚡</span>
                <span className="text-amber-300">強制特技</span>
              </div>
              <span className="text-[11px] text-amber-200/80">
                {isAi
                  ? `AI 已選【${SKILL_CONFIG[effectiveSkill].label.split(" ")[0] ?? ""}】`
                  : "庫存已滿・限落特殊棋"}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {SKILL_OPTIONS.map((opt, optIdx) => {
              const isNone = opt.type === "NONE";
              const spec = opt.type !== "NONE" ? SKILL_SPECS[opt.type] : null;
              const count = isNone ? Infinity : (player?.hand[opt.type] ?? 0);
              const maxHand = spec?.maxHand ?? Infinity;
              const charge = isNone ? 0 : (player?.charge[opt.type] ?? 0);
              const cd = spec?.cd ?? 0;

              const isOutOfStock = !isNone && count <= 0;
              const isForbidden = isNone && (player?.isForcedSpecial ?? false);
              const isDisabled = isAnimating || !isActive || isOutOfStock || isForbidden || isAi;
              const isSelected = isActive && effectiveSkill === opt.type;
              const config = SKILL_CONFIG[opt.type];

              return (
                <div
                  key={opt.type}
                  className="group relative flex flex-col focus-within:z-30 hover:z-30"
                >
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isActive && !isDisabled) {
                        onSelectSkill(opt.type);
                      }
                    }}
                    aria-label={`${config.label}，庫存 ${count.toString()} 枚`}
                    className={cn(
                      "flex h-full w-full flex-col justify-between rounded-lg border p-2 text-left transition-all",
                      isSelected &&
                        (isTeam1
                          ? "border-zinc-300 bg-zinc-900 text-white shadow-lg ring-2 shadow-zinc-950/50 ring-zinc-400/80"
                          : "border-slate-200 bg-slate-800 text-white shadow-lg ring-2 shadow-slate-200/20 ring-slate-300/80"),
                      !isSelected &&
                        isDisabled &&
                        "cursor-not-allowed border-slate-800/60 bg-slate-900/20 text-slate-500 opacity-45",
                      !isSelected &&
                        !isDisabled &&
                        count > 0 &&
                        !isNone &&
                        (count >= maxHand
                          ? "hover:bg-slate-850 cursor-pointer border-amber-500/50 bg-slate-900/90 text-slate-100 shadow-xs hover:border-amber-400"
                          : isTeam1
                            ? "hover:bg-slate-850 cursor-pointer border-zinc-600/60 bg-slate-900/90 text-slate-100 shadow-xs hover:border-zinc-400"
                            : "hover:bg-slate-850 cursor-pointer border-slate-400/40 bg-slate-900/90 text-slate-100 shadow-xs hover:border-slate-300"),
                      !isSelected &&
                        !isDisabled &&
                        (isNone || count <= 0) &&
                        cn(config.buttonStyle, "cursor-pointer opacity-85 hover:opacity-100"),
                    )}
                  >
                    {/* Piece Name & Stock */}
                    <div className="flex w-full items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border shadow-xs ring-1",
                            isTeam1
                              ? "border-zinc-600 bg-zinc-950 text-zinc-100 ring-zinc-700/60"
                              : "border-slate-300 bg-white text-slate-900 ring-slate-200/80",
                          )}
                        >
                          {config.code ? (
                            <span
                              className={cn(
                                "flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black",
                                config.annotationStyle,
                              )}
                            >
                              {config.code}
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate text-xs leading-tight font-bold">
                          {opt.label.split(" ")[0]}
                        </span>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          isNone && "border border-slate-700 bg-slate-800 text-slate-300",
                          !isNone &&
                            count >= maxHand &&
                            "border border-amber-400/80 bg-amber-500/20 text-amber-300",
                          !isNone &&
                            count < maxHand &&
                            count > 0 &&
                            "border border-emerald-400/80 bg-emerald-500/20 text-emerald-300",
                          !isNone &&
                            count <= 0 &&
                            "border border-slate-800 bg-slate-900/80 text-slate-500",
                        )}
                      >
                        {isNone ? "∞" : `${count.toString()}/${maxHand.toString()}`}
                      </span>
                    </div>

                    {/* Status / Cooldown */}
                    <div className="mt-1.5 w-full border-t border-slate-800/80 pt-1">
                      {isForbidden ? (
                        <span className="text-[10px] font-medium text-rose-400">🚫 禁落常規棋</span>
                      ) : isNone ? (
                        <span className="text-[10px] text-slate-400">無限庫存</span>
                      ) : count >= maxHand ? (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-amber-300">就緒 MAX</span>
                          <span className="font-mono text-[9px] text-amber-400/90">可部署</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className={count === 0 ? "text-amber-400/90" : "text-slate-400"}>
                              {count === 0 ? "充能中" : "充能"}
                            </span>
                            <span className="font-mono font-bold text-slate-300">
                              {charge.toString()}/{cd.toString()}
                            </span>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                count === 0
                                  ? charge >= cd - 1
                                    ? "bg-amber-400"
                                    : "bg-amber-600/80"
                                  : charge >= cd - 1
                                    ? isTeam1
                                      ? "bg-zinc-300"
                                      : "bg-slate-200"
                                    : isTeam1
                                      ? "bg-zinc-500"
                                      : "bg-slate-400",
                              )}
                              style={{
                                width: `${Math.min(100, Math.round((charge / cd) * 100)).toString()}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Hover Skill Explanation Card */}
                  <SkillDetailTooltip skillType={opt.type} index={optIdx} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

import type { SkillType } from "../engine/index.ts";
import { cn } from "../lib/cn.ts";
import { SKILL_CONFIG, SKILL_DETAILS } from "./gameUiConstants.ts";

export interface SkillDetailTooltipProps {
  skillType: SkillType;
  index: number;
}

export function SkillDetailTooltip({ skillType, index }: SkillDetailTooltipProps) {
  const detail = SKILL_DETAILS[skillType];
  const config = SKILL_CONFIG[skillType];
  const isTopRow = index < 2;
  const isLeftCol = index % 2 === 0;

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 w-72 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md transition-all duration-150 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
        isTopRow ? "top-full mt-2" : "bottom-full mb-2",
        isLeftCol ? "left-0" : "right-0",
      )}
    >
      {/* Card Header: Icon + Name + Role + Badge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] font-black">
            {config.code ? (
              <span className={config.annotationStyle}>{config.code}</span>
            ) : (
              <span className="text-[10px] text-slate-400">●</span>
            )}
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-slate-100">{detail.name}</span>
            <span className="text-[10px] text-slate-400">{detail.role}</span>
          </div>
        </div>
        <span
          className={cn("rounded border px-1.5 py-0.5 text-[9px] font-bold", detail.badgeColor)}
        >
          {detail.badge}
        </span>
      </div>

      {/* Parameters: Cooldown, Hand Cap, Trigger Timing */}
      <div className="my-2 grid grid-cols-3 gap-1 rounded-lg border border-slate-800/80 bg-slate-900/70 p-1.5 text-center text-[10px]">
        <div className="flex flex-col">
          <span className="text-slate-400">冷卻時間</span>
          <span className="font-mono font-bold text-amber-300">{detail.cdText}</span>
        </div>
        <div className="flex flex-col border-x border-slate-800/80">
          <span className="text-slate-400">手牌上限</span>
          <span className="font-mono font-bold text-emerald-300">{detail.maxHandText}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400">觸發機制</span>
          <span className="font-bold text-sky-300">{detail.trigger}</span>
        </div>
      </div>

      {/* Effects & Tactical Tips */}
      <div className="space-y-1.5 text-[11px] leading-relaxed">
        <div>
          <span className="font-bold text-slate-200">【作用效果】</span>
          <p className="mt-0.5 text-slate-300/90">{detail.effect}</p>
        </div>
        <div>
          <span className="font-bold text-amber-300/90">【戰術建議】</span>
          <p className="mt-0.5 text-slate-400">{detail.tactics}</p>
        </div>
      </div>
    </div>
  );
}

import type { Coord } from "../engine/types.ts";
import type { CombatTextVariant } from "../fx/choreography.ts";

export interface CombatTextItem {
  id: string;
  text: string;
  coord: Coord;
  variant: CombatTextVariant;
}

interface FloatingCombatTextProps {
  items: CombatTextItem[];
  boardSize: number;
}

function getVariantBadgeClass(variant: CombatTextVariant): string {
  switch (variant) {
    case "blocked":
      return "border-emerald-400/90 bg-slate-950/95 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.6)] ring-1 ring-emerald-400/50";
    case "counter":
      return "border-purple-400/90 bg-purple-950/95 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.7)] ring-1 ring-purple-400/60";
    case "bomb":
      return "border-rose-400/90 bg-rose-950/95 text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.75)] ring-1 ring-rose-400/60";
    case "purify":
      return "border-amber-300/95 bg-amber-950/95 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.75)] ring-1 ring-amber-300/60";
    case "pierce":
      return "border-cyan-300/95 bg-cyan-950/95 text-cyan-200 shadow-[0_0_18px_rgba(56,189,248,0.75)] ring-1 ring-cyan-300/60";
  }
}

export function FloatingCombatText({
  items,
  boardSize,
}: FloatingCombatTextProps) {
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {items.map((item) => {
        const leftPercent = ((item.coord.x + 0.5) / boardSize) * 100;
        const topPercent = ((item.coord.y + 0.5) / boardSize) * 100;

        return (
          <div
            key={item.id}
            className="animate-float-combat absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap select-none"
            style={{
              left: `${leftPercent.toString()}%`,
              top: `${topPercent.toString()}%`,
            }}
          >
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase shadow-lg backdrop-blur-xs sm:text-xs ${getVariantBadgeClass(
                item.variant,
              )}`}
            >
              {item.variant === "bomb" && <span>💥</span>}
              {item.variant === "counter" && <span>🌌</span>}
              {item.variant === "purify" && <span>✨</span>}
              {item.variant === "blocked" && <span>🛡️</span>}
              {item.variant === "pierce" && <span>🏹</span>}
              <span>{item.text}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

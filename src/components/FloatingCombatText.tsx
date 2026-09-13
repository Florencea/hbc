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
      return "border-emerald-500/80 bg-slate-950/95 text-emerald-300 shadow-emerald-950/50 ring-1 ring-emerald-400/40";
    case "counter":
      return "border-purple-500/80 bg-purple-950/95 text-purple-200 shadow-purple-950/60 ring-1 ring-purple-400/50";
    case "bomb":
      return "border-rose-500/80 bg-rose-950/95 text-rose-200 shadow-rose-950/60 ring-1 ring-rose-400/50";
    case "purify":
      return "border-amber-400/80 bg-amber-950/95 text-amber-200 shadow-amber-950/60 ring-1 ring-amber-400/50";
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
              <span>{item.text}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

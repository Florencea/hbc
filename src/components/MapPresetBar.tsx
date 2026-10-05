import type { MapPreset } from "../engine/index.ts";
import { cn } from "../lib/cn.ts";
import { MAP_PRESETS } from "./gameUiConstants.ts";

export interface MapPresetBarProps {
  selectedPreset: MapPreset;
  isAnimating: boolean;
  neutralCount: number;
  onSelectPreset: (preset: MapPreset) => void;
}

export function MapPresetBar({
  selectedPreset,
  isAnimating,
  neutralCount,
  onSelectPreset,
}: MapPresetBarProps) {
  return (
    <section className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
          地圖預設：
        </span>
        <div className="flex flex-wrap gap-2">
          {MAP_PRESETS.map(({ preset, label, desc }) => {
            const isSelected = selectedPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={isAnimating}
                onClick={() => {
                  onSelectPreset(preset);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-400"
                    : "cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white",
                )}
              >
                <span>{label}</span>
                <span
                  className={cn("text-[10px]", isSelected ? "text-blue-200" : "text-slate-400")}
                >
                  ({desc})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
          <span className="text-amber-400">⚓ 中立錨點：</span>{" "}
          <span className="font-bold text-white">{neutralCount.toString()}</span> 顆
        </span>
      </div>
    </section>
  );
}

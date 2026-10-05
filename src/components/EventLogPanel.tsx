import type { GameEvent } from "../engine/types.ts";
import { EVENT_TYPE_LABELS } from "./gameUiConstants.ts";

export interface EventLogPanelProps {
  eventLogs: GameEvent[];
}

export function EventLogPanel({ eventLogs }: EventLogPanelProps) {
  return (
    <div className="flex min-h-64 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          事件溯源日誌串流
        </span>
        <span className="text-xs text-slate-500">{eventLogs.length.toString()} 筆事件</span>
      </div>

      <div className="max-h-72 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
        {eventLogs.length === 0 ? (
          <div className="py-4 text-center text-slate-500 italic">
            尚無事件。落子以觸發引擎狀態轉移。
          </div>
        ) : (
          eventLogs.map((ev, idx) => (
            <div
              key={`${ev.type}-${idx.toString()}`}
              className="flex flex-col gap-1 rounded border border-slate-800/80 bg-slate-900 p-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-400">{ev.type}</span>
                  {EVENT_TYPE_LABELS[ev.type] && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {EVENT_TYPE_LABELS[ev.type]}
                    </span>
                  )}
                </div>
                {ev.type === "DROP_PHASE_STARTED" && (
                  <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                    地圖預設：{ev.mapPreset}
                  </span>
                )}
                {ev.type === "PIONEER_PLACED" && (
                  <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                    拓荒橋樑 ({ev.coord.x.toString()}, {ev.coord.y.toString()})
                  </span>
                )}
                {ev.type === "DROP_PHASE_ENDED" && (
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                    全域對局已啟動
                  </span>
                )}
                {ev.type === "RAYCAST_BLOCKED" && (
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                    翡翠城壁格擋
                  </span>
                )}
                {ev.type === "COUNTER_TRIGGERED" && (
                  <span className="rounded border border-purple-500/40 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                    深淵復仇者反擊
                  </span>
                )}
                {ev.type === "BOMB_TRIGGERED" && (
                  <span className="rounded border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                    殺戮盛宴引爆
                  </span>
                )}
                {ev.type === "PURIFY_PULSE" && (
                  <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                    救贖之光淨化
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">{JSON.stringify(ev)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

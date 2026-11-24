import { el } from "./dom.js";
import { EVENT_TYPE_LABELS } from "./gameUiConstants.js";

function renderEventTag(ev) {
  switch (ev.type) {
    case "DROP_PHASE_STARTED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "amber" } },
        `地圖預設：${ev.mapPreset}`,
      );
    case "PIONEER_PLACED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "amber" } },
        `拓荒橋樑 (${ev.coord.x}, ${ev.coord.y})`,
      );
    case "DROP_PHASE_ENDED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "emerald" } },
        "全域對局已啟動",
      );
    case "RAYCAST_BLOCKED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "emerald" } },
        "翡翠城壁格擋",
      );
    case "COUNTER_TRIGGERED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "purple" } },
        "深淵復仇者反擊",
      );
    case "BOMB_TRIGGERED":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "amber" } },
        "殺戮盛宴引爆",
      );
    case "PURIFY_PULSE":
      return el(
        "span",
        { className: "mono-pill", dataset: { tone: "amber" } },
        "救贖之光淨化",
      );
    default:
      return null;
  }
}

function createEventItem(ev) {
  const label = EVENT_TYPE_LABELS[ev.type];
  return el(
    "li",
    { className: "event-log-item" },
    el(
      "div",
      { className: "event-log-item-head" },
      el(
        "div",
        { className: "player-identity" },
        el("span", { className: "event-log-type" }, ev.type),
        label
          ? el(
              "span",
              { className: "mono-pill", dataset: { tone: "slate" } },
              label,
            )
          : null,
      ),
      renderEventTag(ev),
    ),
    el("span", { className: "event-log-payload" }, JSON.stringify(ev)),
  );
}

export function createEventLogPanel() {
  const countOutput = el("output", { className: "preset-desc" }, "0 筆事件");
  const listEl = el("ol", {
    className: "event-log-list",
    "aria-label": "事件溯源日誌",
  });
  const emptyEl = el(
    "div",
    { className: "event-log-empty" },
    "尚無事件。落子以觸發引擎狀態轉移。",
  );

  const element = el(
    "section",
    { className: "panel-card event-log-panel" },
    el(
      "div",
      { className: "telemetry-header" },
      el("h2", { className: "section-kicker" }, "事件溯源日誌串流"),
      countOutput,
    ),
    emptyEl,
    listEl,
  );

  let lastLogsRef = null;

  function update(eventLogs) {
    if (eventLogs === lastLogsRef) return;
    lastLogsRef = eventLogs;

    countOutput.textContent = `${eventLogs.length} 筆事件`;
    if (eventLogs.length === 0) {
      emptyEl.hidden = false;
      listEl.hidden = true;
      listEl.replaceChildren();
      return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    const frag = document.createDocumentFragment();
    for (const ev of eventLogs) {
      frag.appendChild(createEventItem(ev));
    }
    listEl.replaceChildren(frag);
  }

  return { element, update };
}

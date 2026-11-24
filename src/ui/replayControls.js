import { coordToAlgebraic } from "../engine/replay.js";
import { el, setBoolAttr } from "./dom.js";

const SKILL_NAMES = Object.freeze({
  NONE: { name: "常規棋", cls: "" },
  WALL: { name: "翡翠城壁", cls: "text-emerald" },
  PIERCE: { name: "天空守望者", cls: "text-cyan" },
  BOMB: { name: "殺戮盛宴", cls: "text-rose" },
  PURIFY: { name: "救贖之光", cls: "text-amber" },
  COUNTER: { name: "深淵復仇者", cls: "text-purple" },
});

function formatEventSummary(step) {
  const summaries = [];
  for (const ev of step.events) {
    switch (ev.type) {
      case "PIONEER_PLACED":
        summaries.push("開拓落子（建立領域連通橋樑）");
        break;
      case "FLIP_BATCH":
        summaries.push(`翻轉 ${ev.coords.length} 顆棋子`);
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
        summaries.push(`殺戮盛宴 引爆！（波及 ${ev.blastCoords.length} 顆）`);
        break;
      case "COUNTER_TRIGGERED":
        summaries.push(
          `深淵復仇者 反擊！（逆轉 ${ev.reversedCoords.length} 顆）`,
        );
        break;
      case "PURIFY_PULSE":
        summaries.push(
          `救贖之光 淨化！（感化 ${ev.affectedCoords.length} 顆）`,
        );
        break;
      case "GAME_OVER":
        summaries.push("對局分出勝負（遊戲結束）");
        break;
      default:
        break;
    }
  }
  if (step.action.type === "PASS_TURN") {
    summaries.push("無合法落子點，跳過回合");
  }
  return summaries;
}

export function createReplayControls(actions, signal) {
  const subtitleEl = el("p", { className: "preset-desc text-indigo" });
  const viewGodBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: { click: () => actions.onViewerChange(null) },
    },
    "上帝視角",
  );
  const viewBlackBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: { click: () => actions.onViewerChange(1) },
    },
    "黑方視角",
  );
  const viewWhiteBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: { click: () => actions.onViewerChange(2) },
    },
    "白方視角",
  );

  const exportBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: actions.onOpenExport },
    },
    "📥 匯出棋譜",
  );

  const exitBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-danger",
      signal,
      on: { click: actions.onExitReplay },
    },
    "✕ 結束回放",
  );

  const stepOutput = el("output", { className: "text-mono text-indigo" });
  const endLabelEl = el("span");
  const rangeInput = el("input", {
    id: "replay-scrubber",
    type: "range",
    min: "-1",
    max: "0",
    value: "-1",
    signal,
    on: {
      input: (event) => {
        actions.onStepChange(Number.parseInt(event.currentTarget.value, 10));
      },
    },
  });

  const firstBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: () => actions.onStepChange(-1) },
    },
    "⏮ 首步",
  );
  const prevBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: actions.onStepPrev },
    },
    "◀ 上一手",
  );
  const playBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-indigo",
      signal,
      on: { click: actions.onTogglePlay },
    },
    "▶ 自動播放",
  );
  const nextBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: actions.onStepNext },
    },
    "下一手 ▶",
  );
  const lastBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: actions.onStepLast },
    },
    "末步 ⏭",
  );
  const speedBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral text-mono text-indigo",
      signal,
      on: { click: actions.onCycleSpeed },
    },
    "1x",
  );

  const notationBox = el("span", {
    className: "mono-pill",
    dataset: { tone: "slate" },
    hidden: true,
  });
  const narrativeEl = el("div", {
    className: "replay-narrative",
    hidden: true,
  });

  const element = el(
    "section",
    { className: "replay-panel app-container", hidden: true },
    el(
      "div",
      { className: "replay-header" },
      el(
        "div",
        { className: "replay-title-wrap" },
        el(
          "span",
          { className: "replay-icon-box", "aria-hidden": "true" },
          "🎬",
        ),
        el(
          "div",
          null,
          el(
            "h2",
            { className: "player-name" },
            "對局重播模式 (Visual Replay)",
          ),
          subtitleEl,
        ),
      ),
      el(
        "div",
        { className: "header-toolbar" },
        el(
          "div",
          {
            className: "segmented-group",
            role: "group",
            "aria-label": "重播視角",
          },
          el("span", { className: "preset-desc" }, "視角："),
          viewGodBtn,
          viewBlackBtn,
          viewWhiteBtn,
        ),
        exportBtn,
        exitBtn,
      ),
    ),
    el(
      "div",
      { className: "replay-scrubber" },
      el(
        "label",
        { for: "replay-scrubber", className: "replay-scrubber-labels" },
        el("span", null, "開局初始 (0)"),
        stepOutput,
        endLabelEl,
      ),
      rangeInput,
    ),
    el(
      "div",
      { className: "replay-transport" },
      el(
        "div",
        { className: "header-toolbar" },
        firstBtn,
        prevBtn,
        playBtn,
        nextBtn,
        lastBtn,
        speedBtn,
      ),
      notationBox,
    ),
    narrativeEl,
  );

  function update(vm) {
    if (!vm.isReplayMode || !vm.session) {
      element.hidden = true;
      return;
    }
    element.hidden = false;

    const totalSteps = vm.session.getTotalSteps();
    const currentStep = vm.session.getCurrentStep();
    const canPrev = vm.session.canStepBackward();
    const canNext = vm.session.canStepForward();

    subtitleEl.textContent =
      vm.replayIndex === -1
        ? "開局初始佈局（Turn 0）"
        : `第 ${vm.replayIndex + 1} / ${totalSteps} 手 · 回合 ${currentStep?.turnNumber ?? ""}`;

    viewGodBtn.className = `btn ${vm.viewerId === null ? "btn-purple" : "btn-subtle"}`;
    viewBlackBtn.className = `btn ${vm.viewerId === 1 ? "btn-neutral" : "btn-subtle"}`;
    viewWhiteBtn.className = `btn ${vm.viewerId === 2 ? "btn-primary" : "btn-subtle"}`;

    stepOutput.textContent =
      vm.replayIndex === -1 ? "初始盤面" : `落子第 ${vm.replayIndex + 1} 手`;
    endLabelEl.textContent = `終局 (第 ${totalSteps} 手)`;
    rangeInput.max = String(Math.max(-1, totalSteps - 1));
    rangeInput.value = String(vm.replayIndex);

    setBoolAttr(firstBtn, "disabled", !canPrev);
    setBoolAttr(prevBtn, "disabled", !canPrev);
    setBoolAttr(playBtn, "disabled", totalSteps === 0);
    setBoolAttr(nextBtn, "disabled", !canNext);
    setBoolAttr(lastBtn, "disabled", !canNext);

    playBtn.textContent = vm.isPlaying ? "⏸ 暫停" : "▶ 自動播放";
    playBtn.className = `btn ${vm.isPlaying ? "btn-amber" : "btn-indigo"}`;
    speedBtn.textContent = vm.speed;

    if (!currentStep) {
      notationBox.hidden = true;
      narrativeEl.hidden = true;
      return;
    }

    notationBox.hidden = false;
    notationBox.textContent = currentStep.notation;

    const summaries = formatEventSummary(currentStep);
    const skillMeta = SKILL_NAMES[currentStep.action.skillType ?? "NONE"];

    const headerItems = [
      el(
        "span",
        {
          className: "piece-stat-pill",
          dataset: { team: currentStep.playerId === 1 ? "1" : "2" },
        },
        currentStep.playerId === 1 ? "第一隊（黑方）" : "第二隊（白方）",
      ),
    ];

    if (currentStep.action.type === "PLACE_PIECE") {
      headerItems.push(
        el("span", null, "落子於"),
        el(
          "strong",
          { className: "text-mono text-amber" },
          `${coordToAlgebraic(currentStep.action.coord)} (${currentStep.action.coord.x}, ${currentStep.action.coord.y})`,
        ),
        el("span", null, "部署棋子："),
        el("strong", { className: skillMeta.cls }, skillMeta.name),
      );
    } else if (currentStep.action.type === "PASS_TURN") {
      headerItems.push(
        el("strong", { className: "text-amber" }, "跳過回合 (PASS)"),
      );
    }

    const narrativeChildren = [
      el("div", { className: "player-identity" }, ...headerItems),
    ];
    if (summaries.length > 0) {
      narrativeChildren.push(
        el(
          "div",
          { className: "replay-tags" },
          ...summaries.map((text) =>
            el("span", { className: "replay-tag" }, text),
          ),
        ),
      );
    }

    narrativeEl.hidden = false;
    narrativeEl.replaceChildren(...narrativeChildren);
  }

  return { element, update };
}

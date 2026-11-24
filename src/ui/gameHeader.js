import { toggleAudioMuted } from "../fx/sound.js";
import { el, setBoolAttr } from "./dom.js";

export function createGameHeader(actions, signal) {
  const pvpBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          actions.setGameMode("PVP");
          actions.setSelectedSkill("NONE");
        },
      },
    },
    "👥 同機雙人",
  );

  const pveBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          actions.setGameMode("PVE");
          actions.setSelectedSkill("NONE");
        },
      },
    },
    "🤖 人機對戰",
  );

  const aiVsAiBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          actions.setGameMode("AI_VS_AI");
          actions.setSelectedSkill("NONE");
          actions.setIsGodMode(true);
          actions.setIsAiPlaying(true);
        },
      },
    },
    "⚔️ 雙 AI 演示",
  );

  const modeGroup = el(
    "div",
    { className: "segmented-group", role: "group", "aria-label": "對戰模式" },
    pvpBtn,
    pveBtn,
    aiVsAiBtn,
  );

  const aiPlayBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          actions.toggleAiPlaying();
        },
      },
    },
    "⏸️ 暫停",
  );

  const aiStepBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          actions.onAiStep();
        },
      },
    },
    "⏭️ 單步",
  );

  const aiSpeedBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral text-mono text-purple",
      signal,
      on: {
        click: () => {
          actions.toggleAiSpeed();
        },
      },
    },
    "1x 正常",
  );

  const aiToolbar = el(
    "div",
    {
      className: "ai-toolbar",
      role: "group",
      "aria-label": "雙 AI 演示控制",
      hidden: true,
    },
    aiPlayBtn,
    aiStepBtn,
    aiSpeedBtn,
  );

  const muteBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          const nextMuted = toggleAudioMuted();
          actions.setIsMuted(nextMuted);
        },
      },
    },
    "🔊 音效開啟",
  );

  const godModeBtn = el(
    "button",
    {
      type: "button",
      className: "btn",
      signal,
      on: {
        click: () => {
          actions.toggleGodMode();
        },
      },
    },
    "戰爭迷霧（玩家視角）",
  );

  const resetBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          actions.onReset();
        },
      },
    },
    "重設對局",
  );

  const replayBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          actions.onToggleReplay();
        },
      },
    },
    "🎬 對局回放",
  );

  const exportBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          actions.onOpenExport();
        },
      },
    },
    "📥 匯出",
  );

  const importBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          actions.onOpenImport();
        },
      },
    },
    "📤 載入",
  );

  const element = el(
    "header",
    { className: "game-header app-container" },
    el(
      "div",
      null,
      el(
        "h1",
        { className: "game-title", id: "main-heading", tabindex: "-1" },
        el("span", { className: "accent" }, "HBC"),
        el("span", null, "多陣營黑白棋核心引擎"),
      ),
      el(
        "p",
        { className: "game-subtitle" },
        "五大技能棋、隱藏陷阱與連鎖反應（16x16 無頭引擎）",
      ),
    ),
    el(
      "div",
      { className: "header-toolbar" },
      modeGroup,
      aiToolbar,
      muteBtn,
      godModeBtn,
      resetBtn,
      replayBtn,
      exportBtn,
      importBtn,
    ),
  );

  function update(vm) {
    pvpBtn.className = `btn ${vm.gameMode === "PVP" ? "btn-primary" : "btn-subtle"}`;
    pveBtn.className = `btn ${vm.gameMode === "PVE" ? "btn-primary" : "btn-subtle"}`;
    aiVsAiBtn.className = `btn ${vm.gameMode === "AI_VS_AI" ? "btn-purple" : "btn-subtle"}`;

    pvpBtn.setAttribute("aria-pressed", String(vm.gameMode === "PVP"));
    pveBtn.setAttribute("aria-pressed", String(vm.gameMode === "PVE"));
    aiVsAiBtn.setAttribute("aria-pressed", String(vm.gameMode === "AI_VS_AI"));

    setBoolAttr(pvpBtn, "disabled", vm.isAnimating);
    setBoolAttr(pveBtn, "disabled", vm.isAnimating);
    setBoolAttr(aiVsAiBtn, "disabled", vm.isAnimating);

    aiToolbar.hidden = vm.gameMode !== "AI_VS_AI";
    aiPlayBtn.textContent = vm.isAiPlaying ? "⏸️ 暫停" : "▶️ 繼續";
    aiPlayBtn.className = `btn ${vm.isAiPlaying ? "btn-amber" : "btn-emerald"}`;
    setBoolAttr(aiPlayBtn, "disabled", vm.isGameOver);
    setBoolAttr(
      aiStepBtn,
      "disabled",
      vm.isAnimating || vm.isGameOver || vm.isAiPlaying,
    );
    aiSpeedBtn.textContent = vm.aiSpeed === "NORMAL" ? "1x 正常" : "2x 快速";

    muteBtn.textContent = vm.isMuted ? "🔇 靜音" : "🔊 音效開啟";
    muteBtn.className = `btn ${vm.isMuted ? "btn-neutral" : "btn-sound-on"}`;
    muteBtn.setAttribute("aria-pressed", String(vm.isMuted));

    setBoolAttr(
      godModeBtn,
      "disabled",
      vm.isAnimating || vm.gameMode === "PVE",
    );
    godModeBtn.className = `btn ${
      vm.gameMode === "PVE"
        ? "btn-neutral"
        : vm.isGodMode
          ? "btn-purple"
          : "btn-neutral"
    }`;
    godModeBtn.textContent =
      vm.gameMode === "PVE"
        ? "戰爭迷霧（玩家視角）"
        : vm.isGodMode
          ? "上帝視角（全揭示）"
          : "戰爭迷霧（玩家視角）";

    setBoolAttr(resetBtn, "disabled", vm.isAnimating);

    const turnsSuffix = vm.recordedTurns > 0 ? ` (${vm.recordedTurns})` : "";
    replayBtn.textContent = `🎬 ${vm.isReplayMode ? "結束回放" : "對局回放"}${turnsSuffix}`;
    replayBtn.className = `btn ${vm.isReplayMode ? "btn-indigo" : "btn-neutral"}`;
    setBoolAttr(
      replayBtn,
      "disabled",
      vm.isAnimating || vm.recordedTurns === 0,
    );

    setBoolAttr(
      exportBtn,
      "disabled",
      vm.isAnimating || vm.recordedTurns === 0,
    );
    setBoolAttr(importBtn, "disabled", vm.isAnimating);
  }

  return { element, update };
}

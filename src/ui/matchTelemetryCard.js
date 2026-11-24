import { el, setBoolAttr } from "./dom.js";
import { getTeamName } from "./gameUiConstants.js";

const DIFFICULTIES = Object.freeze([
  { id: "EASY", label: "簡單 (EASY)", activeClass: "btn-emerald" },
  { id: "MEDIUM", label: "普通 (MEDIUM)", activeClass: "btn-primary" },
  { id: "HARD", label: "困難 (HARD)", activeClass: "btn-purple" },
]);

export function createMatchTelemetryCard(actions, signal) {
  const turnOutput = el("output", {
    className: "mono-pill",
    dataset: { tone: "slate" },
  });
  const activeSwatch = el("span", {
    className: "team-swatch",
    "aria-hidden": "true",
  });
  const activeNameEl = el("span");
  const passBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: { click: actions.onPassTurn },
    },
    "跳過回合",
  );

  const diffButtons = new Map();
  const diffRow = el(
    "div",
    { className: "telemetry-row" },
    el("dt", null, "AI 難度："),
    el(
      "dd",
      null,
      el(
        "div",
        {
          className: "segmented-group",
          role: "group",
          "aria-label": "AI 難度",
        },
        ...DIFFICULTIES.map(({ id, label }) => {
          const btn = el(
            "button",
            {
              type: "button",
              className: "btn btn-subtle",
              signal,
              on: {
                click: () => {
                  actions.setAiDifficulty(id);
                },
              },
            },
            label,
          );
          diffButtons.set(id, btn);
          return btn;
        }),
      ),
    ),
  );

  const phaseValue = el("dd");
  const dropZoneValue = el("dd", { className: "text-mono" });
  const dropZoneRow = el(
    "div",
    { className: "telemetry-row", hidden: true },
    el("dt", null, "當前空降區："),
    dropZoneValue,
  );

  const team1Output = el("output", {
    className: "piece-stat-pill",
    dataset: { team: "1" },
  });
  const team2Output = el("output", {
    className: "piece-stat-pill",
    dataset: { team: "2" },
  });
  const neutralOutput = el("output", {
    className: "piece-stat-pill",
    dataset: { team: "0" },
  });

  const element = el(
    "section",
    { className: "panel-card" },
    el(
      "div",
      { className: "telemetry-header" },
      el("h2", { className: "section-kicker" }, "對局遙測資訊"),
      turnOutput,
    ),
    el(
      "dl",
      { className: "telemetry-list" },
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "當前回合："),
        el("dd", null, activeSwatch, activeNameEl, passBtn),
      ),
      diffRow,
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "遊戲階段："),
        phaseValue,
      ),
      dropZoneRow,
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "盤面棋數統計："),
        el(
          "dd",
          null,
          team1Output,
          el("span", { className: "text-muted" }, "/"),
          team2Output,
          el("span", { className: "text-muted" }, "/"),
          neutralOutput,
        ),
      ),
    ),
  );

  function update(vm) {
    turnOutput.textContent = `第 ${vm.gameState.currentTurn} 回合`;
    activeSwatch.dataset.team = String(vm.activePlayerTeamId);
    activeNameEl.textContent = `${vm.activePlayerName ?? "未知玩家"} (${getTeamName(vm.activePlayerTeamId)})`;
    setBoolAttr(
      passBtn,
      "disabled",
      vm.isAnimating || vm.gameState.isGameOver || vm.isCurrentPlayerAi,
    );

    const showDiff = vm.gameMode === "PVE" || vm.gameMode === "AI_VS_AI";
    diffRow.hidden = !showDiff;
    if (showDiff) {
      for (const { id, activeClass } of DIFFICULTIES) {
        const btn = diffButtons.get(id);
        const isSelected = vm.aiDifficulty === id;
        btn.className = `btn ${isSelected ? activeClass : "btn-subtle"}`;
        btn.setAttribute("aria-pressed", String(isSelected));
        setBoolAttr(btn, "disabled", vm.isAnimating);
      }
    }

    phaseValue.replaceChildren(
      vm.gameState.isDropPhase
        ? el(
            "span",
            { className: "text-amber" },
            `初始空降階段（剩餘 ${vm.gameState.dropTurnsRemaining} 回合）`,
          )
        : el("span", { className: "text-emerald" }, "全域對局"),
    );

    const showDrop = Boolean(vm.dropZone && vm.gameState.isDropPhase);
    dropZoneRow.hidden = !showDrop;
    if (showDrop && vm.dropZone) {
      dropZoneValue.textContent = `中心 (${vm.dropZone.center.x}, ${vm.dropZone.center.y})，半徑=${vm.dropZone.radius}`;
    }

    team1Output.textContent = `${vm.team1Count} 黑棋`;
    team2Output.textContent = `${vm.team2Count} 白棋`;
    neutralOutput.textContent = `${vm.neutralCount} 錨點`;
  }

  return { element, update };
}

import { el } from "./dom.js";
import { getTeamName } from "./gameUiConstants.js";

export function createBattlefieldStatusBar(actions, signal) {
  const leadEl = el("div", { className: "status-lead" });
  const actionsEl = el("div", { className: "status-actions" });

  const element = el(
    "div",
    { className: "status-bar app-container", role: "status" },
    leadEl,
    actionsEl,
  );

  let lastSig = "";

  function update(vm) {
    const dropKey = vm.dropZone
      ? `${vm.dropZone.center.x},${vm.dropZone.center.y},${vm.dropZone.radius}`
      : "";
    const sig = [
      vm.isReplayMode,
      vm.replayIndex,
      vm.replayStepNotation ?? "",
      vm.isGameOver,
      vm.winnerTeamId ?? "",
      vm.team1Count,
      vm.team2Count,
      vm.isAnimating,
      vm.gameMode,
      vm.isAiPlaying,
      vm.activePlayerName ?? "",
      vm.activePlayerTeamId,
      vm.isCurrentPlayerAi,
      vm.isPioneerActive,
      vm.pioneerMovesCount,
      vm.isDropPhase,
      vm.dropTurnsRemaining,
      dropKey,
      vm.mapPreset,
    ].join("|");

    if (sig === lastSig) return;
    lastSig = sig;

    if (vm.isReplayMode) {
      leadEl.dataset.tone = "indigo";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "對局重播進行中："),
        el(
          "span",
          { className: "status-detail" },
          vm.replayIndex === -1
            ? "初始盤面（Turn 0）"
            : `第 ${vm.replayIndex + 1} 手 · ${vm.replayStepNotation ?? ""}`,
        ),
      );
      actionsEl.replaceChildren(
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "indigo" } },
          "🎬 重播進行中",
        ),
        el(
          "button",
          {
            type: "button",
            className: "btn btn-neutral",
            signal,
            on: { click: actions.onExitReplay },
          },
          "返回對局",
        ),
      );
      return;
    }

    if (vm.isGameOver) {
      const winnerLabel =
        vm.winnerTeamId === 1
          ? "第一隊（黑方）獲勝！"
          : vm.winnerTeamId === 2
            ? "第二隊（白方）獲勝！"
            : "雙方勢均力敵・平手！";
      leadEl.dataset.tone = "amber";
      leadEl.replaceChildren(
        el("span", { "aria-hidden": "true" }, "🏆"),
        el("strong", null, `對局結束：${winnerLabel}`),
        el(
          "span",
          { className: "status-detail text-mono" },
          `(黑 ${vm.team1Count} : 白 ${vm.team2Count})`,
        ),
      );
      actionsEl.replaceChildren(
        el(
          "button",
          {
            type: "button",
            className: "btn btn-primary",
            signal,
            on: { click: actions.onShowGameOverModal },
          },
          "📊 查看結算",
        ),
        el(
          "button",
          {
            type: "button",
            className: "btn btn-neutral",
            signal,
            on: { click: actions.onReset },
          },
          "🔄 重新開局",
        ),
      );
      return;
    }

    if (vm.isAnimating) {
      leadEl.dataset.tone = "purple";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "連鎖結算中..."),
        el(
          "span",
          { className: "status-detail" },
          "正在執行事件序列與戰鬥動畫",
        ),
      );
      actionsEl.replaceChildren(
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "purple" } },
          "操作鎖定",
        ),
      );
      return;
    }

    if (vm.gameMode === "AI_VS_AI") {
      leadEl.dataset.tone = "purple";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "雙 AI 演示進行中："),
        el(
          "span",
          { className: "status-detail" },
          vm.isAiPlaying
            ? `${vm.activePlayerName ?? "AI"}（${getTeamName(vm.activePlayerTeamId)}）思考中...`
            : "已暫停，點擊播放或單步執行推演",
        ),
      );
      actionsEl.replaceChildren(
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "purple" } },
          vm.isAiPlaying ? "AI 自主演示" : "演示暫停",
        ),
      );
      return;
    }

    if (vm.gameMode === "PVE" && vm.isCurrentPlayerAi) {
      leadEl.dataset.tone = "slate";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "AI 電腦思考中..."),
        el(
          "span",
          { className: "status-detail" },
          "正在評估落子戰略與連鎖效應",
        ),
      );
      actionsEl.replaceChildren(
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "slate" } },
          "電腦回合",
        ),
      );
      return;
    }

    if (vm.isPioneerActive) {
      leadEl.dataset.tone = "amber";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "拓荒階段啟動："),
        el(
          "span",
          { className: "status-detail" },
          "無可夾殺路徑，請於領地 2 格內放置拓荒橋樑棋",
        ),
      );
      actionsEl.replaceChildren(
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "amber" } },
          `${vm.pioneerMovesCount} 個拓荒目標點`,
        ),
      );
      return;
    }

    if (vm.isDropPhase) {
      leadEl.dataset.tone = "amber";
      leadEl.replaceChildren(
        el("span", { className: "ping-dot", "aria-hidden": "true" }),
        el("strong", null, "初始空降階段（Turn 0 配置）："),
        el(
          "span",
          { className: "status-detail" },
          "棋子落點限制於專屬空降區域內",
        ),
      );
      const rightItems = [
        el(
          "span",
          { className: "mono-pill", dataset: { tone: "amber" } },
          `剩餘 ${vm.dropTurnsRemaining} 回合`,
        ),
      ];
      if (vm.dropZone) {
        rightItems.push(
          el(
            "span",
            { className: "mono-pill", dataset: { tone: "slate" } },
            `中心 (${vm.dropZone.center.x}, ${vm.dropZone.center.y}) 半徑=${vm.dropZone.radius}`,
          ),
        );
      }
      actionsEl.replaceChildren(...rightItems);
      return;
    }

    leadEl.dataset.tone = "emerald";
    leadEl.replaceChildren(
      el("span", { className: "solid-dot", "aria-hidden": "true" }),
      el("strong", null, "全域棋局階段：解除空降限制，套用標準黑白棋規則"),
    );
    actionsEl.replaceChildren(
      el(
        "span",
        { className: "mono-pill", dataset: { tone: "emerald" } },
        `地圖：${vm.mapPreset}`,
      ),
    );
  }

  return { element, update };
}

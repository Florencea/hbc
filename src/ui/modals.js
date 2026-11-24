import {
  deserializeMatchHistoryFromJson,
  parseHbcPgn,
  replayMatchActions,
  serializeMatchHistoryToJson,
  serializeToHbcPgn,
} from "../engine/replay.js";
import {
  closeDialogSmoothly,
  el,
  enableLightDismissFallback,
  setData,
} from "./dom.js";

function wireNativeDialog(dialog, onCloseCallback, signal) {
  enableLightDismissFallback(dialog, signal);
  dialog.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      void closeDialogSmoothly(dialog);
    },
    { signal },
  );
  dialog.addEventListener(
    "close",
    () => {
      dialog.returnValue = "";
      onCloseCallback();
    },
    { signal },
  );
}

export function createGameOverModal(actions, signal) {
  const trophyEl = el("div", {
    className: "gameover-trophy",
    "aria-hidden": "true",
  });
  const headingEl = el("h1", {
    id: "gameover-title",
    className: "dialog-title",
  });
  const subEl = el("p", { className: "game-subtitle" });

  const t1CountEl = el("div", { className: "score-number" }, "0");
  const t1WinnerChip = el(
    "span",
    { className: "winner-chip", hidden: true },
    "👑 優勝",
  );
  const t1Box = el(
    "div",
    { className: "score-box", dataset: { team: "1", winner: "false" } },
    el(
      "div",
      { className: "player-identity" },
      el("span", {
        className: "team-swatch",
        dataset: { team: "1" },
        "aria-hidden": "true",
      }),
      el("span", { className: "player-name" }, "第一隊（黑方）"),
    ),
    t1CountEl,
    el("span", { className: "preset-desc" }, "枚棋子"),
    t1WinnerChip,
  );

  const t2CountEl = el("div", { className: "score-number" }, "0");
  const t2WinnerChip = el(
    "span",
    { className: "winner-chip", hidden: true },
    "👑 優勝",
  );
  const t2Box = el(
    "div",
    { className: "score-box", dataset: { team: "2", winner: "false" } },
    el(
      "div",
      { className: "player-identity" },
      el("span", {
        className: "team-swatch",
        dataset: { team: "2" },
        "aria-hidden": "true",
      }),
      el("span", { className: "player-name" }, "第二隊（白方）"),
    ),
    t2CountEl,
    el("span", { className: "preset-desc" }, "枚棋子"),
    t2WinnerChip,
  );

  const modeVal = el("dd");
  const turnVal = el("dd", { className: "text-mono" });
  const presetVal = el("dd");
  const neutralVal = el("dd", { className: "text-mono text-amber" });

  const dialog = el(
    "dialog",
    {
      className: "hbc-dialog",
      closedby: "any",
      "aria-labelledby": "gameover-title",
      dataset: { size: "compact" },
    },
    el(
      "div",
      { className: "dialog-header" },
      headingEl,
      el(
        "button",
        {
          type: "button",
          className: "dialog-close-btn",
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
            },
          },
        },
        "✕",
      ),
    ),
    el("div", { className: "gameover-hero" }, trophyEl, subEl),
    el("div", { className: "gameover-scores" }, t1Box, t2Box),
    el(
      "dl",
      { className: "gameover-summary telemetry-list" },
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "對戰模式"),
        modeVal,
      ),
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "總對局回合"),
        turnVal,
      ),
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "地圖預設"),
        presetVal,
      ),
      el(
        "div",
        { className: "telemetry-row" },
        el("dt", null, "中立錨點存留"),
        neutralVal,
      ),
    ),
    el(
      "div",
      { className: "gameover-actions" },
      el(
        "button",
        {
          type: "button",
          className: "btn btn-primary btn-grow",
          autofocus: true,
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
              actions.onReset();
            },
          },
        },
        "🔄 再玩一局",
      ),
      el(
        "button",
        {
          type: "button",
          className: "btn btn-indigo btn-grow",
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
              actions.onOpenReplay();
            },
          },
        },
        "🎬 觀看重播",
      ),
      el(
        "button",
        {
          type: "button",
          className: "btn btn-neutral",
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
              actions.onOpenExport();
            },
          },
        },
        "📥 匯出",
      ),
    ),
  );

  wireNativeDialog(dialog, actions.onClose, signal);

  function update(vm) {
    if (vm.isOpen) {
      trophyEl.textContent =
        vm.winnerTeamId === 1 || vm.winnerTeamId === 2 ? "🏆" : "🤝";
      headingEl.textContent =
        vm.winnerTeamId === 1
          ? "第一隊（黑方）獲勝！"
          : vm.winnerTeamId === 2
            ? "第二隊（白方）獲勝！"
            : "勢均力敵・平局結算！";
      subEl.textContent =
        vm.winnerTeamId === null
          ? "雙方棋子數完全相同，平分秋色"
          : `恭喜 ${vm.winnerTeamId === 1 ? "黑方" : "白方"} 奪得本局對戰勝利！`;

      t1CountEl.textContent = String(vm.team1Count);
      t2CountEl.textContent = String(vm.team2Count);
      setData(t1Box, "winner", vm.winnerTeamId === 1 ? "true" : "false");
      setData(t2Box, "winner", vm.winnerTeamId === 2 ? "true" : "false");
      t1WinnerChip.hidden = vm.winnerTeamId !== 1;
      t2WinnerChip.hidden = vm.winnerTeamId !== 2;

      modeVal.textContent =
        vm.gameMode === "PVP"
          ? "👥 同機雙人"
          : vm.gameMode === "PVE"
            ? "🤖 人機對戰"
            : "⚔️ 雙 AI 演示";
      turnVal.textContent = `${vm.currentTurn} 回合`;
      presetVal.textContent = vm.mapPreset;
      neutralVal.textContent = `${vm.neutralCount} 顆`;

      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeDialogSmoothly(dialog);
    }
  }

  return { element: dialog, update };
}

export function createExportModal(actions, signal) {
  let tab = "PGN";
  let currentHistory = null;
  let activeContent = "";

  const pgnTabBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-primary",
      signal,
      on: {
        click: () => {
          tab = "PGN";
          renderContent();
        },
      },
    },
    "HBC-PGN 棋譜格式",
  );

  const jsonTabBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: () => {
          tab = "JSON";
          renderContent();
        },
      },
    },
    "JSON 完整狀態檔",
  );

  const codeEl = el("code");
  const preEl = el(
    "pre",
    {
      className: "dialog-body-scroll",
      role: "region",
      "aria-labelledby": "export-title",
      tabindex: "0",
    },
    codeEl,
  );

  const metaEl = el("span", { className: "preset-desc" });
  const downloadBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-primary",
      signal,
      on: {
        click: () => {
          if (!currentHistory) return;
          const ext = tab === "PGN" ? "pgn" : "json";
          const mime = tab === "PGN" ? "text/plain" : "application/json";
          const filename = `hbc-match-${currentHistory.metadata.id}.${ext}`;
          const blob = new Blob([activeContent], { type: mime });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
          actions.onShowToast(`已下載棋譜檔案：${filename}`, "success");
        },
      },
    },
    "💾 下載檔案 (.pgn)",
  );

  const copyBtn = el(
    "button",
    {
      type: "button",
      className: "btn btn-neutral",
      signal,
      on: {
        click: async () => {
          try {
            await navigator.clipboard.writeText(activeContent);
            actions.onShowToast("棋譜已成功複製至剪貼簿！", "success");
          } catch {
            actions.onShowToast("複製失敗，請手動選取文字複製", "error");
          }
        },
      },
    },
    "📋 複製內容",
  );

  const dialog = el(
    "dialog",
    {
      className: "hbc-dialog",
      closedby: "any",
      "aria-labelledby": "export-title",
      dataset: { size: "wide" },
    },
    el(
      "div",
      { className: "dialog-header" },
      el(
        "h1",
        { id: "export-title", className: "dialog-title" },
        el("span", { "aria-hidden": "true" }, "📥"),
        el("span", null, "匯出對局棋譜 (Export Match Notation)"),
      ),
      el(
        "button",
        {
          type: "button",
          className: "dialog-close-btn",
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
            },
          },
        },
        "✕",
      ),
    ),
    el(
      "div",
      { className: "header-toolbar dialog-section" },
      pgnTabBtn,
      jsonTabBtn,
    ),
    preEl,
    el(
      "div",
      { className: "dialog-footer" },
      metaEl,
      el("div", { className: "header-toolbar" }, copyBtn, downloadBtn),
    ),
  );

  wireNativeDialog(dialog, actions.onClose, signal);

  function renderContent() {
    if (!currentHistory) return;
    pgnTabBtn.className = `btn ${tab === "PGN" ? "btn-primary" : "btn-neutral"}`;
    jsonTabBtn.className = `btn ${tab === "JSON" ? "btn-primary" : "btn-neutral"}`;
    activeContent =
      tab === "PGN"
        ? serializeToHbcPgn(currentHistory)
        : serializeMatchHistoryToJson(currentHistory);
    codeEl.textContent = activeContent;
    metaEl.textContent = `總手數：${currentHistory.metadata.totalTurns} 手 · 地圖：${currentHistory.metadata.mapPreset}`;
    downloadBtn.textContent = `💾 下載檔案 (.${tab === "PGN" ? "pgn" : "json"})`;
  }

  function update(vm) {
    if (vm.isOpen) {
      currentHistory = vm.history;
      renderContent();
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeDialogSmoothly(dialog);
    }
  }

  return { element: dialog, update };
}

export function createImportModal(actions, signal) {
  const errorBox = el("div", {
    className: "dialog-error",
    role: "alert",
    hidden: true,
  });

  const textarea = el("textarea", {
    id: "import-notation-input",
    className: "dialog-textarea",
    placeholder: "在此貼上 HBC-PGN 文字或 JSON 棋譜內容...",
    rows: "10",
    signal,
    on: {
      input: () => {
        errorBox.hidden = true;
      },
    },
  });

  const fileInput = el("input", {
    id: "import-file-input",
    type: "file",
    accept: ".pgn,.json,.txt",
    className: "visually-hidden",
    signal,
    on: {
      change: async (event) => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        try {
          textarea.value = await file.text();
          errorBox.hidden = true;
        } catch {
          errorBox.textContent = "⚠️ 讀取檔案失敗";
          errorBox.hidden = false;
        }
      },
    },
  });

  function processImport() {
    errorBox.hidden = true;
    const trimmed = textarea.value.trim();
    if (!trimmed) {
      errorBox.textContent = "⚠️ 請輸入或貼上棋譜內容";
      errorBox.hidden = false;
      return;
    }

    try {
      if (trimmed.startsWith("{")) {
        const history = deserializeMatchHistoryFromJson(trimmed);
        actions.onImportSuccess(history);
        actions.onShowToast("已成功載入 JSON 棋譜！", "success");
        void closeDialogSmoothly(dialog);
        return;
      }

      const parsed = parseHbcPgn(trimmed);
      if (parsed.actions.length === 0) {
        errorBox.textContent = "⚠️ 未能從 PGN 格式中解析出任何合法落子手數";
        errorBox.hidden = false;
        return;
      }

      const { history } = replayMatchActions(
        parsed.mapPreset,
        parsed.boardSize,
        parsed.actions,
      );
      actions.onImportSuccess(history);
      actions.onShowToast(
        `已成功重建並載入 PGN 棋譜 (${history.steps.length} 手)！`,
        "success",
      );
      void closeDialogSmoothly(dialog);
    } catch (err) {
      errorBox.textContent =
        err instanceof Error
          ? `⚠️ 解析失敗：${err.message}`
          : "⚠️ 解析棋譜時發生未知錯誤";
      errorBox.hidden = false;
    }
  }

  const dialog = el(
    "dialog",
    {
      className: "hbc-dialog",
      closedby: "any",
      "aria-labelledby": "import-title",
      dataset: { size: "medium" },
    },
    el(
      "div",
      { className: "dialog-header" },
      el(
        "h1",
        { id: "import-title", className: "dialog-title" },
        el("span", { "aria-hidden": "true" }, "📤"),
        el("span", null, "載入外部棋譜 (Import Match Record)"),
      ),
      el(
        "button",
        {
          type: "button",
          className: "dialog-close-btn",
          signal,
          on: {
            click: () => {
              void closeDialogSmoothly(dialog);
            },
          },
        },
        "✕",
      ),
    ),
    el(
      "p",
      { className: "game-subtitle" },
      "支援貼上 HBC-PGN 棋譜文字或匯出的 JSON 狀態檔，亦可直接選取本地檔案：",
    ),
    el(
      "div",
      { className: "dialog-section" },
      el(
        "label",
        { for: "import-file-input", className: "btn btn-neutral" },
        "📁 選取本地檔案 (.pgn / .json)",
      ),
      fileInput,
    ),
    el(
      "div",
      { className: "dialog-section" },
      el(
        "label",
        { for: "import-notation-input", className: "visually-hidden" },
        "HBC-PGN 或 JSON 棋譜內容",
      ),
      textarea,
    ),
    errorBox,
    el(
      "div",
      { className: "dialog-footer" },
      el("span"),
      el(
        "div",
        { className: "header-toolbar" },
        el(
          "button",
          {
            type: "button",
            className: "btn btn-neutral",
            signal,
            on: {
              click: () => {
                void closeDialogSmoothly(dialog);
              },
            },
          },
          "取消",
        ),
        el(
          "button",
          {
            type: "button",
            className: "btn btn-primary",
            signal,
            on: { click: processImport },
          },
          "🚀 載入並重播",
        ),
      ),
    ),
  );

  wireNativeDialog(dialog, actions.onClose, signal);

  function update(vm) {
    if (vm.isOpen) {
      if (!dialog.open) {
        errorBox.hidden = true;
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeDialogSmoothly(dialog);
    }
  }

  return { element: dialog, update };
}

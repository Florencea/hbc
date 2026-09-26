import { useState } from "react";
import {
  deserializeMatchHistoryFromJson,
  parseHbcPgn,
  replayMatchActions,
  serializeMatchHistoryToJson,
  serializeToHbcPgn,
  type MatchHistory,
} from "../engine/replay.ts";

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: MatchHistory;
  onShowToast: (msg: string, type: "info" | "success" | "error") => void;
}

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (history: MatchHistory) => void;
  onShowToast: (msg: string, type: "info" | "success" | "error") => void;
}

export function ExportModal({
  isOpen,
  onClose,
  history,
  onShowToast,
}: ExportModalProps) {
  const [tab, setTab] = useState<"PGN" | "JSON">("PGN");

  if (!isOpen) return null;

  const pgnContent = serializeToHbcPgn(history);
  const jsonContent = serializeMatchHistoryToJson(history);
  const activeContent = tab === "PGN" ? pgnContent : jsonContent;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      onShowToast("棋譜已成功複製至剪貼簿！", "success");
    } catch {
      onShowToast("複製失敗，請手動選取文字複製", "error");
    }
  };

  const handleDownload = () => {
    const ext = tab === "PGN" ? "pgn" : "json";
    const mime = tab === "PGN" ? "text/plain" : "application/json";
    const filename = `hbc-match-${history.metadata.id}.${ext}`;
    const blob = new Blob([activeContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`已下載棋譜檔案：${filename}`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📥</span>
            <h2 className="text-base font-bold text-white">
              匯出對局棋譜 (Export Match Notation)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("PGN");
            }}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === "PGN"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            HBC-PGN 棋譜格式
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("JSON");
            }}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              tab === "JSON"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            JSON 完整狀態檔
          </button>
        </div>

        {/* Text Container */}
        <div className="mt-3 flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300">
          <pre className="break-all whitespace-pre-wrap">{activeContent}</pre>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
          <span className="text-[11px] text-slate-400">
            總手數：{history.metadata.totalTurns.toString()} 手 · 地圖：
            {history.metadata.mapPreset}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
            >
              📋 複製內容
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="cursor-pointer rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-500"
            >
              💾 下載檔案 (.{tab === "PGN" ? "pgn" : "json"})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  onShowToast,
}: ImportModalProps) {
  const [inputText, setInputText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setInputText(content);
        setErrorMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage("讀取檔案失敗");
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    setErrorMessage(null);
    const trimmed = inputText.trim();
    if (!trimmed) {
      setErrorMessage("請輸入或貼上棋譜內容");
      return;
    }

    try {
      if (trimmed.startsWith("{")) {
        // Try JSON deserialization
        const history = deserializeMatchHistoryFromJson(trimmed);
        onImportSuccess(history);
        onShowToast("已成功載入 JSON 棋譜！", "success");
        onClose();
        return;
      }

      // Try HBC-PGN parsing and action reconstruction
      const parsed = parseHbcPgn(trimmed);
      if (parsed.actions.length === 0) {
        setErrorMessage("未能從 PGN 格式中解析出任何合法落子手數");
        return;
      }

      const { history } = replayMatchActions(
        parsed.mapPreset,
        parsed.boardSize,
        parsed.actions,
      );

      onImportSuccess(history);
      onShowToast(
        `已成功重建並載入 PGN 棋譜 (${history.steps.length.toString()} 手)！`,
        "success",
      );
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(`解析失敗：${err.message}`);
      } else {
        setErrorMessage("解析棋譜時發生未知錯誤");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📤</span>
            <h2 className="text-base font-bold text-white">
              載入外部棋譜 (Import Match Record)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          支援貼上 HBC-PGN 棋譜文字或匯出的 JSON 狀態檔，亦可直接選取本地檔案：
        </p>

        {/* File Select */}
        <div className="mt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white">
            <span>📁 選取本地檔案 (.pgn / .json)</span>
            <input
              type="file"
              accept=".pgn,.json,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Text Area */}
        <div className="mt-3 flex-1">
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setErrorMessage(null);
            }}
            placeholder="在此貼上 HBC-PGN 文字或 JSON 棋譜內容..."
            rows={10}
            className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-2 rounded-lg border border-rose-500/50 bg-rose-950/60 p-2.5 text-xs font-semibold text-rose-300">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleProcessImport}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-500"
          >
            🚀 載入並重播
          </button>
        </div>
      </div>
    </div>
  );
}

import { describe, expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";
import App from "../../src/App.tsx";
import "../../src/global.css";

describe("HBC Game Smoke Test in Browser Mode", () => {
  test("renders main heading, board layout, and controls", async () => {
    const screen = await render(<App />);

    // Verify main heading
    const heading = screen.getByRole("heading", { level: 1 });
    await expect.element(heading).toBeInTheDocument();
    await expect.element(heading).toHaveTextContent("HBC多陣營黑白棋核心引擎");

    // Verify subheading
    const subheading = screen.getByText(/五大技能棋、隱藏陷阱與連鎖反應/);
    await expect.element(subheading).toBeInTheDocument();

    // Verify game board container
    const boardContainer = screen.container.querySelector(".grid");
    expect(boardContainer).not.toBeNull();
  });

  test("activates visual replay mode, timeline controls, and export modal", async () => {
    const screen = await render(<App />);

    // Switch to AI vs AI mode
    const dualAiBtn = screen.getByRole("button", { name: "⚔️ 雙 AI 演示" });
    await dualAiBtn.click();

    // Wait for at least one move so replay button is enabled
    const replayBtn = screen.getByRole("button", { name: /🎬 對局回放/ });
    await expect
      .poll(
        async () => {
          const el = replayBtn.element();
          return el instanceof HTMLButtonElement && !el.disabled;
        },
        { timeout: 10000 },
      )
      .toBe(true);

    await replayBtn.click();

    // Verify Visual Replay banner is visible
    const replayBanner = screen.getByText("對局重播模式 (Visual Replay)");
    await expect.element(replayBanner).toBeVisible();

    // Verify export modal can be opened from replay bar
    const exportBtn = screen.getByRole("button", { name: "📥 匯出棋譜" });
    await exportBtn.click();
    const exportTitle = screen.getByText("匯出對局棋譜 (Export Match Notation)");
    await expect.element(exportTitle).toBeVisible();

    // Close export modal
    const closeBtn = screen.getByRole("button", { name: "✕", exact: true });
    await closeBtn.click();

    // Exit replay mode
    const exitReplayBtn = screen.getByRole("button", { name: "✕ 結束回放" });
    await exitReplayBtn.click();
    await expect.element(replayBanner).not.toBeInTheDocument();
  });

  test("opens import modal successfully", async () => {
    const screen = await render(<App />);

    const importBtn = screen.getByRole("button", { name: "📤 載入" });
    await importBtn.click();

    const importTitle = screen.getByText("載入外部棋譜 (Import Match Record)");
    await expect.element(importTitle).toBeVisible();
  });
});

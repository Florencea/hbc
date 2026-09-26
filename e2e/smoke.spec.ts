import { expect, test } from "@playwright/test";

test.describe("HBC Game Smoke Test", () => {
  test("renders main heading, board layout, and controls", async ({ page }) => {
    await page.goto("/");

    // Verify main heading
    await expect(page.locator("h1")).toContainText("多陣營黑白棋核心引擎");

    // Verify subheading
    await expect(page.locator("header")).toContainText(
      "五大技能棋、隱藏陷阱與連鎖反應",
    );

    // Verify game board grid container is rendered
    const board = page.locator(".grid");
    await expect(board.first()).toBeVisible();

    // Verify interactive controls exist
    const buttons = page.locator("button");
    await expect(buttons.first()).toBeVisible();
  });

  test("activates visual replay mode, timeline controls, and export modal", async ({
    page,
  }) => {
    await page.goto("/");

    // Switch to AI vs AI mode so AI makes moves automatically
    await page.getByRole("button", { name: "⚔️ 雙 AI" }).click();

    // Wait for at least one move to complete and replay button to be enabled
    const replayBtn = page.getByRole("button", { name: /🎬 對局回放/ });
    await expect(replayBtn).toBeEnabled({ timeout: 10000 });
    await replayBtn.click();

    // Verify Visual Replay banner is visible
    await expect(page.getByText("對局重播模式 (Visual Replay)")).toBeVisible();

    // Verify export modal can be opened from replay bar
    const exportBtn = page.getByRole("button", { name: "📥 匯出棋譜" });
    await exportBtn.click();
    await expect(
      page.getByText("匯出對局棋譜 (Export Match Notation)"),
    ).toBeVisible();
    await expect(page.getByText("HBC-PGN 棋譜格式")).toBeVisible();

    // Close export modal
    const closeBtn = page.getByRole("button", { name: "✕", exact: true });
    await closeBtn.click();

    // Exit replay mode
    const exitReplayBtn = page.getByRole("button", { name: "✕ 結束回放" });
    await exitReplayBtn.click();
    await expect(
      page.getByText("對局重播模式 (Visual Replay)"),
    ).not.toBeVisible();
  });

  test("opens import modal successfully", async ({ page }) => {
    await page.goto("/");

    // Open import modal
    const importBtn = page.getByRole("button", { name: "📤 載入" });
    await importBtn.click();

    await expect(
      page.getByText("載入外部棋譜 (Import Match Record)"),
    ).toBeVisible();
  });
});

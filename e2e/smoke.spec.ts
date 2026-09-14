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
});

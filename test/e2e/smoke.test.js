import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { chromium } from "playwright";

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["vite", "preview", "--host", "127.0.0.1", "--port", "0", "--strictPort"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1" },
      },
    );

    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out starting vite preview. Output:\n${output}`));
    }, 15000);

    const onChunk = (chunk) => {
      output += chunk.toString("utf8");
      const match = /https?:\/\/127\.0\.0\.1:\d+\/?/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve({ child, url: match[0] });
      }
    };

    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(
          `vite preview exited prematurely with code ${String(code)}. Output:\n${output}`,
        ),
      );
    });
  });
}

describe("HBC Game Smoke Test in Browser Mode", () => {
  let serverChild = null;
  let baseUrl = "";
  let browser = null;

  before(async () => {
    const started = await startPreviewServer();
    serverChild = started.child;
    baseUrl = started.url;
    browser = await chromium.launch({ headless: true });
  });

  after(async () => {
    if (browser) {
      await browser.close();
    }
    if (serverChild) {
      serverChild.kill();
    }
  });

  it("renders main heading, 16x16 board grid, and controls", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const heading = page.getByRole("heading", { level: 1 });
      await heading.waitFor({ state: "visible" });
      assert.match(
        (await heading.textContent()) ?? "",
        /HBC多陣營黑白棋核心引擎/,
      );

      const subheading = page.getByText(/五大技能棋、隱藏陷阱與連鎖反應/);
      await subheading.waitFor({ state: "visible" });

      const cellCount = await page.locator(".board-grid .board-cell").count();
      assert.strictEqual(cellCount, 256);
    } finally {
      await page.close();
    }
  });

  it("activates visual replay mode, timeline controls, and native export dialog", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      await page.getByRole("button", { name: "⚔️ 雙 AI 演示" }).click();

      const replayBtn = page.getByRole("button", { name: /🎬 對局回放/ });
      await page.waitForFunction(
        () => {
          const buttons = [...document.querySelectorAll("button")];
          const target = buttons.find((b) =>
            b.textContent?.includes("🎬 對局回放"),
          );
          return Boolean(target && !target.disabled);
        },
        { timeout: 10000 },
      );

      await replayBtn.click();

      const replayBanner = page.getByText("對局重播模式 (Visual Replay)");
      await replayBanner.waitFor({ state: "visible" });

      await page.getByRole("button", { name: "📥 匯出棋譜" }).click();
      const exportDialog = page.locator("dialog[open]");
      await exportDialog.waitFor({ state: "visible" });
      const exportTitle = exportDialog.getByText(
        "匯出對局棋譜 (Export Match Notation)",
      );
      await exportTitle.waitFor({ state: "visible" });

      await exportDialog
        .getByRole("button", { name: "✕", exact: true })
        .click();
      await exportDialog.waitFor({ state: "hidden" });

      await page.getByRole("button", { name: "✕ 結束回放" }).click();
      await replayBanner.waitFor({ state: "hidden" });
    } finally {
      await page.close();
    }
  });

  it("opens and dismisses native import dialog with Escape", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      await page.getByRole("button", { name: "📤 載入" }).click();

      const importDialog = page.locator("dialog[open]");
      await importDialog.waitFor({ state: "visible" });
      const importTitle = importDialog.getByText(
        "載入外部棋譜 (Import Match Record)",
      );
      await importTitle.waitFor({ state: "visible" });

      await page.keyboard.press("Escape");
      await importDialog.waitFor({ state: "hidden" });
    } finally {
      await page.close();
    }
  });
});

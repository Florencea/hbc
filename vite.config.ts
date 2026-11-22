import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  optimizeDeps: {
    include: ["clsx", "react-dom/client"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  plugins: [react(), tailwindcss()],
  test: {
    allowOnly: (process.env.CI ?? "") === "",
    silent: "passed-only",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          setupFiles: ["./test/vitest.setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

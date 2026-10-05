import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  optimizeDeps: {
    include: ["clsx", "tailwind-merge"],
  },
  run: {
    cache: {
      scripts: true,
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  lint: {
    ignorePatterns: [
      "dist/**",
      ".cache/**",
      ".vitest/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
    },
    plugins: ["react", "unicorn", "typescript", "oxc", "vitest", "promise"],
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      ".cache/**",
      ".vitest/**",
      "test-results/**",
      "playwright-report/**",
      "blob-report/**",
    ],
    sortPackageJson: true,
  },
  plugins: [
    react({
      compiler: true,
    }),
    tailwindcss(),
  ],
  test: {
    allowOnly: !process.env.CI,
    silent: "passed-only",
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          environment: "node",
        },
      },
      {
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
          setupFiles: ["./test/vitest.setup.ts"],
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

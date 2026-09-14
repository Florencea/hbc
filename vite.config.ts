/// <reference types="vitest/config" />

import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? "/hbc/" : "/"),
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
    tailwindcss(),
  ],
  test: {
    environment: "node",
    silent: "passed-only",
    allowOnly: !process.env.CI,
    browser: {
      headless: true,
    },
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});

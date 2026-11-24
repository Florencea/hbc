import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  globalIgnores([
    "dist",
    ".cache",
    "test-results",
    "playwright-report",
    "blob-report",
  ]),
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    rules: {
      eqeqeq: ["error", "always"],
      "no-shadow": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/engine/**/*.js"],
    ignores: ["src/engine/__tests__/**"],
    languageOptions: {
      globals: {
        ...globals.es2023,
        structuredClone: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.js"],
    ignores: ["src/engine/**", "src/**/__tests__/**"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["src/**/__tests__/**/*.js", "*.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
]);

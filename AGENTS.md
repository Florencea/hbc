# Agent Development Guidelines

Guidelines for contributors on the **`hbc`** repository (16x16 Multi-Faction Reversi Engine).

## 1. Quick Architecture Map

| Layer          | Path             | Responsibility                                               |
| :------------- | :--------------- | :----------------------------------------------------------- |
| **Engine**     | `src/engine/`    | Headless 16x16 Reversi engine, Fog of War & Zod validation   |
| **FX & Audio** | `src/fx/`        | Web Audio synthesizers & event choreography                  |
| **UI Views**   | `src/ui/`        | Modular vanilla DOM views, native `<dialog>` & `[popover]`   |
| **Styles**     | `src/styles/`    | Layered modern CSS (`@layer`, `color-mix`, `@container`)     |
| **App Root**   | `src/app.js`     | Centralized game controller, state loop, and match telemetry |
| **E2E Smoke**  | `test/e2e/`      | Pure `node:test` + Playwright headless Chromium smoke tests  |
| **Rules**      | `.agents/rules/` | Domain rules (`engine`, `ui-styling`, `localization`)        |

---

## 2. Core SSOT & Architectural Invariants

- **Headless Engine**: Absolutely NO DOM, Canvas, or browser API dependencies inside `src/engine/`. Tested headlessly in pure Node ESM (`node --test`).
- **Pure State Transitions**: `dispatch(state, action)` is pure and deterministic, returning `{ nextState, events }`.
- **Fog of War & Security**: Hidden skills (`WALL`, `BOMB`, `COUNTER`, unrevealed `PIERCE`) remain confidential via `sanitizeForViewer`. Previews & AI operate on sanitized states.
- **Zero-Framework Vanilla JS & Modern CSS SSOT**: Runtime `dependencies` contains only `zod`. All UI views use modular vanilla ESM DOM (`src/ui/`), safe text/node construction (zero `innerHTML`), native `<dialog>` modals, `[popover="manual"]` toasts, semantic `<progress>` / `<output>` / `<dl>` / `<ol>`, and layered modern CSS (`src/global.css` + `src/styles/*.css` using `@layer`, `:root` tokens, `color-mix(in oklch, ...)`, CSS Nesting, `@container`, `@starting-style`, `transition-behavior: allow-discrete`).
- **Transparent Standard Toolchain**: Uses plain Vite 8 (zero plugins), Node built-in `node:test` + `node:assert/strict`, Playwright Chromium E2E, flat-config ESLint (`@eslint/js`, `noInlineConfig: true`), and default Prettier formatting. Never use `/* eslint-disable */`.
- **Zod Defense**: Untrusted external data (notations, JSON) must be validated with Zod (`src/engine/replay.js`).
- **Supply Chain & Cooldown Governance**: Keep `ignore-scripts=true`, `save-exact=true`, `install-strategy=linked`, `strict-peer-deps=true`, and `engine-strict=true` in `.npmrc`. Do not pin a root `engines.node` version in `package.json`; rely on dependency `engines` ranges enforced by `engine-strict=true`. Use `npm ci` for clean installs and `npm run test:setup` (`playwright install chromium`) explicitly for browser binaries. Batch toolchain updates quarterly or semi-annually with a 7-14 day cooldown window, prioritizing runtime CVEs via `npm audit --omit=dev`.
- **Exact SemVer Action Pinning**: Pin GitHub Actions to exact stable SemVer tags (`@vX.Y.Z`, never `@v1` or `@v7.0`) and run `actionlint` directly when editing `.github/workflows/*.yml`.

---

## 3. Shared Verification & Workflow Commands

- **Inner Static Checks**: `npm run lint && npm run format:check`
- **Auto-Fix Lint & Format**: `npm run lint:fix && npm run format`
- **Unit Tests**: `npm run test:unit` (runs `node --test "src/**/__tests__/*.test.js"`)
- **Production Build**: `npm run build`
- **E2E Smoke Tests**: `npm run test:e2e` (runs `node --test "test/e2e/*.test.js"` with Playwright Chromium against `vite preview` of `dist/`)
- **Full Verification Gate (DoD)**: `npm run verify` (`lint`, `format:check`, `build`, and `npm test`)
- **On-Demand Audits**: `actionlint` (after workflow edits), `npm audit --omit=dev` (runtime dependency audit)

---

## 4. Git Restrictions & Localization

- **NEVER execute `git commit` directly**: 1Password SSH signing fails in subshells. Stage with `git add` and output commit command in chat.
- **Traditional Chinese (繁體中文)**: All UI text, combat notifications, plans, and chat responses must strictly use Traditional Chinese.

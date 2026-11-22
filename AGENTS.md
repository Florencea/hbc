# Agent Development Guidelines

Guidelines for contributors on the **`hbc`** repository (16x16 Multi-Faction Reversi Engine).

## 1. Quick Architecture Map

| Layer          | Path              | Responsibility                                        |
| :------------- | :---------------- | :---------------------------------------------------- |
| **Engine**     | `src/engine/`     | Headless 16x16 Reversi engine & Fog of War            |
| **FX & Audio** | `src/fx/`         | Sound synthesizers & event choreography               |
| **Components** | `src/components/` | Modular React 19 UI component tree                    |
| **App Root**   | `src/App.tsx`     | Game controller, loop, and match telemetry            |
| **E2E Smoke**  | `test/e2e/`       | Headless Vitest Playwright browser tests              |
| **Rules**      | `.agents/rules/`  | Domain rules (`engine`, `ui-styling`, `localization`) |

---

## 2. Core SSOT & Architectural Invariants

- **Headless Engine**: Absolutely NO DOM, Canvas, or React inside `src/engine/`. Tested headlessly in pure Node/TypeScript.
- **Pure State Transitions**: `dispatch(state, action)` is pure and deterministic, returning `{ nextState, events }`.
- **Fog of War & Security**: Hidden skills (`WALL`, `BOMB`, `COUNTER`, unrevealed `PIERCE`) remain confidential via `sanitizeForViewer`. Previews & AI operate on sanitized states.
- **Tailwind SSOT**: Tailwind CSS v4 `@theme` in `src/global.css` is the sole design token source. Merged classes use `cn(...)` and deterministic class sorting via `prettier-plugin-tailwindcss`.
- **Transparent Standard Toolchain**: Uses TypeScript 6 (`tsc -b --pretty false`) and standard `@vitejs/plugin-react` without React Compiler rewriting, TypeScript 7 Native Preview (`tsgo`), or custom LSP scripts.
- **Zod Defense**: Untrusted external data (notations, JSON) must be validated with Zod. Never use unsafe casts.
- **Strict TypeScript & ESLint**: ESLint uses `strictTypeChecked` and `stylisticTypeChecked` with `typescript-eslint`, `noInlineConfig: true`, and Prettier formatting (`prettier-plugin-tailwindcss`, `prettier-plugin-packagejson`). Never use `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, or `/* eslint-disable */`.
- **Supply Chain & Cooldown Governance**: Keep `ignore-scripts=true`, `save-exact=true`, `install-strategy=linked`, `strict-peer-deps=true`, and `engine-strict=true` in `.npmrc`. Do not pin a root `engines.node` version in `package.json`; rely on dependency `engines` ranges enforced by `engine-strict=true`. Use `npm ci` for clean installs and `npm run test:setup` (`playwright install chromium`) explicitly for browser binaries. Batch toolchain updates quarterly or semi-annually with a 7-14 day cooldown window, prioritizing runtime CVEs via `npm audit --omit=dev`; keep `knip` out of `devDependencies` and run `npx knip` on demand.
- **Exact SemVer Action Pinning**: Pin GitHub Actions to exact stable SemVer tags (`@vX.Y.Z`, never `@v1` or `@v7.0`) and run `actionlint` directly when editing `.github/workflows/*.yml`.

---

## 3. Shared Verification & Workflow Commands

- **Inner Static Checks**: `npm run typecheck && npm run lint && npm run format:check`
- **Auto-Fix Lint & Format**: `npm run lint:fix && npm run format`
- **Unit Tests**: `npm run test:unit` (append `-- --reporter=tap-flat --no-color` for compact agent output)
- **Production Build**: `npm run build`
- **E2E Smoke Tests**: `npm run test:e2e` (Vitest Browser Mode with Playwright Chromium; append `-- --reporter=tap-flat --no-color` for compact agent output)
- **Full Verification Gate (DoD)**: `npm run verify` (`typecheck`, `lint`, `format:check`, `build`, and `npm test`)
- **On-Demand Audits**: `actionlint` (after workflow edits), `npx knip` (periodic deadcode audit), `npm audit --omit=dev` (runtime dependency audit)

---

## 4. Git Restrictions & Localization

- **NEVER execute `git commit` directly**: 1Password SSH signing fails in subshells. Stage with `git add` and output commit command in chat.
- **Traditional Chinese (繁體中文)**: All UI text, combat notifications, plans, and chat responses must strictly use Traditional Chinese.

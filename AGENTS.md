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
- **Tailwind SSOT**: Tailwind CSS v4 `@theme` in `src/global.css` is the sole design token source. Merged classes use `cn(...)`.
- **Zod Defense**: Untrusted external data (notations, JSON) must be validated with Zod. Never use unsafe casts.
- **Strict TypeScript & ESLint**: ESLint uses `strictTypeChecked` and `stylisticTypeChecked` with `typescript-eslint`, `noInlineConfig: true`, and Prettier formatting (`prettier-plugin-tailwindcss`, `prettier-plugin-packagejson`). Never use `// @ts-ignore`, `// @ts-expect-error`, `// @ts-nocheck`, or `/* eslint-disable */`.
- **Strict `.npmrc` Policy**: Keep `ignore-scripts=true`, `save-exact=true`, `install-strategy=linked`, `strict-peer-deps=true`, and `engine-strict=true` in `.npmrc`. Use `npm ci` for clean installs and `npm run test:setup` (`playwright install chromium`) explicitly for browser binaries.
- **Exact SemVer Action Pinning**: Pin GitHub Actions to exact stable SemVer tags (`@vX.Y.Z`, never `@v1` or `@v7.0`) and validate `.github/workflows/*.yml` locally with `actionlint`.

---

## 3. Verification Ladder

- **Inner Loop**: `npm run agent:verify:inner` (`npm run typecheck && npm run lint && npm run agent:lint:tailwind`)
- **Unit Suite**: `npm run agent:test:unit` (`vitest run --project unit --reporter=tap-flat --no-color`)
- **Unit Verification**: `npm run agent:verify:unit` (`npm run agent:verify:inner && npm run agent:test:unit`)
- **E2E Smoke**: `npm run agent:test:e2e` (`vitest run --project e2e --reporter=tap-flat --no-color`)
- **Unified Gate**: `npm run agent:verify:gate` (`npm run agent:verify:unit && npm run build && npm run agent:test:e2e`)
- **Full Verification**: `npm run verify` (`typecheck`, `lint`, `format:check`, `agent:lint:tailwind`, `check:deadcode`, `vitest run`, `vite build`)
- **Diagnostics & Formatting**: `npm run lint` (`eslint --max-warnings 0 .`), `npx prettier --write <files>`, `npm run agent:lint:ci` (`actionlint`)

---

## 4. Git Restrictions & Localization

- **NEVER execute `git commit` directly**: 1Password SSH signing fails in subshells. Stage with `git add` and output commit command in chat.
- **Traditional Chinese (繁體中文)**: All UI text, combat notifications, plans, and chat responses must strictly use Traditional Chinese.

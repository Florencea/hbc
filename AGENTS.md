<!--VITE PLUS START-->

## Vite+ Guidelines

This project uses Vite+. Use `vp` (or `vpr` shorthand for `vp run`):

- `vpr <script>`: Run scripts from `package.json`
- `vp install` / `vp update`: Manage dependencies
- `vp test`: Run Vitest suite (`unit`, `e2e`)
- `vp build`: Build production bundles
- `vp check` / `vp lint` / `vp fmt`: Oxlint & Oxfmt toolchain

<!--VITE PLUS END-->

# Agent Development Guidelines

Guidelines for contributors on the **`hbc`** repository (16x16 Multi-Faction Reversi Engine).

## 1. Quick Architecture Map

| Layer          | Path              | Responsibility                                 |
| :------------- | :---------------- | :--------------------------------------------- |
| **Engine**     | `src/engine/`     | Headless 16x16 Reversi engine & Fog of War     |
| **FX & Audio** | `src/fx/`         | Sound synthesizers & event choreography        |
| **Components** | `src/components/` | Modular React 19 UI component tree             |
| **App Root**   | `src/App.tsx`     | Game controller, loop, and match telemetry     |
| **E2E Smoke**  | `test/e2e/`       | Headless Vitest Playwright browser tests       |
| **Rules**      | `.agents/rules/`  | Domain rules (`engine`, `ui`, `locales`, `ci`) |

---

## 2. Core SSOT & Architectural Invariants

- **Headless Engine**: Absolutely NO DOM, Canvas, or React inside `src/engine/`. Tested headlessly in pure Node/TypeScript.
- **Pure State Transitions**: `dispatch(state, action)` is pure and deterministic, returning `{ nextState, events }`.
- **Fog of War & Security**: Hidden skills (`WALL`, `BOMB`, `COUNTER`, unrevealed `PIERCE`) remain confidential via `sanitizeForViewer`. Previews & AI operate on sanitized states.
- **Tailwind SSOT**: Tailwind CSS v4 `@theme` in `src/global.css` is the sole design token source. Merged classes use `cn(...)`.
- **Zod Defense**: Untrusted external data (notations, JSON) must be validated with Zod. Never use unsafe casts.
- **Zero Suppression**: Never use `// @ts-ignore`, `// @ts-expect-error`, or `/* oxlint-disable */`.

---

## 3. Verification Ladder

- **Inner Loop**: `npm run agent:verify:inner` (`vp check && node scripts/lint-tailwind.ts`)
- **Unit Suite**: `npm run agent:test:unit` (`vp test run --project unit --reporter=tap-flat --no-color`)
- **E2E Smoke**: `npm run agent:test:e2e` (`vp test run --project e2e --reporter=tap-flat --no-color`)
- **Unified Gate**: `npm run agent:verify:gate`
- **Full Verification**: `npm run verify`
- **CI Lint**: `npm run agent:lint:ci` (`actionlint`)

---

## 4. Git Restrictions & Localization

- **NEVER execute `git commit` directly**: 1Password SSH signing fails in subshells. Stage with `git add` and output commit command in chat.
- **Traditional Chinese (繁體中文)**: All UI text, combat notifications, plans, and chat responses must strictly use Traditional Chinese.

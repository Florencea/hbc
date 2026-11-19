# HBC - Multi-Team Reversi Game Engine

A high-performance, headless game engine and React 19 + TailwindCSS v4 frontend for **HBC**: a Multi-Team Reversi / Othello variant featuring 5 unique skills, hidden traps, and recursive chain reactions.

- **Live Demo**: [https://florencea.github.io/hbc/](https://florencea.github.io/hbc/)

## Core Architecture

- **Headless Engine First**: Zero DOM, Canvas, React, or UI framework dependencies inside `src/engine/`. Pure TypeScript deterministic state transitions.
- **Pure State Transitions & Event Sourcing**:
  ```ts
  dispatch(state: GameState, action: Action): { nextState: GameState; events: GameEvent[] }
  ```
- **Information Security (Fog of War) & Anti-Sonar Probing**:
  ```ts
  sanitizeForViewer(state: GameState, viewerPlayerId: number): MaskedGameState
  ```
  Masks unrevealed enemy trap pieces to `NONE` on the client side to prevent DevTools inspection. Client move indicators (`getAvailableMoves`) and hover previews strictly evaluate against sanitized states, preventing players from probing hidden `WALL` pieces by toggling `PIERCE`. The engine supports optimistic blind moves: placements perceived as legal that hit hidden walls resolve with wall reveals, 0 flips, and turn advances without throwing errors.
- **5-Skill Variant System**:
  - `WALL`: Intercepts and blocks incoming raycasts (revealed upon blocking).
  - `PIERCE`: Penetrates `WALL` pieces and is immune to Bomb, Purify, and Counter traps.
  - `BOMB`: 3x3 explosive detonation upon being flipped/captured, converting surrounding tiles and chaining adjacent bombs and counters.
  - `PURIFY`: Turn-end 3x3 cleansing pulse that converts tiles without triggering traps (lasts 3 turns).
  - `COUNTER`: Reverses the active flip batch back to defender faction upon being captured by non-PIERCE pieces.
- **React Compiler**: Automatic fine-grained memoization via `@vitejs/plugin-react` (`compiler: true`).
- **TailwindCSS v4**: Design tokens defined in `src/global.css` (`@theme`) and validated via headless `@tailwindcss/language-server`.

## Roadmap & Milestones

- [x] **Phase 1: 5-Skill Interaction Matrix & BFS Queue** — WALL, PIERCE, BOMB, PURIFY, COUNTER resolution pipeline.
- [x] **Phase 2: Player Hand Economy & Cooldown Ticking** — Dynamic inventory caps, energy charging, and forced special discharge.
- [x] **Phase 3: Map Presets & Drop Phase** — Crossroads, Archipelago, and Trenches procedural templates with drop zones.
- [x] **Phase 4: Pioneer Placement Mechanics** — Chebyshev distance <= 2 bridge building across open battlefield spaces.
- [x] **Phase 5: Anti-Sonar Fog of War & VFX Choreography** — Client sanitization, optimistic blind moves, and floating combat text.
- [x] **Phase 6: Heuristic Bot & Game Modes** — 1-ply positional heuristic bot with PVP, PVE, and AI vs AI spectator modes.
- [x] **Phase 7: AI Depth Search & Trap Risk Modeling** — 2-ply Minimax with Alpha-Beta pruning, trap risk heuristics, and pioneer safety.
- [x] **Phase 8: Match History & Visual Replay System** — PGN-like event stream serialization and step-by-step playback controls.
- [ ] **Phase 9: Multi-Team Scaling** — 1v1v1 Triangle Board and 2v2 Shared Vision Team Mode.
- [ ] **Phase 10: Peer-to-Peer / WebSocket Networking** — Headless game server room orchestration and live multiplayer synchronization.

## Quick Start

```bash
npm ci
npm run dev
```

## Verification Gates

The project enforces a strict `.npmrc` policy (`ignore-scripts=true`, `save-exact=true`, `install-strategy=linked`, `strict-peer-deps=true`, `engine-strict=true`) and provides multi-tier verification workflows:

### Inner Loop: Fast Feedback (`check:fast` / `agent:verify:inner`)

Run during active coding and refactoring for fast feedback:

```bash
npm run check:fast
```

Executes `typecheck` (`tsc -b --pretty false`) + `lint` (ESLint `strictTypeChecked` & `stylisticTypeChecked`) + `agent:test:unit` (Vitest unit tests).

### Complete Verification Gate (`verify`)

Run the complete Definition of Done before staging or deploying:

```bash
npm run verify
```

Executes:

1. `typecheck` (`tsc -b --pretty false`)
2. `lint` (ESLint `strictTypeChecked` + `stylisticTypeChecked`, `--max-warnings 0`)
3. `format:check` (Prettier formatting check)
4. `agent:lint:tailwind` (Tailwind CSS v4 canonical class & diagnostic check)
5. `check:deadcode` (Knip unused exports and dependency check)
6. `vitest run` (Unit & Playwright Chromium Browser tests)
7. `vite build` (Vite production bundle verification)

### Agent Verification Ladder (`agent:*`)

For autonomous coding agents, a non-interactive, zero-color ladder is provided:

- `npm run agent:verify:inner`: Static checks (`typecheck` + `lint` + `agent:lint:tailwind`).
- `npm run agent:test:unit`: Vitest headless unit suite in TAP flat format.
- `npm run agent:verify:unit`: Inner static checks + unit tests.
- `npm run agent:test:e2e`: Vitest Browser Mode (`@vitest/browser-playwright`) headless Chromium tests in TAP flat format.
- `npm run agent:verify:gate`: Full fail-fast verification ladder (`agent:verify:unit` -> `build` -> `agent:test:e2e`).

### Deployment Workflow

- **GitHub Pages Deployment (`.github/workflows/deploy.yml`)**: Runs on `push` to `main` or manual `workflow_dispatch` on `ubuntu-24.04` against `package.json` `engines.node`. Performs `npm ci`, builds with `BASE_PATH=/hbc/`, and deploys `dist/` to GitHub Pages.
- **Workflow Syntax Linting**: Validate `.github/workflows/*.yml` locally with `npm run agent:lint:ci` (`actionlint`) before staging changes.

## Available Commands & Scripts

| Script                       | Description                                                                        |
| :--------------------------- | :--------------------------------------------------------------------------------- |
| `npm run dev`                | Start local Vite development server                                                |
| `npm run build`              | Build production bundle with Vite                                                  |
| `npm run preview`            | Preview production build locally                                                   |
| `npm run typecheck`          | Run strict TypeScript project build checks (`tsc -b --pretty false`)               |
| `npm run lint`               | Run strict ESLint checks (`--max-warnings 0`)                                      |
| `npm run lint:fix`           | Run ESLint auto-fix                                                                |
| `npm run format`             | Format files with Prettier                                                         |
| `npm run format:check`       | Verify formatting with Prettier                                                    |
| `npm run lint:tailwind`      | Check Tailwind classes for canonical formatting                                    |
| `npm run lint:tailwind:fix`  | Auto-fix Tailwind non-canonical classes                                            |
| `npm test`                   | Run all Vitest projects (`unit` and `e2e`)                                         |
| `npm run test:unit`          | Run Vitest unit test project                                                       |
| `npm run test:e2e`           | Run Vitest Browser Mode (`@vitest/browser-playwright`) E2E project                 |
| `npm run test:setup`         | Install Playwright Chromium browser binaries                                       |
| `npm run check:deadcode`     | Run Knip deadcode and unused dependency detection                                  |
| `npm run agent:verify:inner` | Inner-loop validation (`typecheck` + `lint` + `agent:lint:tailwind`)               |
| `npm run agent:test:unit`    | Flat TAP output Vitest unit execution without colors                               |
| `npm run agent:test:e2e`     | Flat TAP output Vitest browser E2E execution without colors                        |
| `npm run agent:verify:gate`  | Automated verification gate (`agent:verify:unit` + `build` + `agent:test:e2e`)     |
| `npm run verify`             | Complete verification gate (typecheck, lint, format, tailwind, knip, tests, build) |
| `npm run agent:lint:fix`     | Run ESLint `--fix`, Prettier `--write`, and Tailwind canonical auto-fix            |
| `npm run agent:lint:ci`      | Check GitHub Actions workflows with `actionlint`                                   |

## Guidelines

For strict agent development guidelines, architectural rules, and verification standards, see [AGENTS.md](AGENTS.md).

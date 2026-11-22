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
- **Standard Vite + React 19**: Bundled via Vite 8 and official `@vitejs/plugin-react` without React Compiler rewriting.
- **TailwindCSS v4**: Design tokens defined in `src/global.css` (`@theme`) and deterministically sorted via `prettier-plugin-tailwindcss`.

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

The project enforces a strict `.npmrc` policy (`ignore-scripts=true`, `save-exact=true`, `install-strategy=linked`, `strict-peer-deps=true`, `engine-strict=true`) and relies on dependency `engines` ranges rather than a root `engines.node` pin. Toolchain updates follow a quarterly or semi-annual cadence with a 7-14 day cooldown window, prioritizing runtime issues via `npm audit --omit=dev`.

### Inner Static Checks

Run during active coding and refactoring for fast feedback:

```bash
npm run typecheck && npm run lint && npm run format:check
```

### Complete Verification Gate (`verify`)

Run the complete Definition of Done before staging or deploying:

```bash
npm run verify
```

Executes:

1. `typecheck` (`tsc -b --pretty false`, TypeScript 6)
2. `lint` (ESLint `strictTypeChecked` + `stylisticTypeChecked`, `--max-warnings 0`)
3. `format:check` (Prettier formatting and Tailwind CSS v4 class sorting check)
4. `build` (Vite 8 production bundle verification)
5. `test` (Vitest `unit` & Playwright Chromium Browser `e2e` tests)

For compact non-interactive agent output on test suites, append `-- --reporter=tap-flat --no-color` to `npm run test:unit` or `npm run test:e2e`.

### Deployment Workflow

- **GitHub Pages Deployment (`.github/workflows/deploy.yml`)**: Runs on `push` to `main` or manual `workflow_dispatch` on `ubuntu-24.04` using `node-version: "lts/*"`. Performs `npm ci`, builds with `BASE_PATH=/hbc/`, and deploys `dist/` to GitHub Pages.
- **Workflow Syntax Linting**: Validate `.github/workflows/*.yml` locally with `actionlint` before staging changes.

## Available Commands & Scripts

| Script                 | Description                                                                       |
| :--------------------- | :-------------------------------------------------------------------------------- |
| `npm run dev`          | Start local Vite development server                                               |
| `npm run build`        | Build production bundle with Vite                                                 |
| `npm run preview`      | Preview production build locally                                                  |
| `npm run typecheck`    | Run TypeScript 6 project build checks (`tsc -b --pretty false`)                   |
| `npm run lint`         | Run strict ESLint checks (`--max-warnings 0`)                                     |
| `npm run lint:fix`     | Run ESLint auto-fix                                                               |
| `npm run format`       | Format files and sort Tailwind classes with Prettier                              |
| `npm run format:check` | Verify formatting and Tailwind class ordering with Prettier                       |
| `npm test`             | Run all Vitest projects (`unit` and `e2e`)                                        |
| `npm run test:unit`    | Run Vitest unit test project                                                      |
| `npm run test:e2e`     | Run Vitest Browser Mode (`@vitest/browser-playwright`) E2E project                |
| `npm run test:setup`   | Install Playwright Chromium browser binaries                                      |
| `npm run verify`       | Complete verification gate (`typecheck`, `lint`, `format:check`, `build`, `test`) |

## Guidelines

For strict agent development guidelines, architectural rules, and verification standards, see [AGENTS.md](AGENTS.md).

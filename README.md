# HBC - Multi-Team Reversi Game Engine

A headless 16x16 game engine and zero-framework vanilla JavaScript + modern CSS frontend for **HBC**: a Multi-Team Reversi / Othello variant featuring 5 unique skills, hidden traps, and recursive chain reactions.

- **Live Demo**: [https://florencea.github.io/hbc/](https://florencea.github.io/hbc/)

## Core Architecture

- **Headless Engine First**: Zero DOM, Canvas, or UI framework dependencies inside `src/engine/`. Pure ESM JavaScript deterministic state transitions with `zod` boundary validation (`src/engine/replay.js`).
- **Pure State Transitions & Event Sourcing**:
  ```js
  dispatch(state, action); // -> { nextState, events }
  ```
- **Information Security (Fog of War) & Anti-Sonar Probing**:
  ```js
  sanitizeForViewer(state, viewerPlayerId); // -> MaskedGameState
  ```
  Masks unrevealed enemy trap pieces to `NONE` on the client side to prevent DevTools inspection. Client move indicators (`getAvailableMoves`) and hover previews strictly evaluate against sanitized states, preventing players from probing hidden `WALL` pieces by toggling `PIERCE`. The engine supports optimistic blind moves: placements perceived as legal that hit hidden walls resolve with wall reveals, 0 flips, and turn advances without throwing errors.
- **5-Skill Variant System**:
  - `WALL`: Intercepts and blocks incoming raycasts (revealed upon blocking).
  - `PIERCE`: Penetrates `WALL` pieces and is immune to Bomb, Purify, and Counter traps.
  - `BOMB`: 3x3 explosive detonation upon being flipped/captured, converting surrounding tiles and chaining adjacent bombs and counters.
  - `PURIFY`: Turn-end 3x3 cleansing pulse that converts tiles without triggering traps (lasts 3 turns).
  - `COUNTER`: Reverses the active flip batch back to defender faction upon being captured by non-PIERCE pieces.
- **Zero-Framework Frontend & Modern Web Standards**: Only `zod` is shipped in runtime `dependencies`. UI modules in `src/ui/` use persistent 256-cell DOM updates, native `<dialog closedby="any">` modals, `[popover="manual"]` top-layer toasts, `<progress>` / `<output>` / `<dl>` / `<ol>` semantics, `File.text()`, `AbortController`, and layered modern CSS (`@layer`, `color-mix(in oklch, ...)`, CSS Nesting, `@container`, `@starting-style`, `transition-behavior: allow-discrete`).
- **Zero-Plugin Vite + Native Node Testing**: Bundled via plain Vite 8, unit-tested via Node built-in `node:test` + `node:assert/strict`, and smoke-tested via Playwright Chromium against `vite preview`.

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

```bash
npm run lint && npm run format:check
```

### Complete Verification Gate (`verify`)

```bash
npm run verify
```

Executes:

1. `lint` (ESLint `@eslint/js`, `--max-warnings 0`, `noInlineConfig: true`)
2. `format:check` (Prettier default formatting check)
3. `build` (Vite 8 production bundle verification)
4. `test` (Node built-in `node:test` unit suite and Playwright Chromium E2E smoke suite)

### Deployment Workflow

- **GitHub Pages Deployment (`.github/workflows/deploy.yml`)**: Runs on `push` to `main` or manual `workflow_dispatch` on `ubuntu-24.04` using `node-version: "lts/*"`. Performs `npm ci`, builds with `BASE_PATH=/hbc/`, and deploys `dist/` to GitHub Pages.
- **Workflow Syntax Linting**: Validate `.github/workflows/*.yml` locally with `actionlint` before staging changes.

## Available Commands & Scripts

| Script                 | Description                                                          |
| :--------------------- | :------------------------------------------------------------------- |
| `npm run dev`          | Start local Vite development server                                  |
| `npm run build`        | Build production bundle with Vite                                    |
| `npm run preview`      | Preview production build locally                                     |
| `npm run lint`         | Run ESLint checks (`--max-warnings 0`)                               |
| `npm run lint:fix`     | Run ESLint auto-fix                                                  |
| `npm run format`       | Format files with Prettier                                           |
| `npm run format:check` | Verify formatting with Prettier                                      |
| `npm test`             | Run both `test:unit` and `test:e2e`                                  |
| `npm run test:unit`    | Run pure Node unit test suite (`node --test`)                        |
| `npm run test:e2e`     | Run Playwright Chromium E2E smoke tests (`node --test`)              |
| `npm run test:setup`   | Install Playwright Chromium browser binaries                         |
| `npm run verify`       | Complete verification gate (`lint`, `format:check`, `build`, `test`) |

## Guidelines

For strict agent development guidelines, architectural rules, and verification standards, see [AGENTS.md](AGENTS.md).

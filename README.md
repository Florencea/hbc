# HBC - Multi-Team Reversi Game Engine

[![CI](https://github.com/florencea/hbc/actions/workflows/ci.yml/badge.svg)](https://github.com/florencea/hbc/actions/workflows/ci.yml)

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
- **React Compiler**: Automatic fine-grained memoization via React Compiler.
- **TailwindCSS v4**: Design tokens defined in `src/global.css` (@theme) and validated via custom Oxide scanner.

## Roadmap & Milestones

- [x] **Phase 1: 5-Skill Interaction Matrix & BFS Queue** — WALL, PIERCE, BOMB, PURIFY, COUNTER resolution pipeline.
- [x] **Phase 2: Player Hand Economy & Cooldown Ticking** — Dynamic inventory caps, energy charging, and forced special discharge.
- [x] **Phase 3: Map Presets & Drop Phase** — Crossroads, Archipelago, and Trenches procedural templates with drop zones.
- [x] **Phase 4: Pioneer Placement Mechanics** — Chebyshev distance \(\le 2\) bridge building across open battlefield spaces.
- [x] **Phase 5: Anti-Sonar Fog of War & VFX Choreography** — Client sanitization, optimistic blind moves, and floating combat text.
- [x] **Phase 6: Heuristic Bot & Game Modes** — 1-ply positional heuristic bot with PVP, PVE, and AI vs AI spectator modes.
- [ ] **Phase 7: AI Depth Search & Trap Risk Modeling** — 2-ply Minimax with Alpha-Beta pruning, trap risk heuristics, and pioneer safety. _(In Progress)_
- [ ] **Phase 8: Match History & Visual Replay System** — PGN-like event stream serialization and step-by-step playback controls.
- [ ] **Phase 9: Multi-Team Scaling** — 1v1v1 Triangle Board and 2v2 Shared Vision Team Mode.
- [ ] **Phase 10: Peer-to-Peer / WebSocket Networking** — Headless game server room orchestration and live multiplayer synchronization.

## Quick Start

```bash
npm install
npm run dev
```

## Verification Gates

The project provides a two-tier verification workflow:

### Inner Loop: Fast Feedback (`check:fast`)

Run during active coding and refactoring for sub-second feedback:

```bash
npm run check:fast
```

Executes `typecheck` (`tsc -b`) + `lint` (ESLint strict) + `test` (Vitest unit tests).

### Outer Loop: Unified Verification Gate (`check`)

Run the complete Definition of Done before committing or completing tasks:

```bash
npm run check
```

Executes:

1. `typecheck` (`tsc -b`)
2. `lint` (ESLint strict + stylistic type checks)
3. `lint:tailwind` (Tailwind CSS v4 canonical class check)
4. `format:check` (Prettier code style validation)
5. `check:deadcode` (Knip unused exports and dependency check)
6. `test` (Vitest headless unit test suite)
7. `build` (Vite production bundle verification)

### Agent Verification Ladder (`agent:*`)

For autonomous coding agents and automated CI environments, a specialized, zero-formatting, fail-fast ladder is provided to eliminate ANSI escape sequences, spinners, and interactive prompts:

- `npm run agent:verify:inner`: Sub-second static checks (`agent:typecheck` + `agent:lint`).
- `npm run agent:test:unit`: Vitest headless suite in TAP flat output format.
- `npm run agent:test:e2e`: Playwright headless browser smoke tests (with auto-build preview server).
- `npm run agent:verify:gate`: Full fail-fast verification ladder (`agent:verify:inner` -> `agent:test:unit` -> `agent:test:e2e`).

### CI/CD Pipeline Architecture

The repository enforces a high-efficiency GitHub Actions automation strategy:

1. **Daily CI Pipeline (`.github/workflows/ci.yml`)**:
   - **Tier 1 (`gatekeeper`)**: Runs on `ubuntu-latest` against the authoritative Node.js runtime (`package.json` engines, v24 Active LTS). Executes clean installation (`npm ci`), browser dependencies (`playwright install --with-deps chromium`), static analysis, unit test suite, production build, and Playwright E2E smoke tests. On failure, Playwright traces and test artifacts are captured via `actions/upload-artifact@v7`.
   - **Tier 2 (`platform-compat`)**: Executes upon Tier 1 success (`needs: [gatekeeper]`) across `windows-latest` and `macos-latest`. Validates native toolchain bindings (e.g. Rolldown, LightningCSS) and operating system path separator handling (`\` vs `/`) using `build` and unit tests, eliminating duplicate static analysis or heavy browser runners.
2. **Upstream Runtime Canary (`.github/workflows/node-canary.yml`)**:
   - Runs weekly via cron (`0 3 * * 1` - Mondays 03:00 UTC) and manual trigger (`workflow_dispatch`) on `ubuntu-latest`.
   - Tests against upcoming Node.js 26 (Current line moving toward Active LTS in Oct 2026).
   - Bypasses strict engine constraints (`--engine-strict=false`) and executes build and unit tests with `continue-on-error: true` to surface upstream diagnostics without breaking repository pass status.
3. **Workflow Syntax & Expression Linting**:
   - All workflow YAML files are strictly validated with `actionlint` to prevent syntax regressions and injection vulnerabilities.

## Available Scripts

### Human Ergonomics

| Script                      | Description                                           |
| :-------------------------- | :---------------------------------------------------- |
| `npm run dev`               | Start local Vite development server                   |
| `npm run check:fast`        | Fast inner-loop check (`typecheck` + `lint` + `test`) |
| `npm run check`             | Run the full unified verification gate                |
| `npm run test`              | Run Vitest unit and integration tests                 |
| `npm run test:e2e`          | Run Playwright E2E smoke tests                        |
| `npm run lint`              | Run ESLint strict checks                              |
| `npm run lint:tailwind`     | Check Tailwind classes for canonical formatting       |
| `npm run lint:tailwind:fix` | Auto-fix Tailwind non-canonical classes               |
| `npm run lint:workflows`    | Check GitHub Actions workflows with actionlint        |
| `npm run format`            | Format files with Prettier                            |
| `npm run format:check`      | Check file formatting with Prettier                   |
| `npm run check:deadcode`    | Check for unused code and dependencies with Knip      |
| `npm run build`             | Build production bundle                               |

### Agent & CI Ergonomics

| Script                       | Description                                                     |
| :--------------------------- | :-------------------------------------------------------------- |
| `npm run agent:typecheck`    | Strict TypeScript compiler check (`tsc -b --pretty false`)      |
| `npm run agent:lint`         | Pure non-colored ESLint and Tailwind canonical checks           |
| `npm run agent:test:unit`    | Flat TAP output Vitest execution without colors or spinners     |
| `npm run agent:test:e2e`     | Headless Playwright tests in line-by-line reporter mode         |
| `npm run agent:verify:inner` | Inner-loop fail-fast validation (`typecheck` + `lint`)          |
| `npm run agent:verify:gate`  | Full automated gate (`verify:inner` + `test:unit` + `test:e2e`) |

## Guidelines

For strict agent development guidelines, architectural rules, and verification standards, see [AGENTS.md](AGENTS.md).

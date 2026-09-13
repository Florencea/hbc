# HBC - Multi-Team Reversi Game Engine

A high-performance, headless game engine and React 19 + TailwindCSS v4 frontend for **HBC**: a Multi-Team Reversi / Othello variant featuring 5 unique skills, hidden traps, and recursive chain reactions.

## Core Architecture

- **Headless Engine First**: Zero DOM, Canvas, React, or UI framework dependencies inside `src/engine/`. Pure TypeScript deterministic state transitions.
- **Pure State Transitions & Event Sourcing**:
  ```ts
  dispatch(state: GameState, action: Action): { nextState: GameState; events: GameEvent[] }
  ```
- **Information Security (Fog of War)**:
  ```ts
  sanitizeForViewer(state: GameState, viewerPlayerId: number): MaskedGameState
  ```
  Masks unrevealed enemy trap pieces to `NONE` on the client side to prevent DevTools inspection.
- **5-Skill Variant System**:
  - `WALL`: Intercepts and blocks incoming raycasts (revealed upon blocking).
  - `PIERCE`: Penetrates `WALL` pieces and is immune to Bomb, Purify, and Counter traps.
  - `BOMB`: 3x3 explosive detonation upon being flipped/captured, converting surrounding tiles and chaining adjacent bombs and counters.
  - `PURIFY`: Turn-end 3x3 cleansing pulse that converts tiles without triggering traps (lasts 3 turns).
  - `COUNTER`: Reverses the active flip batch back to defender faction upon being captured by non-PIERCE pieces.
- **React Compiler**: Automatic fine-grained memoization via React Compiler.
- **TailwindCSS v4**: Design tokens defined in `src/global.css` (@theme) and validated via custom Oxide scanner.

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

## Available Scripts

| Script                      | Description                                           |
| :-------------------------- | :---------------------------------------------------- |
| `npm run dev`               | Start local Vite development server                   |
| `npm run check:fast`        | Fast inner-loop check (`typecheck` + `lint` + `test`) |
| `npm run check`             | Run the full unified verification gate                |
| `npm run test`              | Run Vitest unit tests                                 |
| `npm run lint`              | Run ESLint strict checks                              |
| `npm run lint:tailwind`     | Check Tailwind classes for canonical formatting       |
| `npm run lint:tailwind:fix` | Auto-fix Tailwind non-canonical classes               |
| `npm run format`            | Format files with Prettier                            |
| `npm run format:check`      | Check file formatting with Prettier                   |
| `npm run check:deadcode`    | Check for unused code and dependencies with Knip      |
| `npm run build`             | Build production bundle                               |

## Guidelines

For strict agent development guidelines, architectural rules, and verification standards, see [AGENTS.md](AGENTS.md).

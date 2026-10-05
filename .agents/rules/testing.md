---
trigger: glob
globs: "src/**/__tests__/**, test/**"
description: TDD testing standards, test suite coverage requirements, and Vitest browser project rules.
---

# Testing Standards (TDD & Spec-Driven)

## 1. Engine & Logic Unit Tests (`src/engine/__tests__/`)

- All game mechanics must be tested headlessly in pure Node/TypeScript execution environments without browser mocks.
- Test suites must cover:
  1. 8-direction raycast and boundary conditions.
  2. Multi-team ally/enemy logic.
  3. `WALL` blocking and `PIERCE` penetration.
  4. `COUNTER` reversal mechanics.
  5. `BOMB` 3x3 explosion and recursive chain reaction.
  6. `PURIFY` pulse aura and 3-turn lifespan decay.
  7. Fog of war sanitization for opponent and teammate perspectives.
  8. Optimistic blind moves into hidden `WALL`s with 0 captures and anti-sonar sanitized move equivalence.

## 2. Browser & Component Smoke Tests (`test/e2e/`)

- Runs directly inside Vitest via `vite-plus/test/browser-playwright` and headless Chromium.
- Smoke tests verify heading, board layout, dual AI automation, and replay modal interaction.
- Never use `.only` in test suites (`allowOnly: !process.env.CI`).
- Output format: flat TAP (`vp test run --reporter=tap-flat --no-color`).

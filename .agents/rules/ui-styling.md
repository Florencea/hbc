---
trigger: glob
globs: "src/components/**, src/fx/**, src/App.tsx"
description: UI layout stability, anti-jitter rules, and combat FX / audio choreography integration.
---

# UI & Combat Styling Standards (Anti-Jitter & FX Choreography)

## 1. UI Layout Stability & Anti-Jitter Rule (防盤面位移規範)

- **Floating Toasts for Notifications**: All transient notifications (e.g., invalid move errors, rule violations) must be rendered as fixed/absolute floating toasts (e.g. `fixed top-6 left-1/2 -translate-x-1/2 z-50`) instead of pushing the normal document flow.
- **Reserved Height for Status Indicators**: Status indicator bars above the board (e.g., animation locks, phase banners) must maintain fixed heights or stable placement to prevent any vertical or horizontal displacement of the chessboard under the user's cursor.
- **Fixed Chessboard Geometry**: The 16x16 grid and cell dimensions must remain invariant during phase transitions, skill activations, or modal openings.

## 2. Combat VFX & Audio Choreography Integration

- **Event Choreography**: Visual playback (`src/components/FloatingCombatText.tsx`) and sound effects (`src/fx/sound.ts`) must consume the ordered event stream produced by engine `dispatch`.
- **Z-Index Layering**: Floating combat badges and text must reside in the dedicated overlay plane (`z-50`) without triggering layout reflow or cell re-renders.
- **Audio Synthesis Safety**: Web Audio synthesis in `src/fx/sound.ts` must handle mute toggles gracefully and remain non-blocking during rapid AI-vs-AI autoplay.

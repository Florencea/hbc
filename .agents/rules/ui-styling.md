---
trigger: glob
globs: "src/ui/**, src/styles/**, src/fx/**, src/app.js, src/global.css"
description: UI layout stability, anti-jitter rules, modern web platform primitives, and combat FX / audio choreography integration.
---

# UI & Combat Styling Standards (Anti-Jitter & FX Choreography)

## 1. UI Layout Stability & Anti-Jitter Rule (防盤面位移規範)

- **Top-Layer Native Overlays**: Transient notifications use native `[popover="manual"]` (`src/ui/toastHost.js`) and modal dialogs use native `<dialog closedby="any">` (`src/ui/modals.js`) with `overscroll-behavior: contain` on `dialog:modal` and `dialog::backdrop` rather than locking `body` scrollbars or pushing document flow.
- **Reserved Height for Status Indicators**: Status indicator bars above the board (`src/ui/battlefieldStatusBar.js`) must maintain a fixed minimum block size (`min-block-size: 3rem`) to prevent vertical displacement of the chessboard under the user's cursor.
- **Persistent Chessboard Geometry**: `src/ui/gameBoard.js` mounts the 256 (`16x16`) board cells once with `aspect-ratio: 1` and updates cell state incrementally via `data-*` attributes so dimensions remain invariant during hover previews, skill activations, or modal openings.

## 2. Combat VFX & Audio Choreography Integration

- **Event Choreography**: Visual playback (`src/ui/boardOverlay.js`, `src/ui/floatingCombatText.js`) and sound effects (`src/fx/sound.js`) must consume the ordered event stream produced by engine `dispatch`.
- **Keyed Overlay Layering**: Floating combat badges and SVG VFX reside in dedicated keyed overlay layers without triggering layout reflow or board cell re-renders.
- **Audio Synthesis Safety**: Web Audio synthesis in `src/fx/sound.js` must handle mute toggles gracefully and remain non-blocking during rapid AI-vs-AI autoplay.

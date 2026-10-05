---
trigger: glob
globs: "src/components/**, src/App.tsx, src/global.css"
description: React 19 paradigms, Tailwind CSS v4 styling rules, and layout stability / anti-jitter rules.
---

# UI & Styling Standards (React 19 & Tailwind CSS v4)

## 1. React Compiler Paradigms

- Automatic fine-grained memoization is enabled via `@vitejs/plugin-react` (`compiler: true`) and `oxc-transform-react`.
- Do not write manual `useMemo`, `useCallback`, or `React.memo` unless handling explicit compiler bailouts.
- Direct ref passing: pass `ref` directly as a regular prop. Never use `React.forwardRef`.
- Explicit component typing: avoid `React.FC`. Declare custom interfaces and type `children` as `React.ReactNode`.

## 2. Tailwind CSS v4 Styling

- Tailwind CSS v4 `@theme` in `src/global.css` is the sole source of truth for design tokens.
- Use Tailwind CSS v4 canonical class syntax. Run `npm run agent:lint:tailwind` to diagnose non-canonical classes and `npm run agent:lint:tailwind:fix` to format them.
- **Merge Classes Reliably**: NEVER concatenate class strings manually (`${a} ${b}`). Always use `cn(...)` via `clsx` and `tailwind-merge` (`src/lib/cn.ts`).

## 3. UI Layout Stability & Anti-Jitter Rule (防盤面位移規範)

- **Floating Toasts for Notifications**: All transient notifications (e.g., invalid move errors, rule violations) must be rendered as fixed/absolute floating toasts (e.g. `fixed top-6 left-1/2 -translate-x-1/2 z-50`) instead of pushing the normal document flow.
- **Reserved Height for Status Indicators**: Status indicator bars above the board (e.g., animation locks, phase banners) must maintain fixed heights or stable placement to prevent any vertical or horizontal displacement of the chessboard under the user's cursor.

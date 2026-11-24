import { el } from "./dom.js";

const VARIANT_ICONS = Object.freeze({
  bomb: "💥",
  counter: "🌌",
  purify: "✨",
  blocked: "🛡️",
  pierce: "🏹",
});

export function createFloatingCombatText() {
  const element = el("div", {
    className: "combat-text-layer",
    "aria-hidden": "true",
  });
  const mounted = new Map();

  function update(items, boardSize) {
    const activeIds = new Set();
    for (const item of items) {
      activeIds.add(item.id);
      if (!mounted.has(item.id)) {
        const leftPercent = ((item.coord.x + 0.5) / boardSize) * 100;
        const topPercent = ((item.coord.y + 0.5) / boardSize) * 100;
        const icon = VARIANT_ICONS[item.variant];
        const node = el(
          "div",
          {
            className: "combat-text-item",
            cssVars: {
              "--fx-x": `${leftPercent}%`,
              "--fx-y": `${topPercent}%`,
            },
          },
          el(
            "span",
            {
              className: "combat-badge",
              dataset: { variant: item.variant },
            },
            icon ? el("span", null, icon) : null,
            el("span", null, item.text),
          ),
        );
        mounted.set(item.id, node);
        element.appendChild(node);
      }
    }

    for (const [id, node] of mounted.entries()) {
      if (!activeIds.has(id)) {
        node.remove();
        mounted.delete(id);
      }
    }
  }

  return { element, update };
}

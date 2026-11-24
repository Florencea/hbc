import { el, setBoolAttr } from "./dom.js";
import { MAP_PRESETS } from "./gameUiConstants.js";

export function createMapPresetBar(actions, signal) {
  const presetButtons = new Map();

  const buttonsWrap = el(
    "div",
    { className: "map-preset-group", role: "group", "aria-label": "地圖預設" },
    ...MAP_PRESETS.map(({ preset, label, desc }) => {
      const btn = el(
        "button",
        {
          type: "button",
          className: "btn btn-neutral",
          signal,
          on: {
            click: () => {
              actions.onSelectPreset(preset);
            },
          },
        },
        el("span", null, label),
        el("span", { className: "preset-desc" }, `(${desc})`),
      );
      presetButtons.set(preset, btn);
      return btn;
    }),
  );

  const neutralOutput = el("output", null, "0");

  const element = el(
    "section",
    { className: "map-preset-bar app-container" },
    el(
      "div",
      { className: "map-preset-group" },
      el("span", { className: "section-kicker" }, "地圖預設："),
      buttonsWrap,
    ),
    el(
      "div",
      { className: "neutral-pill" },
      el("span", { className: "anchor-label" }, "⚓ 中立錨點："),
      " ",
      neutralOutput,
      " 顆",
    ),
  );

  function update(vm) {
    for (const [preset, btn] of presetButtons.entries()) {
      const isSelected = vm.selectedPreset === preset;
      btn.className = `btn ${isSelected ? "btn-primary" : "btn-neutral"}`;
      btn.setAttribute("aria-pressed", String(isSelected));
      setBoolAttr(btn, "disabled", vm.isAnimating);
    }
    neutralOutput.textContent = String(vm.neutralCount);
  }

  return { element, update };
}

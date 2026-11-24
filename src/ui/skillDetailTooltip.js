import { el } from "./dom.js";
import { SKILL_CONFIG, SKILL_DETAILS } from "./gameUiConstants.js";

/**
 * Creates a WCAG 1.4.13 compliant skill detail tooltip (Hoverable, Dismissible via Escape, Persistent).
 * Linked to its trigger button via aria-describedby (never aria-expanded on an action button).
 */
export function createSkillDetailTooltip(skillType, index, tooltipId) {
  const detail = SKILL_DETAILS[skillType];
  const config = SKILL_CONFIG[skillType];
  const isTopRow = index < 2;
  const isLeftCol = index % 2 === 0;

  return el(
    "div",
    {
      id: tooltipId,
      role: "tooltip",
      className: "skill-tooltip",
      dataset: {
        row: isTopRow ? "top" : "bottom",
        col: isLeftCol ? "left" : "right",
        dismissed: "false",
      },
    },
    el(
      "div",
      { className: "tooltip-header" },
      el(
        "div",
        { className: "skill-btn-title" },
        el(
          "span",
          { className: "skill-token", "aria-hidden": "true" },
          config.code
            ? el(
                "span",
                {
                  className: "piece-skill-badge",
                  dataset: { skill: skillType },
                },
                config.code,
              )
            : el("span", { className: "text-muted" }, "●"),
        ),
        el(
          "div",
          null,
          el("div", { className: "player-name" }, detail.name),
          el("div", { className: "preset-desc" }, detail.role),
        ),
      ),
      el(
        "span",
        { className: "tooltip-badge", dataset: { skill: skillType } },
        detail.badge,
      ),
    ),
    el(
      "div",
      { className: "tooltip-meta-grid" },
      el(
        "div",
        { className: "tooltip-meta-cell" },
        el("span", { className: "text-muted" }, "冷卻時間"),
        el("span", { className: "text-mono text-amber" }, detail.cdText),
      ),
      el(
        "div",
        { className: "tooltip-meta-cell" },
        el("span", { className: "text-muted" }, "手牌上限"),
        el("span", { className: "text-mono text-emerald" }, detail.maxHandText),
      ),
      el(
        "div",
        { className: "tooltip-meta-cell" },
        el("span", { className: "text-muted" }, "觸發機制"),
        el("span", { className: "text-cyan" }, detail.trigger),
      ),
    ),
    el(
      "div",
      { className: "tooltip-body" },
      el(
        "div",
        null,
        el("strong", null, "【作用效果】"),
        el("p", null, detail.effect),
      ),
      el(
        "div",
        null,
        el("strong", { className: "text-amber" }, "【戰術建議】"),
        el("p", { className: "text-muted" }, detail.tactics),
      ),
    ),
  );
}

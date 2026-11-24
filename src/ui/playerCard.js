import { SKILL_SPECS } from "../engine/constants.js";
import { el, setBoolAttr, setData } from "./dom.js";
import { SKILL_CONFIG, SKILL_OPTIONS } from "./gameUiConstants.js";
import { createSkillDetailTooltip } from "./skillDetailTooltip.js";

export function createPlayerCard(teamId, actions, signal) {
  const isTeam1 = teamId === 1;

  const nameEl = el("h2", { className: "player-name" });
  const turnBadge = el("span", { className: "turn-badge" });
  const forcedPill = el(
    "span",
    { className: "forced-pill", hidden: true },
    "⚡ 強制特技",
  );
  const specialsPill = el("span", { className: "specials-pill" });
  const countPill = el("span", { className: "count-pill" });

  const header = el(
    "div",
    { className: "player-card-header" },
    el(
      "div",
      { className: "player-identity" },
      el("span", {
        className: "team-swatch",
        dataset: { team: teamId },
        "aria-hidden": "true",
      }),
      nameEl,
      turnBadge,
    ),
    el(
      "div",
      { className: "player-badges" },
      forcedPill,
      specialsPill,
      countPill,
    ),
  );

  // Fog-of-War AI View
  const aiFogStatus = el("span", { className: "turn-badge" });
  const aiFogDesc = el("p", { className: "ai-fog-desc" });
  const aiFogBox = el(
    "div",
    { className: "ai-fog-box", hidden: true },
    el(
      "div",
      { className: "ai-fog-row" },
      el(
        "div",
        { className: "player-identity" },
        el("span", { "aria-hidden": "true" }, "🤖"),
        el("strong", null, `AI 電腦決策核心（${isTeam1 ? "黑方" : "白方"}）`),
      ),
      aiFogStatus,
    ),
    aiFogDesc,
    el(
      "div",
      { className: "ai-fog-footer" },
      el("span", null, "戰術策略：全域啟發式權重評估"),
      el("span", { className: "text-mono" }, "MEDIUM"),
    ),
  );

  // Interactive Hand View
  const forcedBannerText = el("span");
  const forcedBanner = el(
    "div",
    { className: "forced-banner", hidden: true },
    el("strong", null, "⚡ 強制特技"),
    forcedBannerText,
  );

  const skillRefs = new Map();
  const skillGrid = el(
    "div",
    { className: "skill-grid" },
    ...SKILL_OPTIONS.map((opt, optIdx) => {
      const config = SKILL_CONFIG[opt.type];
      const tooltipId = `skill-tip-t${teamId}-${opt.type.toLowerCase()}`;
      const tooltipEl = createSkillDetailTooltip(opt.type, optIdx, tooltipId);
      const stockTag = el("span", { className: "stock-tag" });
      const bottomSlot = el("div", { className: "skill-btn-bottom" });

      const btn = el(
        "button",
        {
          type: "button",
          className: "skill-btn",
          "aria-describedby": tooltipId,
          dataset: { team: teamId },
          signal,
          on: {
            click: () => {
              actions.onSelectSkill(opt.type);
            },
            keydown: (event) => {
              if (event.key === "Escape") {
                tooltipEl.dataset.dismissed = "true";
              }
            },
            blur: () => {
              tooltipEl.dataset.dismissed = "false";
            },
          },
        },
        el(
          "div",
          { className: "skill-btn-top" },
          el(
            "div",
            { className: "skill-btn-title" },
            el(
              "span",
              {
                className: "skill-token",
                dataset: { team: teamId },
                "aria-hidden": "true",
              },
              config.code
                ? el(
                    "span",
                    {
                      className: "piece-skill-badge",
                      dataset: { skill: opt.type },
                    },
                    config.code,
                  )
                : null,
            ),
            el(
              "span",
              { className: "skill-name-text" },
              opt.label.split(" ")[0] ?? opt.label,
            ),
          ),
          stockTag,
        ),
        bottomSlot,
      );

      const slotEl = el(
        "div",
        {
          className: "skill-slot",
          signal,
          on: {
            mouseleave: () => {
              tooltipEl.dataset.dismissed = "false";
            },
          },
        },
        btn,
        tooltipEl,
      );

      skillRefs.set(opt.type, {
        opt,
        config,
        btn,
        stockTag,
        bottomSlot,
        lastBottomSig: "",
      });
      return slotEl;
    }),
  );

  const handContainer = el("div", null, forcedBanner, skillGrid);
  const element = el(
    "section",
    { className: "player-card", dataset: { team: teamId, active: "false" } },
    header,
    aiFogBox,
    handContainer,
  );

  function update(vm) {
    setData(element, "active", vm.isActive ? "true" : "false");
    nameEl.textContent = `${isTeam1 ? "第一隊（黑方）" : "第二隊（白方）"}${vm.isAi ? " (AI 電腦)" : ""}`;
    turnBadge.textContent = vm.isActive
      ? vm.isAi
        ? "思考中"
        : "行動中"
      : "等待中";
    setData(turnBadge, "active", vm.isActive ? "true" : "false");

    forcedPill.hidden = !(!vm.isAi && vm.player?.isForcedSpecial === true);
    specialsPill.textContent = `特技: ${vm.isAi && !vm.isGodMode ? "迷霧隱藏" : `${vm.specialsCount} 枚`}`;
    countPill.textContent = `盤面: ${vm.boardPieceCount} 顆`;

    const showFog = vm.isAi && !vm.isGodMode;
    aiFogBox.hidden = !showFog;
    handContainer.hidden = showFog;

    if (showFog) {
      aiFogStatus.textContent = vm.isActive ? "即時運算中" : "待命狀態";
      setData(aiFogStatus, "active", vm.isActive ? "true" : "false");
      aiFogDesc.textContent =
        vm.gameMode === "PVE" && !isTeam1
          ? "單人對戰模式：電腦戰略佈局與特技手牌均受戰爭迷霧嚴格保護，不公開顯示。"
          : `演示模式：${isTeam1 ? "黑方" : "白方"}戰略佈局與特技手牌受戰爭迷霧保護（切換為上帝視角可查看完整手牌）。`;
      return;
    }

    const showForcedBanner = vm.player?.isForcedSpecial === true && vm.isActive;
    forcedBanner.hidden = !showForcedBanner;
    if (showForcedBanner) {
      const effName = SKILL_CONFIG[vm.effectiveSkill].label.split(" ")[0] ?? "";
      forcedBannerText.textContent = vm.isAi
        ? `AI 已選【${effName}】`
        : "庫存已滿・限落特殊棋";
    }

    for (const ref of skillRefs.values()) {
      const { opt, config, btn, stockTag, bottomSlot } = ref;
      const isNone = opt.type === "NONE";
      const spec = isNone ? null : SKILL_SPECS[opt.type];
      const count = isNone ? Infinity : (vm.player?.hand[opt.type] ?? 0);
      const maxHand = spec?.maxHand ?? Infinity;
      const charge = isNone ? 0 : (vm.player?.charge[opt.type] ?? 0);
      const cd = spec?.cd ?? 0;

      const isOutOfStock = !isNone && count <= 0;
      const isForbidden = isNone && (vm.player?.isForcedSpecial ?? false);
      const isDisabled =
        vm.isAnimating ||
        !vm.isActive ||
        isOutOfStock ||
        isForbidden ||
        vm.isAi;
      const isSelected = vm.isActive && vm.effectiveSkill === opt.type;

      setBoolAttr(btn, "disabled", isDisabled);
      setData(btn, "selected", isSelected ? "true" : "false");
      setData(
        btn,
        "ready",
        !isNone && count > 0 ? (count >= maxHand ? "max" : "stock") : "",
      );
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.setAttribute(
        "aria-label",
        `${config.label}，庫存 ${isNone ? "無限" : `${count} 枚`}`,
      );

      stockTag.textContent = isNone ? "∞" : `${count}/${maxHand}`;
      setData(
        stockTag,
        "level",
        isNone
          ? "none"
          : count >= maxHand
            ? "max"
            : count > 0
              ? "available"
              : "empty",
      );

      const bottomSig = `${isForbidden}|${isNone}|${count}|${maxHand}|${charge}|${cd}`;
      if (ref.lastBottomSig !== bottomSig) {
        ref.lastBottomSig = bottomSig;
        if (isForbidden) {
          bottomSlot.replaceChildren(
            el("span", { className: "text-rose" }, "🚫 禁落常規棋"),
          );
        } else if (isNone) {
          bottomSlot.replaceChildren(
            el("span", { className: "text-muted" }, "無限庫存"),
          );
        } else if (count >= maxHand) {
          bottomSlot.replaceChildren(
            el(
              "div",
              { className: "charge-row" },
              el("strong", { className: "text-amber" }, "就緒 MAX"),
              el("span", { className: "text-mono text-amber" }, "可部署"),
            ),
          );
        } else {
          const tone =
            count === 0
              ? charge >= cd - 1
                ? "amber-bright"
                : "amber"
              : charge >= cd - 1
                ? "zinc-bright"
                : "zinc";
          bottomSlot.replaceChildren(
            el(
              "div",
              { className: "charge-row" },
              el(
                "span",
                { className: count === 0 ? "text-amber" : "text-muted" },
                count === 0 ? "充能中" : "充能",
              ),
              el("span", { className: "text-mono" }, `${charge}/${cd}`),
            ),
            el("progress", {
              className: "charge-meter",
              value: Math.min(cd, charge),
              max: cd,
              "aria-label": `${config.label} 充能進度 ${charge} / ${cd}`,
              dataset: { tone },
            }),
          );
        }
      }
    }
  }

  return { element, update };
}

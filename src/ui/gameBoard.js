import { isWithinDropZone } from "../engine/map.js";
import { createBoardOverlay } from "./boardOverlay.js";
import { el, setBoolAttr, setCssVar, setData } from "./dom.js";
import { createFloatingCombatText } from "./floatingCombatText.js";
import { getPieceVisualState, SKILL_CONFIG } from "./gameUiConstants.js";

export function createGameBoard(actions, signal) {
  const overlay = createBoardOverlay();
  const combatText = createFloatingCombatText();

  const gridEl = el("div", {
    className: "board-grid",
    role: "grid",
    "aria-label": "16x16 黑白棋盤面",
    signal,
    on: {
      mouseleave: () => {
        actions.setHoveredCoord(null);
      },
    },
  });

  const stageEl = el(
    "div",
    { className: "board-stage" },
    overlay.element,
    combatText.element,
    gridEl,
  );

  const frameEl = el("div", { className: "board-frame" }, stageEl);

  let builtSize = 0;
  let cellRefs = [];
  let latestVm = null;

  function ensureGrid(size) {
    if (builtSize === size) return;
    builtSize = size;
    setCssVar(gridEl, "--board-size", size);
    cellRefs = [];
    const frag = document.createDocumentFragment();

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const coord = { x, y };
        const colChar = String.fromCharCode(65 + x);
        const cellLabel = `${colChar}${y + 1}`;
        const key = `${x},${y}`;

        const button = el("button", {
          type: "button",
          className: "board-cell",
          "aria-label": `棋格 ${cellLabel}`,
          dataset: {
            checker: (x + y) % 2 === 0 ? "even" : "odd",
          },
          signal,
          on: {
            mouseenter: () => {
              if (
                latestVm &&
                !latestVm.isAnimating &&
                !latestVm.isCurrentPlayerAi &&
                latestVm.standardMoveSet.has(key)
              ) {
                actions.setHoveredCoord(coord);
              }
            },
            mouseleave: () => {
              if (
                latestVm?.hoveredCoord?.x === x &&
                latestVm.hoveredCoord.y === y
              ) {
                actions.setHoveredCoord(null);
              }
            },
            click: () => {
              actions.setHoveredCoord(null);
              actions.onCellClick(coord);
            },
          },
        });

        frag.appendChild(button);
        cellRefs.push({
          x,
          y,
          key,
          button,
          lastSignature: "",
        });
      }
    }

    gridEl.replaceChildren(frag);
  }

  function update(vm) {
    latestVm = vm;
    const size = vm.gameState.size;
    ensureGrid(size);
    setData(frameEl, "shaking", vm.isScreenShaking ? "true" : "false");

    overlay.update({
      boardSize: size,
      blastWaves: vm.blastWaves,
      auraPulses: vm.auraPulses,
      shieldRipples: vm.shieldRipples,
      pierceStrikes: vm.pierceStrikes,
      abyssVortices: vm.abyssVortices,
      pioneerBridges: vm.pioneerBridges,
    });
    combatText.update(vm.floatingTexts, size);

    const dropTeam = vm.gameMode === "PVE" ? 1 : vm.activePlayerTeamId;

    for (let i = 0; i < cellRefs.length; i++) {
      const ref = cellRefs[i];
      const { x, y, key, button } = ref;
      const piece = vm.currentBoard[y]?.[x] ?? null;
      const isStandardLegal = vm.standardMoveSet.has(key);
      const isPioneerLegal = vm.pioneerMoveSet.has(key);
      const isLegal = isStandardLegal || isPioneerLegal;
      const inDropZone =
        vm.gameState.isDropPhase &&
        vm.effectiveDropZone !== undefined &&
        isWithinDropZone({ x, y }, vm.effectiveDropZone);
      const isFlipping = vm.flippingCoords.has(key);
      const isPopping = vm.poppingCoord?.x === x && vm.poppingCoord.y === y;
      const isHovered = vm.hoveredCoord?.x === x && vm.hoveredCoord.y === y;
      const isPreviewPlacement =
        !vm.isAnimating && piece === null && isHovered && isStandardLegal;
      const isPreviewFlipped =
        !vm.isAnimating && vm.previewCapturedSet.has(key);
      const disabled =
        vm.isAnimating ||
        vm.gameState.isGameOver ||
        (vm.gameMode === "PVE" && vm.gameState.activePlayerId === 2) ||
        (piece !== null && !isLegal);

      const dropZoneState = vm.gameState.isDropPhase
        ? inDropZone
          ? "in"
          : "out"
        : "";

      setData(button, "dropZone", dropZoneState);
      setData(button, "dropTeam", dropZoneState === "in" ? dropTeam : "");
      setData(button, "animating", vm.isAnimating ? "true" : "false");
      setData(button, "legal", isLegal ? "true" : "false");
      setData(button, "activeTeam", vm.activePlayerTeamId);
      setBoolAttr(button, "disabled", disabled);

      let contentSig;
      if (piece !== null) {
        const visual = getPieceVisualState(piece, {
          isPreviewFlipped,
          activePlayerTeamId: vm.activePlayerTeamId,
          viewerTeamId: vm.viewerTeamId,
        });
        const dur =
          !isPreviewFlipped &&
          piece.skillType === "PURIFY" &&
          piece.duration !== undefined
            ? piece.duration
            : "";
        contentSig = `P:${visual.displayTeamId}:${visual.rimState}:${visual.isOwnHidden ? 1 : 0}:${visual.glowSkill}:${isPreviewFlipped ? "" : piece.skillType}:${piece.teamId}:${dur}:${isFlipping ? 1 : 0}:${isPopping ? 1 : 0}`;
        if (ref.lastSignature !== contentSig) {
          ref.lastSignature = contentSig;
          const pieceChildren = [];
          if (!isPreviewFlipped) {
            if (piece.teamId === 0) {
              pieceChildren.push(
                el(
                  "span",
                  { className: "piece-anchor", "aria-hidden": "true" },
                  "⚓",
                ),
              );
            } else {
              const code = SKILL_CONFIG[piece.skillType].code;
              if (code) {
                pieceChildren.push(
                  el(
                    "span",
                    {
                      className: "piece-skill-badge",
                      dataset: { skill: piece.skillType },
                    },
                    code,
                  ),
                );
              }
            }
            if (piece.skillType === "PURIFY" && piece.duration !== undefined) {
              pieceChildren.push(
                el(
                  "span",
                  {
                    className: "purify-duration-badge",
                    "aria-label": `救贖之光剩餘 ${piece.duration} 回合`,
                  },
                  String(piece.duration),
                ),
              );
            }
          }
          const pieceNode = el(
            "div",
            {
              className: "board-piece",
              dataset: {
                team: visual.displayTeamId,
                rim: visual.rimState,
                ownHidden: visual.isOwnHidden ? "true" : "false",
                glowSkill: visual.glowSkill || undefined,
                flipping: isFlipping ? "true" : "false",
                popping: isPopping ? "true" : "false",
              },
            },
            ...pieceChildren,
          );
          button.replaceChildren(pieceNode);
        }
      } else if (isPreviewPlacement) {
        contentSig = `G:${vm.activePlayerTeamId}`;
        if (ref.lastSignature !== contentSig) {
          ref.lastSignature = contentSig;
          button.replaceChildren(
            el(
              "div",
              {
                className: "ghost-piece",
                dataset: { team: vm.activePlayerTeamId },
                "aria-hidden": "true",
              },
              "+",
            ),
          );
        }
      } else if (!vm.isAnimating && (isStandardLegal || isPioneerLegal)) {
        const isPioneer = !isStandardLegal && isPioneerLegal;
        contentSig = `M:${vm.activePlayerTeamId}:${isPioneer ? 1 : 0}`;
        if (ref.lastSignature !== contentSig) {
          ref.lastSignature = contentSig;
          button.replaceChildren(
            el("span", {
              className: "legal-marker",
              dataset: {
                team: vm.activePlayerTeamId,
                pioneer: isPioneer ? "true" : "false",
              },
              "aria-hidden": "true",
            }),
          );
        }
      } else if (ref.lastSignature !== "E") {
        ref.lastSignature = "E";
        button.replaceChildren();
      }
    }
  }

  return { element: frameEl, update };
}

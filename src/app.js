import {
  collectAllRaycasts,
  createInitialGame,
  createMatchTracker,
  createReplaySession,
  dispatch,
  getAvailableMoves,
  sanitizeForViewer,
  selectBestMove,
} from "./engine/index.js";
import { playEvents } from "./fx/choreography.js";
import { isAudioMuted } from "./fx/sound.js";
import { createBattlefieldStatusBar } from "./ui/battlefieldStatusBar.js";
import { el, setData } from "./ui/dom.js";
import { createEventLogPanel } from "./ui/eventLogPanel.js";
import { createGameBoard } from "./ui/gameBoard.js";
import { createGameHeader } from "./ui/gameHeader.js";
import { formatErrorMessage } from "./ui/gameUiConstants.js";
import { createMapPresetBar } from "./ui/mapPresetBar.js";
import { createMatchTelemetryCard } from "./ui/matchTelemetryCard.js";
import {
  createExportModal,
  createGameOverModal,
  createImportModal,
} from "./ui/modals.js";
import { createPlayerCard } from "./ui/playerCard.js";
import { createReplayControls } from "./ui/replayControls.js";
import { createToastHost } from "./ui/toastHost.js";

const FORCED_SPECIAL_PRIORITY = ["COUNTER", "PURIFY", "BOMB", "WALL", "PIERCE"];

function createId() {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function getNextSelectedSkill(nextState, currentSkill, isHumanTurn = true) {
  if (!isHumanTurn) {
    return "NONE";
  }
  const incomingPlayer = nextState.players.find(
    (p) => p.id === nextState.activePlayerId,
  );
  if (!incomingPlayer) return "NONE";

  if (incomingPlayer.isForcedSpecial) {
    return (
      FORCED_SPECIAL_PRIORITY.find((sk) => incomingPlayer.hand[sk] > 0) ??
      "NONE"
    );
  }
  if (currentSkill !== "NONE" && incomingPlayer.hand[currentSkill] <= 0) {
    return "NONE";
  }
  return currentSkill;
}

export function mountApp(rootElement) {
  const controller = new AbortController();
  const { signal } = controller;

  const initialGame = createInitialGame({
    mapPreset: "CROSSROADS",
    boardSize: 16,
  });
  const matchTracker = createMatchTracker(initialGame.state);

  const state = {
    selectedPreset: "CROSSROADS",
    gameState: initialGame.state,
    selectedSkill: "NONE",
    isGodMode: true,
    gameMode: "PVE",
    isAiPlaying: true,
    aiSpeed: "NORMAL",
    aiDifficulty: "MEDIUM",
    showGameOverModal: false,
    isMuted: isAudioMuted(),
    eventLogs: initialGame.events,
    toast: null,
    toastSeq: 0,
    hoveredCoord: null,
    recordedTurns: 0,
    isReplayMode: false,
    replaySession: null,
    replayIndex: -1,
    isReplayAutoPlaying: false,
    replaySpeed: "1x",
    replayViewerId: null,
    isExportModalOpen: false,
    isImportModalOpen: false,
    isAnimating: false,
    intermediateBoard: null,
    flippingCoords: new Set(),
    poppingCoord: null,
    isScreenShaking: false,
    screenFlash: null,
    floatingTexts: [],
    blastWaves: [],
    auraPulses: [],
    shieldRipples: [],
    pierceStrikes: [],
    abyssVortices: [],
    pioneerBridges: [],
  };

  let destroyed = false;
  let toastTimer = null;
  let aiTimer = null;
  let replayTimer = null;
  const fxTimers = new Set();

  // Cached AI decision keyed by (gameState, isCurrentPlayerAi, aiDifficulty)
  let cachedAiDeps = {
    gameState: null,
    isCurrentPlayerAi: false,
    aiDifficulty: "",
  };
  let cachedAiAction = null;

  function scheduleFx(fn, ms) {
    const id = setTimeout(() => {
      fxTimers.delete(id);
      if (!destroyed) fn();
    }, ms);
    fxTimers.add(id);
    return id;
  }

  function showToast(message, type = "error") {
    state.toastSeq += 1;
    state.toast = { key: state.toastSeq, message, type };
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastTimer = null;
      if (destroyed) return;
      state.toast = null;
      render();
    }, 4000);
    render();
  }

  function dismissToast() {
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    state.toast = null;
    render();
  }

  function computeDerived() {
    const activePlayer = state.gameState.players.find(
      (p) => p.id === state.gameState.activePlayerId,
    );
    const isCurrentPlayerAi =
      state.gameMode === "AI_VS_AI" ||
      (state.gameMode === "PVE" && state.gameState.activePlayerId === 2);
    const isPlayer1Ai = state.gameMode === "AI_VS_AI";
    const isPlayer2Ai =
      state.gameMode === "PVE" || state.gameMode === "AI_VS_AI";
    const isHumanTurn =
      state.gameMode === "PVP" ||
      (state.gameMode === "PVE" && state.gameState.activePlayerId === 1);

    if (
      cachedAiDeps.gameState !== state.gameState ||
      cachedAiDeps.isCurrentPlayerAi !== isCurrentPlayerAi ||
      cachedAiDeps.aiDifficulty !== state.aiDifficulty
    ) {
      cachedAiDeps = {
        gameState: state.gameState,
        isCurrentPlayerAi,
        aiDifficulty: state.aiDifficulty,
      };
      if (state.gameState.isGameOver || !isCurrentPlayerAi) {
        cachedAiAction = null;
      } else {
        try {
          cachedAiAction = selectBestMove(
            state.gameState,
            state.gameState.activePlayerId,
            state.aiDifficulty,
          );
        } catch {
          cachedAiAction = null;
        }
      }
    }

    let effectiveSkill = state.selectedSkill;
    if (isCurrentPlayerAi) {
      effectiveSkill =
        cachedAiAction?.type === "PLACE_PIECE"
          ? (cachedAiAction.skillType ?? "NONE")
          : "NONE";
    } else if (activePlayer?.isForcedSpecial === true) {
      if (
        state.selectedSkill !== "NONE" &&
        activePlayer.hand[state.selectedSkill] > 0
      ) {
        effectiveSkill = state.selectedSkill;
      } else {
        effectiveSkill =
          FORCED_SPECIAL_PRIORITY.find((sk) => activePlayer.hand[sk] > 0) ??
          "NONE";
      }
    }

    const displayedState =
      state.gameMode === "PVE"
        ? sanitizeForViewer(state.gameState, 1)
        : state.isGodMode
          ? state.gameState
          : sanitizeForViewer(state.gameState, state.gameState.activePlayerId);

    const viewerTeamId =
      state.gameMode === "PVE" ? 1 : (activePlayer?.teamId ?? 1);

    const replayState =
      state.isReplayMode && state.replaySession
        ? state.replaySession.getCurrentMaskedState(state.replayViewerId)
        : null;

    const currentBoard = replayState
      ? replayState.board
      : state.intermediateBoard
        ? state.isGodMode && state.gameMode !== "PVE"
          ? state.intermediateBoard
          : state.intermediateBoard.map((row) =>
              row.map((piece) => {
                if (!piece) return null;
                if (piece.isRevealed || piece.teamId === viewerTeamId) {
                  return piece;
                }
                return { ...piece, skillType: "NONE" };
              }),
            )
        : displayedState.board;

    const effectiveDisplayedState = replayState ?? displayedState;
    const player1 = effectiveDisplayedState.players.find((p) => p.teamId === 1);
    const player2 = effectiveDisplayedState.players.find((p) => p.teamId === 2);

    const countSpecials = (p) =>
      (p?.hand.WALL ?? 0) +
      (p?.hand.PIERCE ?? 0) +
      (p?.hand.BOMB ?? 0) +
      (p?.hand.PURIFY ?? 0) +
      (p?.hand.COUNTER ?? 0);

    const availableMoves =
      state.isReplayMode ||
      (state.gameMode === "PVE" && state.gameState.activePlayerId === 2)
        ? { standardMoves: [], pioneerMoves: [], isPioneerActive: false }
        : getAvailableMoves(
            displayedState,
            state.gameState.activePlayerId,
            effectiveSkill,
          );

    const standardMoveSet = new Set(
      availableMoves.standardMoves.map((m) => `${m.x},${m.y}`),
    );
    const pioneerMoveSet = new Set(
      availableMoves.pioneerMoves.map((m) => `${m.x},${m.y}`),
    );

    const previewCapturedSet = new Set();
    if (
      !state.isReplayMode &&
      state.hoveredCoord &&
      !state.isAnimating &&
      !state.gameState.isGameOver &&
      !(state.gameMode === "PVE" && state.gameState.activePlayerId === 2) &&
      state.gameMode !== "AI_VS_AI"
    ) {
      const hoverKey = `${state.hoveredCoord.x},${state.hoveredCoord.y}`;
      if (standardMoveSet.has(hoverKey)) {
        const raycasts = collectAllRaycasts(
          currentBoard,
          state.gameState.size,
          state.hoveredCoord,
          activePlayer?.teamId ?? 1,
          effectiveSkill,
        );
        for (const r of raycasts) {
          for (const c of r.capturedCoords) {
            previewCapturedSet.add(`${c.x},${c.y}`);
          }
        }
      }
    }

    let neutralCount = 0;
    let team1Count = 0;
    let team2Count = 0;
    for (const row of currentBoard) {
      for (const p of row) {
        if (!p) continue;
        if (p.teamId === 0) neutralCount += 1;
        else if (p.teamId === 1) team1Count += 1;
        else if (p.teamId === 2) team2Count += 1;
      }
    }

    const effectiveDropZone =
      state.gameMode === "PVE"
        ? state.gameState.players.find((p) => p.teamId === 1)?.dropZone
        : activePlayer?.dropZone;

    return {
      activePlayer,
      isCurrentPlayerAi,
      isPlayer1Ai,
      isPlayer2Ai,
      isHumanTurn,
      aiAction: cachedAiAction,
      effectiveSkill,
      viewerTeamId,
      currentBoard,
      effectiveDisplayedState,
      player1,
      player2,
      player1SpecialsCount: countSpecials(player1),
      player2SpecialsCount: countSpecials(player2),
      availableMoves,
      standardMoveSet,
      pioneerMoveSet,
      previewCapturedSet,
      neutralCount,
      team1Count,
      team2Count,
      effectiveDropZone,
    };
  }

  async function executeEventChoreography(nextState, events, action) {
    matchTracker.recordStep(action, nextState, events);
    state.recordedTurns = matchTracker.getHistory().steps.length;

    const { isHumanTurn } = computeDerived();

    if (events.length === 0) {
      state.gameState = nextState;
      state.selectedSkill = getNextSelectedSkill(
        nextState,
        state.selectedSkill,
        isHumanTurn,
      );
      if (nextState.isGameOver) {
        state.showGameOverModal = true;
      }
      render();
      return;
    }

    state.isAnimating = true;
    state.intermediateBoard = state.gameState.board.map((row) =>
      row.map((cell) => (cell ? { ...cell } : null)),
    );
    render();

    const updateIntermediateBoard = (updater) => {
      const base = state.intermediateBoard ?? state.gameState.board;
      const next = updater(base);
      state.intermediateBoard = next;
      render();
      return next;
    };

    try {
      await playEvents(events, {
        onPiecePlaced: (pos, piece) => {
          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y ? { ...piece } : cell,
              ),
            ),
          );
          state.poppingCoord = pos;
          render();
          scheduleFx(() => {
            state.poppingCoord = null;
            render();
          }, 180);
        },
        onPioneerPlaced: (pos, piece) => {
          const next = updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y ? { ...piece } : cell,
              ),
            ),
          );
          state.poppingCoord = pos;
          render();
          scheduleFx(() => {
            state.poppingCoord = null;
            render();
          }, 180);

          let closest = null;
          let minDistance = Infinity;
          for (let y = 0; y < next.length; y++) {
            const row = next[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
              if (x === pos.x && y === pos.y) continue;
              const p = row[x];
              if (p?.teamId === piece.teamId) {
                const d = Math.max(Math.abs(x - pos.x), Math.abs(y - pos.y));
                if (d < minDistance) {
                  minDistance = d;
                  closest = { x, y };
                }
              }
            }
          }
          if (closest) {
            const bridgeId = createId();
            state.pioneerBridges = [
              ...state.pioneerBridges,
              { id: bridgeId, from: pos, to: closest },
            ];
            render();
            scheduleFx(() => {
              state.pioneerBridges = state.pioneerBridges.filter(
                (b) => b.id !== bridgeId,
              );
              render();
            }, 800);
          }
        },
        onPieceRevealed: (pos, skillType) => {
          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y && cell
                  ? { ...cell, skillType, isRevealed: true }
                  : cell,
              ),
            ),
          );
        },
        onPieceFlip: (pos, toTeamId) => {
          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y && cell
                  ? {
                      ...cell,
                      teamId: toTeamId,
                      skillType:
                        cell.skillType === "BOMB" ? cell.skillType : "NONE",
                      duration: undefined,
                      isRevealed: true,
                    }
                  : cell,
              ),
            ),
          );
          const key = `${pos.x},${pos.y}`;
          state.flippingCoords = new Set(state.flippingCoords).add(key);
          render();
          scheduleFx(() => {
            const nextSet = new Set(state.flippingCoords);
            nextSet.delete(key);
            state.flippingCoords = nextSet;
            render();
          }, 350);
        },
        onRaycastBlocked: (wallCoord) => {
          const rippleId = createId();
          state.shieldRipples = [
            ...state.shieldRipples,
            { id: rippleId, coord: wallCoord },
          ];
          render();
          scheduleFx(() => {
            state.shieldRipples = state.shieldRipples.filter(
              (r) => r.id !== rippleId,
            );
            render();
          }, 600);
        },
        onPierceTriggered: (pos) => {
          const strikeId = createId();
          state.pierceStrikes = [
            ...state.pierceStrikes,
            { id: strikeId, coord: pos },
          ];
          render();
          scheduleFx(() => {
            state.pierceStrikes = state.pierceStrikes.filter(
              (p) => p.id !== strikeId,
            );
            render();
          }, 600);
        },
        onCounterTriggered: (center, reversedCoords, defenderTeamId) => {
          const reversedSet = new Set(
            reversedCoords.map((c) => `${c.x},${c.y}`),
          );
          reversedSet.add(`${center.x},${center.y}`);

          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) => {
                if (reversedSet.has(`${rX},${rY}`) && cell) {
                  if (cell.skillType === "PIERCE") {
                    return { ...cell, isRevealed: true };
                  }
                  return {
                    ...cell,
                    teamId: defenderTeamId,
                    skillType:
                      cell.skillType === "BOMB" ? cell.skillType : "NONE",
                    duration: undefined,
                    isRevealed: true,
                  };
                }
                return cell;
              }),
            ),
          );

          const vortexId = createId();
          state.abyssVortices = [
            ...state.abyssVortices,
            { id: vortexId, center, reversedCoords },
          ];
          render();
          scheduleFx(() => {
            state.abyssVortices = state.abyssVortices.filter(
              (v) => v.id !== vortexId,
            );
            render();
          }, 750);
        },
        onBombTriggered: (center, blastCoords, teamId) => {
          const blastSet = new Set(blastCoords.map((c) => `${c.x},${c.y}`));
          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) => {
                if (blastSet.has(`${rX},${rY}`) && cell) {
                  if (cell.skillType === "PIERCE") {
                    return { ...cell, isRevealed: true };
                  }
                  return {
                    ...cell,
                    teamId,
                    skillType:
                      cell.skillType === "BOMB" ? cell.skillType : "NONE",
                    duration: undefined,
                    isRevealed: true,
                  };
                }
                return cell;
              }),
            ),
          );

          const blastId = createId();
          state.blastWaves = [...state.blastWaves, { id: blastId, center }];
          render();
          scheduleFx(() => {
            state.blastWaves = state.blastWaves.filter((b) => b.id !== blastId);
            render();
          }, 700);
        },
        onPurifyPulse: (center, affectedCoords, teamId) => {
          const affectedSet = new Set(
            affectedCoords.map((c) => `${c.x},${c.y}`),
          );
          updateIntermediateBoard((board) =>
            board.map((row, rY) =>
              row.map((cell, rX) => {
                if (affectedSet.has(`${rX},${rY}`) && cell) {
                  const nextSkill =
                    cell.skillType === "BOMB" || cell.skillType === "COUNTER"
                      ? "NONE"
                      : cell.skillType;
                  return {
                    ...cell,
                    teamId,
                    skillType: nextSkill,
                    isRevealed: true,
                  };
                }
                return cell;
              }),
            ),
          );

          const auraId = createId();
          state.auraPulses = [...state.auraPulses, { id: auraId, center }];
          render();
          scheduleFx(() => {
            state.auraPulses = state.auraPulses.filter((a) => a.id !== auraId);
            render();
          }, 750);
        },
        onAddFloatingText: (text, pos, variant) => {
          const textId = createId();
          state.floatingTexts = [
            ...state.floatingTexts,
            { id: textId, text, coord: pos, variant },
          ];
          render();
          scheduleFx(() => {
            state.floatingTexts = state.floatingTexts.filter(
              (t) => t.id !== textId,
            );
            render();
          }, 1250);
        },
        onTriggerScreenShake: (durationMs = 350) => {
          state.isScreenShaking = true;
          render();
          scheduleFx(() => {
            state.isScreenShaking = false;
            render();
          }, durationMs);
        },
        onTriggerScreenFlash: (color, durationMs = 350) => {
          state.screenFlash = color;
          render();
          scheduleFx(() => {
            state.screenFlash = null;
            render();
          }, durationMs);
        },
        onGameOver: () => {
          state.showGameOverModal = true;
          render();
        },
      });

      if (destroyed) return;
      state.gameState = nextState;
      state.eventLogs = [...events, ...state.eventLogs];
      const nextIsHuman =
        state.gameMode === "PVP" ||
        (state.gameMode === "PVE" && nextState.activePlayerId === 1);
      state.selectedSkill = getNextSelectedSkill(
        nextState,
        state.selectedSkill,
        nextIsHuman,
      );
      if (nextState.isGameOver) {
        state.showGameOverModal = true;
      }
    } finally {
      state.isAnimating = false;
      state.intermediateBoard = null;
      if (!destroyed) render();
    }
  }

  function runAiTurnNow() {
    const derived = computeDerived();
    if (
      state.gameState.isGameOver ||
      state.isAnimating ||
      !derived.isCurrentPlayerAi
    ) {
      return;
    }
    try {
      const action =
        derived.aiAction ??
        selectBestMove(
          state.gameState,
          state.gameState.activePlayerId,
          state.aiDifficulty,
        );
      const { nextState, events } = dispatch(state.gameState, action);
      void executeEventChoreography(nextState, events, action);
    } catch (err) {
      if (err instanceof Error) {
        showToast(formatErrorMessage(err.message), "error");
      }
      try {
        const passAction = {
          type: "PASS_TURN",
          playerId: state.gameState.activePlayerId,
        };
        const { nextState, events } = dispatch(state.gameState, passAction);
        void executeEventChoreography(nextState, events, passAction);
      } catch {
        // Failsafe: keep current state
      }
    }
  }

  function syncTimers(derived) {
    if (aiTimer !== null) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    if (
      !destroyed &&
      !state.gameState.isGameOver &&
      !state.isAnimating &&
      derived.isCurrentPlayerAi &&
      (state.gameMode !== "AI_VS_AI" || state.isAiPlaying)
    ) {
      const delayMs = state.aiSpeed === "FAST" ? 250 : 600;
      aiTimer = setTimeout(() => {
        aiTimer = null;
        if (!destroyed) runAiTurnNow();
      }, delayMs);
    }

    if (replayTimer !== null) {
      clearInterval(replayTimer);
      replayTimer = null;
    }
    if (
      !destroyed &&
      state.isReplayMode &&
      state.isReplayAutoPlaying &&
      state.replaySession
    ) {
      const intervalMs =
        state.replaySpeed === "0.5x"
          ? 1200
          : state.replaySpeed === "1x"
            ? 600
            : 300;
      replayTimer = setInterval(() => {
        if (destroyed || !state.replaySession) return;
        if (state.replaySession.canStepForward()) {
          state.replaySession.stepForward();
          state.replayIndex = state.replaySession.getCurrentIndex();
          render();
        } else {
          state.isReplayAutoPlaying = false;
          render();
        }
      }, intervalMs);
    }
  }

  function handleCellClick(coord) {
    if (state.isReplayMode || state.isAnimating) return;
    if (state.gameMode === "AI_VS_AI") {
      showToast(
        "雙 AI 演示模式進行中，棋盤由 AI 自主落子。若需手動下棋請切換至雙人或人機模式。",
        "info",
      );
      return;
    }
    if (state.gameMode === "PVE" && state.gameState.activePlayerId === 2)
      return;

    const { effectiveSkill } = computeDerived();
    try {
      const placeAction = {
        type: "PLACE_PIECE",
        playerId: state.gameState.activePlayerId,
        coord,
        skillType: effectiveSkill,
      };
      const { nextState, events } = dispatch(state.gameState, placeAction);
      void executeEventChoreography(nextState, events, placeAction);
    } catch (err) {
      if (err instanceof Error) {
        showToast(formatErrorMessage(err.message), "error");
      }
    }
  }

  function handlePassTurn() {
    const derived = computeDerived();
    if (
      state.isReplayMode ||
      state.isAnimating ||
      derived.isCurrentPlayerAi ||
      state.gameState.isGameOver
    ) {
      return;
    }
    if (
      derived.availableMoves.standardMoves.length > 0 ||
      derived.availableMoves.pioneerMoves.length > 0
    ) {
      showToast("目前盤面仍有合法落子點，無法跳過回合！", "warning");
      return;
    }
    try {
      const passAction = {
        type: "PASS_TURN",
        playerId: state.gameState.activePlayerId,
      };
      const { nextState, events } = dispatch(state.gameState, passAction);
      void executeEventChoreography(nextState, events, passAction);
    } catch (err) {
      if (err instanceof Error) {
        showToast(formatErrorMessage(err.message), "error");
      }
    }
  }

  function resetWithPreset(preset, notify) {
    if (state.isAnimating) return;
    state.selectedPreset = preset;
    const nextInit = createInitialGame({ mapPreset: preset, boardSize: 16 });
    state.gameState = nextInit.state;
    state.intermediateBoard = null;
    state.eventLogs = nextInit.events;
    state.selectedSkill = "NONE";
    state.showGameOverModal = false;
    matchTracker.reset(nextInit.state);
    state.recordedTurns = 0;
    state.isReplayMode = false;
    state.replaySession = null;
    state.isReplayAutoPlaying = false;
    if (notify) {
      showToast("對局已重設", "info");
    } else {
      render();
    }
  }

  function openReplay(targetIndex) {
    const history = matchTracker.getHistory();
    const session = createReplaySession(
      history,
      targetIndex ?? history.steps.length - 1,
    );
    state.replaySession = session;
    state.replayIndex = session.getCurrentIndex();
    state.isReplayAutoPlaying = false;
    state.isReplayMode = true;
    render();
  }

  function exitReplay() {
    state.isReplayAutoPlaying = false;
    state.isReplayMode = false;
    state.replaySession = null;
    render();
  }

  // Instantiate modular vanilla DOM views
  const toastHost = createToastHost({ onDismiss: dismissToast }, signal);
  const screenFlashEl = el("div", {
    className: "screen-flash",
    "aria-hidden": "true",
    dataset: { active: "false" },
  });

  const gameOverModal = createGameOverModal(
    {
      onClose: () => {
        state.showGameOverModal = false;
        render();
      },
      onReset: () => resetWithPreset(state.selectedPreset, true),
      onOpenReplay: () => openReplay(0),
      onOpenExport: () => {
        state.isExportModalOpen = true;
        render();
      },
    },
    signal,
  );

  const exportModal = createExportModal(
    {
      onClose: () => {
        state.isExportModalOpen = false;
        render();
      },
      onShowToast: showToast,
    },
    signal,
  );

  const importModal = createImportModal(
    {
      onClose: () => {
        state.isImportModalOpen = false;
        render();
      },
      onImportSuccess: (importedHistory) => {
        const session = createReplaySession(
          importedHistory,
          importedHistory.steps.length - 1,
        );
        state.replaySession = session;
        state.replayIndex = session.getCurrentIndex();
        state.isReplayAutoPlaying = false;
        state.isReplayMode = true;
        render();
      },
      onShowToast: showToast,
    },
    signal,
  );

  const gameHeader = createGameHeader(
    {
      setGameMode: (mode) => {
        state.gameMode = mode;
        render();
      },
      setSelectedSkill: (skill) => {
        state.selectedSkill = skill;
        render();
      },
      setIsGodMode: (god) => {
        state.isGodMode = god;
        render();
      },
      toggleGodMode: () => {
        if (state.gameMode !== "PVE") {
          state.isGodMode = !state.isGodMode;
          render();
        }
      },
      setIsAiPlaying: (playing) => {
        state.isAiPlaying = playing;
        render();
      },
      toggleAiPlaying: () => {
        state.isAiPlaying = !state.isAiPlaying;
        render();
      },
      onAiStep: runAiTurnNow,
      toggleAiSpeed: () => {
        state.aiSpeed = state.aiSpeed === "NORMAL" ? "FAST" : "NORMAL";
        render();
      },
      setIsMuted: (muted) => {
        state.isMuted = muted;
        showToast(muted ? "音效已靜音" : "音效已開啟", "info");
      },
      onReset: () => resetWithPreset(state.selectedPreset, true),
      onToggleReplay: () => {
        if (state.isReplayMode) exitReplay();
        else openReplay();
      },
      onOpenExport: () => {
        state.isExportModalOpen = true;
        render();
      },
      onOpenImport: () => {
        state.isImportModalOpen = true;
        render();
      },
    },
    signal,
  );

  const mapPresetBar = createMapPresetBar(
    {
      onSelectPreset: (preset) => resetWithPreset(preset, false),
    },
    signal,
  );

  const replayControls = createReplayControls(
    {
      onStepChange: (index) => {
        if (!state.replaySession) return;
        state.replaySession.jumpToStep(index);
        state.replayIndex = state.replaySession.getCurrentIndex();
        render();
      },
      onStepPrev: () => {
        if (!state.replaySession?.canStepBackward()) return;
        state.replaySession.jumpToStep(state.replayIndex - 1);
        state.replayIndex = state.replaySession.getCurrentIndex();
        render();
      },
      onStepNext: () => {
        if (!state.replaySession?.canStepForward()) return;
        state.replaySession.jumpToStep(state.replayIndex + 1);
        state.replayIndex = state.replaySession.getCurrentIndex();
        render();
      },
      onStepLast: () => {
        if (!state.replaySession) return;
        state.replaySession.jumpToStep(state.replaySession.getTotalSteps() - 1);
        state.replayIndex = state.replaySession.getCurrentIndex();
        render();
      },
      onTogglePlay: () => {
        state.isReplayAutoPlaying = !state.isReplayAutoPlaying;
        render();
      },
      onCycleSpeed: () => {
        state.replaySpeed =
          state.replaySpeed === "0.5x"
            ? "1x"
            : state.replaySpeed === "1x"
              ? "2x"
              : "0.5x";
        render();
      },
      onViewerChange: (viewerId) => {
        state.replayViewerId = viewerId;
        render();
      },
      onExitReplay: exitReplay,
      onOpenExport: () => {
        state.isExportModalOpen = true;
        render();
      },
    },
    signal,
  );

  const statusBar = createBattlefieldStatusBar(
    {
      onExitReplay: exitReplay,
      onShowGameOverModal: () => {
        state.showGameOverModal = true;
        render();
      },
      onReset: () => resetWithPreset(state.selectedPreset, true),
    },
    signal,
  );

  const player1Card = createPlayerCard(
    1,
    {
      onSelectSkill: (skill) => {
        state.selectedSkill = skill;
        render();
      },
    },
    signal,
  );

  const player2Card = createPlayerCard(
    2,
    {
      onSelectSkill: (skill) => {
        state.selectedSkill = skill;
        render();
      },
    },
    signal,
  );

  const gameBoard = createGameBoard(
    {
      setHoveredCoord: (coord) => {
        const same =
          state.hoveredCoord?.x === coord?.x &&
          state.hoveredCoord?.y === coord?.y;
        if (same) return;
        state.hoveredCoord = coord;
        render();
      },
      onCellClick: handleCellClick,
    },
    signal,
  );

  const telemetryCard = createMatchTelemetryCard(
    {
      onPassTurn: handlePassTurn,
      setAiDifficulty: (diff) => {
        state.aiDifficulty = diff;
        render();
      },
    },
    signal,
  );

  const eventLogPanel = createEventLogPanel();

  const shellEl = el(
    "div",
    { className: "app-shell" },
    el(
      "a",
      { href: "#main-heading", className: "skip-link visually-hidden" },
      "跳至主內容",
    ),
    toastHost.element,
    screenFlashEl,
    gameOverModal.element,
    exportModal.element,
    importModal.element,
    gameHeader.element,
    el(
      "main",
      null,
      mapPresetBar.element,
      replayControls.element,
      statusBar.element,
      el(
        "div",
        { className: "arena-grid app-container" },
        el(
          "aside",
          { className: "arena-sidebar", "aria-label": "第一隊資訊" },
          player1Card.element,
        ),
        el("div", { className: "arena-center" }, gameBoard.element),
        el(
          "aside",
          { className: "arena-sidebar", "aria-label": "第二隊與對局資訊" },
          player2Card.element,
          telemetryCard.element,
          eventLogPanel.element,
        ),
      ),
    ),
  );

  rootElement.replaceChildren(shellEl);

  function render() {
    if (destroyed) return;
    const derived = computeDerived();

    toastHost.update(state.toast);
    setData(screenFlashEl, "active", state.screenFlash ? "true" : "false");

    gameOverModal.update({
      isOpen: state.showGameOverModal && state.gameState.isGameOver,
      winnerTeamId: state.gameState.winnerTeamId,
      team1Count: derived.team1Count,
      team2Count: derived.team2Count,
      neutralCount: derived.neutralCount,
      currentTurn: state.gameState.currentTurn,
      mapPreset: state.gameState.mapPreset,
      gameMode: state.gameMode,
    });

    exportModal.update({
      isOpen: state.isExportModalOpen,
      history: matchTracker.getHistory(),
    });

    importModal.update({
      isOpen: state.isImportModalOpen,
    });

    gameHeader.update({
      gameMode: state.gameMode,
      isAnimating: state.isAnimating,
      isGodMode: state.isGodMode,
      isAiPlaying: state.isAiPlaying,
      isGameOver: state.gameState.isGameOver,
      aiSpeed: state.aiSpeed,
      isMuted: state.isMuted,
      isReplayMode: state.isReplayMode,
      recordedTurns: state.recordedTurns,
    });

    mapPresetBar.update({
      selectedPreset: state.selectedPreset,
      isAnimating: state.isAnimating,
      neutralCount: derived.neutralCount,
    });

    replayControls.update({
      isReplayMode: state.isReplayMode,
      session: state.replaySession,
      replayIndex: state.replayIndex,
      isPlaying: state.isReplayAutoPlaying,
      speed: state.replaySpeed,
      viewerId: state.replayViewerId,
    });

    statusBar.update({
      isReplayMode: state.isReplayMode,
      replayIndex: state.replayIndex,
      replayStepNotation: state.replaySession?.getCurrentStep()?.notation,
      isGameOver: state.gameState.isGameOver,
      winnerTeamId: state.gameState.winnerTeamId,
      team1Count: derived.team1Count,
      team2Count: derived.team2Count,
      isAnimating: state.isAnimating,
      gameMode: state.gameMode,
      isAiPlaying: state.isAiPlaying,
      activePlayerName: derived.activePlayer
        ? derived.activePlayer.teamId === 1
          ? "第一隊"
          : "第二隊"
        : undefined,
      activePlayerTeamId: derived.activePlayer?.teamId ?? 1,
      isCurrentPlayerAi: derived.isCurrentPlayerAi,
      isPioneerActive: derived.availableMoves.isPioneerActive,
      pioneerMovesCount: derived.availableMoves.pioneerMoves.length,
      isDropPhase: state.gameState.isDropPhase,
      dropTurnsRemaining: state.gameState.dropTurnsRemaining,
      dropZone: derived.effectiveDropZone,
      mapPreset: state.gameState.mapPreset,
    });

    player1Card.update({
      player: derived.player1,
      isActive:
        derived.effectiveDisplayedState.activePlayerId ===
        (derived.player1?.id ?? 1),
      isAi: derived.isPlayer1Ai,
      isGodMode: state.isGodMode,
      specialsCount: derived.player1SpecialsCount,
      boardPieceCount: derived.team1Count,
      isAnimating: state.isAnimating,
      effectiveSkill: derived.effectiveSkill,
      gameMode: state.gameMode,
    });

    player2Card.update({
      player: derived.player2,
      isActive:
        derived.effectiveDisplayedState.activePlayerId ===
        (derived.player2?.id ?? 2),
      isAi: derived.isPlayer2Ai,
      isGodMode: state.isGodMode,
      specialsCount: derived.player2SpecialsCount,
      boardPieceCount: derived.team2Count,
      isAnimating: state.isAnimating,
      effectiveSkill: derived.effectiveSkill,
      gameMode: state.gameMode,
    });

    gameBoard.update({
      gameState: state.gameState,
      currentBoard: derived.currentBoard,
      activePlayerTeamId: derived.activePlayer?.teamId ?? 1,
      viewerTeamId: derived.viewerTeamId,
      isAnimating: state.isAnimating,
      isScreenShaking: state.isScreenShaking,
      isCurrentPlayerAi: derived.isCurrentPlayerAi,
      gameMode: state.gameMode,
      standardMoveSet: derived.standardMoveSet,
      pioneerMoveSet: derived.pioneerMoveSet,
      previewCapturedSet: derived.previewCapturedSet,
      flippingCoords: state.flippingCoords,
      poppingCoord: state.poppingCoord,
      hoveredCoord: state.hoveredCoord,
      effectiveDropZone: derived.effectiveDropZone,
      blastWaves: state.blastWaves,
      auraPulses: state.auraPulses,
      shieldRipples: state.shieldRipples,
      pierceStrikes: state.pierceStrikes,
      abyssVortices: state.abyssVortices,
      pioneerBridges: state.pioneerBridges,
      floatingTexts: state.floatingTexts,
    });

    telemetryCard.update({
      gameState: state.gameState,
      activePlayerName: derived.activePlayer
        ? derived.activePlayer.teamId === 1
          ? "第一隊（黑方）"
          : "第二隊（白方）"
        : undefined,
      activePlayerTeamId: derived.activePlayer?.teamId ?? 1,
      isAnimating: state.isAnimating,
      isCurrentPlayerAi: derived.isCurrentPlayerAi,
      gameMode: state.gameMode,
      aiDifficulty: state.aiDifficulty,
      dropZone: derived.effectiveDropZone,
      team1Count: derived.team1Count,
      team2Count: derived.team2Count,
      neutralCount: derived.neutralCount,
    });

    eventLogPanel.update(state.eventLogs);

    syncTimers(derived);
  }

  render();

  return {
    destroy() {
      destroyed = true;
      controller.abort();
      if (toastTimer !== null) clearTimeout(toastTimer);
      if (aiTimer !== null) clearTimeout(aiTimer);
      if (replayTimer !== null) clearInterval(replayTimer);
      for (const id of fxTimers) clearTimeout(id);
      fxTimers.clear();
      rootElement.replaceChildren();
    },
  };
}

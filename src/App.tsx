import { useCallback, useEffect, useState } from "react";
import {
  type AbyssVortexEffect,
  type AuraPulseEffect,
  type BlastWaveEffect,
  type PierceStrikeEffect,
  type PioneerBridgeEffect,
  type ShieldRippleEffect,
} from "./components/BoardOverlay.tsx";
import { type CombatTextItem } from "./components/FloatingCombatText.tsx";
import { GameBoard } from "./components/GameBoard.tsx";
import { GameHeader } from "./components/GameHeader.tsx";
import { GameOverModal } from "./components/GameOverModal.tsx";
import { MapPresetBar } from "./components/MapPresetBar.tsx";
import { MatchTelemetryCard } from "./components/MatchTelemetryCard.tsx";
import { PlayerCard } from "./components/PlayerCard.tsx";
import { ReplayControls } from "./components/ReplayControls.tsx";
import { ExportModal, ImportModal } from "./components/ReplayModals.tsx";
import { BattlefieldStatusBar } from "./components/BattlefieldStatusBar.tsx";
import { EventLogPanel } from "./components/EventLogPanel.tsx";
import { formatErrorMessage, type GameMode } from "./components/gameUiConstants.ts";
import {
  collectAllRaycasts,
  createInitialGame,
  createMatchTracker,
  createReplaySession,
  dispatch,
  getAvailableMoves,
  sanitizeForViewer,
  selectBestMove,
  type Action,
  type AIDifficulty,
  type Board,
  type Coord,
  type GameEvent,
  type GameState,
  type MapPreset,
  type MaskedPiece,
  type MatchHistory,
  type MatchTracker,
  type Piece,
  type Player,
  type ReplaySession,
  type SkillType,
} from "./engine/index.ts";
import { playEvents } from "./fx/choreography.ts";
import { isAudioMuted } from "./fx/sound.ts";
import { cn } from "./lib/cn.ts";

interface ToastNotification {
  key: number;
  message: string;
  type: "error" | "info" | "warning" | "success";
}

/**
 * Priority order when forced special is triggered:
 * Furthest down the list, longest cooldown, most powerful:
 * COUNTER (CD 7) -> PURIFY (CD 5) -> BOMB (CD 4) / WALL (CD 4) -> PIERCE (CD 3)
 */
const FORCED_SPECIAL_PRIORITY: Exclude<SkillType, "NONE">[] = [
  "COUNTER",
  "PURIFY",
  "BOMB",
  "WALL",
  "PIERCE",
];

function getNextSelectedSkill(
  nextState: GameState,
  currentSkill: SkillType,
  isHumanTurn = true,
): SkillType {
  // When next turn is played by AI, reset skill state to NONE
  if (!isHumanTurn) {
    return "NONE";
  }
  const incomingPlayer = nextState.players.find((p) => p.id === nextState.activePlayerId);
  if (!incomingPlayer) return "NONE";

  if (incomingPlayer.isForcedSpecial) {
    // Automatically pre-select the skill further down the list / highest CD / most powerful
    const preferred = FORCED_SPECIAL_PRIORITY.find((sk) => incomingPlayer.hand[sk] > 0);
    return preferred ?? "NONE";
  }
  if (currentSkill !== "NONE" && incomingPlayer.hand[currentSkill] <= 0) {
    return "NONE";
  }
  return currentSkill;
}

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<MapPreset>("CROSSROADS");
  const [gameState, setGameState] = useState<GameState>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).state,
  );
  const [selectedSkill, setSelectedSkill] = useState<SkillType>("NONE");
  const [isGodMode, setIsGodMode] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>("PVE");
  const [isAiPlaying, setIsAiPlaying] = useState<boolean>(true);
  const [aiSpeed, setAiSpeed] = useState<"NORMAL" | "FAST">("NORMAL");
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("MEDIUM");

  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => isAudioMuted());
  const [eventLogs, setEventLogs] = useState<GameEvent[]>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).events,
  );
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<Coord | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [toast]);

  const handleShowToast = useCallback(
    (message: string, type: "error" | "info" | "warning" | "success" = "error") => {
      setToast((prev) => ({
        key: (prev?.key ?? 0) + 1,
        message,
        type,
      }));
    },
    [],
  );

  // Match history tracking and visual replay states
  const [matchTracker] = useState<MatchTracker>(() =>
    createMatchTracker(createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).state),
  );
  const [recordedTurns, setRecordedTurns] = useState<number>(0);
  const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
  const [replaySession, setReplaySession] = useState<ReplaySession | null>(null);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [isReplayAutoPlaying, setIsReplayAutoPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<"0.5x" | "1x" | "2x">("1x");
  const [replayViewerId, setReplayViewerId] = useState<number | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Animation and Visual FX states
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [intermediateBoard, setIntermediateBoard] = useState<Board | null>(null);
  const [flippingCoords, setFlippingCoords] = useState<Set<string>>(() => new Set());
  const [poppingCoord, setPoppingCoord] = useState<Coord | null>(null);
  const [isScreenShaking, setIsScreenShaking] = useState<boolean>(false);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<CombatTextItem[]>([]);
  const [blastWaves, setBlastWaves] = useState<BlastWaveEffect[]>([]);
  const [auraPulses, setAuraPulses] = useState<AuraPulseEffect[]>([]);
  const [shieldRipples, setShieldRipples] = useState<ShieldRippleEffect[]>([]);
  const [pierceStrikes, setPierceStrikes] = useState<PierceStrikeEffect[]>([]);
  const [abyssVortices, setAbyssVortices] = useState<AbyssVortexEffect[]>([]);
  const [pioneerBridges, setPioneerBridges] = useState<PioneerBridgeEffect[]>([]);

  const activePlayer: Player | undefined = gameState.players.find(
    (p) => p.id === gameState.activePlayerId,
  );

  const isCurrentPlayerAi =
    gameMode === "AI_VS_AI" || (gameMode === "PVE" && gameState.activePlayerId === 2);

  const isPlayer1Ai = gameMode === "AI_VS_AI";
  const isPlayer2Ai = gameMode === "PVE" || gameMode === "AI_VS_AI";

  const isHumanTurn = gameMode === "PVP" || (gameMode === "PVE" && gameState.activePlayerId === 1);

  // Pre-calculate AI move decision for current state so UI highlights and board previews match the AI's actual choice
  const aiAction: Action | null = (() => {
    if (gameState.isGameOver || !isCurrentPlayerAi) return null;
    try {
      return selectBestMove(gameState, gameState.activePlayerId, aiDifficulty);
    } catch {
      return null;
    }
  })();

  // Resolve effective skill:
  // - For AI players: strictly synchronized with the AI's actual move decision
  // - For human players in forced special: auto-select highest CD / available special if current is NONE or out of stock
  // - Otherwise: human's selected skill
  const effectiveSkill: SkillType = (() => {
    if (isCurrentPlayerAi) {
      if (aiAction?.type === "PLACE_PIECE") {
        return aiAction.skillType ?? "NONE";
      }
      return "NONE";
    }
    if (activePlayer?.isForcedSpecial) {
      if (selectedSkill !== "NONE" && activePlayer.hand[selectedSkill] > 0) {
        return selectedSkill;
      }
      const preferred = FORCED_SPECIAL_PRIORITY.find((sk) => activePlayer.hand[sk] > 0);
      return preferred ?? "NONE";
    }
    return selectedSkill;
  })();

  // In PVE mode, human is Player 1 (team 1). The perspective must remain Player 1's perspective
  // so the player cannot inspect the bot's unrevealed piece skills or private hand.
  const displayedState =
    gameMode === "PVE"
      ? sanitizeForViewer(gameState, 1)
      : isGodMode
        ? gameState
        : sanitizeForViewer(gameState, gameState.activePlayerId);

  const viewerTeamId = gameMode === "PVE" ? 1 : (activePlayer?.teamId ?? 1);

  const replayState =
    isReplayMode && replaySession ? replaySession.getCurrentMaskedState(replayViewerId) : null;

  const currentBoard: (Piece | MaskedPiece | null)[][] = replayState
    ? replayState.board
    : intermediateBoard
      ? isGodMode && gameMode !== "PVE"
        ? intermediateBoard
        : intermediateBoard.map((row) =>
            row.map((piece) => {
              if (!piece) return null;
              if (piece.isRevealed) return piece;
              if (piece.teamId === viewerTeamId) return piece;
              return { ...piece, skillType: "NONE" };
            }),
          )
      : displayedState.board;

  const effectiveDisplayedState = replayState ?? displayedState;

  const player1 = effectiveDisplayedState.players.find((p) => p.teamId === 1);
  const player2 = effectiveDisplayedState.players.find((p) => p.teamId === 2);

  const player1SpecialsCount =
    (player1?.hand.WALL ?? 0) +
    (player1?.hand.PIERCE ?? 0) +
    (player1?.hand.BOMB ?? 0) +
    (player1?.hand.PURIFY ?? 0) +
    (player1?.hand.COUNTER ?? 0);

  const player2SpecialsCount =
    (player2?.hand.WALL ?? 0) +
    (player2?.hand.PIERCE ?? 0) +
    (player2?.hand.BOMB ?? 0) +
    (player2?.hand.PURIFY ?? 0) +
    (player2?.hand.COUNTER ?? 0);

  // In PVE mode during bot's turn or in replay mode, do not show legal move indicators
  const availableMoves =
    isReplayMode || (gameMode === "PVE" && gameState.activePlayerId === 2)
      ? { standardMoves: [], pioneerMoves: [], isPioneerActive: false }
      : getAvailableMoves(displayedState, gameState.activePlayerId, effectiveSkill);

  const standardMoveSet = new Set(
    availableMoves.standardMoves.map((m) => `${m.x.toString()},${m.y.toString()}`),
  );
  const pioneerMoveSet = new Set(
    availableMoves.pioneerMoves.map((m) => `${m.x.toString()},${m.y.toString()}`),
  );

  // Hover preview: preview board state after capturing pieces (based on viewer perspective)
  const previewCapturedSet = (() => {
    if (
      isReplayMode ||
      !hoveredCoord ||
      isAnimating ||
      gameState.isGameOver ||
      (gameMode === "PVE" && gameState.activePlayerId === 2) ||
      gameMode === "AI_VS_AI"
    ) {
      return new Set<string>();
    }

    const key = `${hoveredCoord.x.toString()},${hoveredCoord.y.toString()}`;
    if (!standardMoveSet.has(key)) {
      return new Set<string>();
    }

    const raycasts = collectAllRaycasts(
      currentBoard,
      gameState.size,
      hoveredCoord,
      activePlayer?.teamId ?? 1,
      effectiveSkill,
    );

    const set = new Set<string>();
    for (const r of raycasts) {
      for (const c of r.capturedCoords) {
        set.add(`${c.x.toString()},${c.y.toString()}`);
      }
    }
    return set;
  })();

  const executeEventChoreography = useCallback(
    async (nextState: GameState, events: GameEvent[], action: Action) => {
      // Record step into live match history
      matchTracker.recordStep(action, nextState, events);
      setRecordedTurns(matchTracker.getHistory().steps.length);

      if (events.length === 0) {
        setGameState(nextState);
        setSelectedSkill((prev) => getNextSelectedSkill(nextState, prev, isHumanTurn));
        if (nextState.isGameOver) {
          setShowGameOverModal(true);
        }
        return;
      }

      setIsAnimating(true);
      let currentIntermediateBoard: Board = gameState.board.map((row) =>
        row.map((cell) => (cell ? { ...cell } : null)),
      );
      setIntermediateBoard(currentIntermediateBoard);

      try {
        await playEvents(events, {
          onPiecePlaced: (pos, piece) => {
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) => (rX === pos.x && rY === pos.y ? { ...piece } : cell)),
            );
            setIntermediateBoard(currentIntermediateBoard);
            setPoppingCoord(pos);
            setTimeout(() => {
              setPoppingCoord(null);
            }, 180);
          },
          onPioneerPlaced: (pos, piece) => {
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) => (rX === pos.x && rY === pos.y ? { ...piece } : cell)),
            );
            setIntermediateBoard(currentIntermediateBoard);
            setPoppingCoord(pos);
            setTimeout(() => {
              setPoppingCoord(null);
            }, 180);

            let closest: Coord | null = null;
            let minDistance = Infinity;
            for (let y = 0; y < currentIntermediateBoard.length; y++) {
              const row = currentIntermediateBoard[y];
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
              const bridgeId = `${Date.now().toString()}-${Math.random().toString()}`;
              setPioneerBridges((prev) => [...prev, { id: bridgeId, from: pos, to: closest }]);
              setTimeout(() => {
                setPioneerBridges((prev) => prev.filter((b) => b.id !== bridgeId));
              }, 800);
            }
          },
          onPieceRevealed: (pos, skillType) => {
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y && cell
                  ? { ...cell, skillType, isRevealed: true }
                  : cell,
              ),
            );
            setIntermediateBoard(currentIntermediateBoard);
          },
          onPieceFlip: (pos, toTeamId) => {
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) =>
                rX === pos.x && rY === pos.y && cell
                  ? {
                      ...cell,
                      teamId: toTeamId,
                      skillType: cell.skillType === "BOMB" ? cell.skillType : "NONE",
                      duration: undefined,
                      isRevealed: true,
                    }
                  : cell,
              ),
            );
            setIntermediateBoard(currentIntermediateBoard);
            const key = `${pos.x.toString()},${pos.y.toString()}`;
            setFlippingCoords((prev) => new Set(prev).add(key));
            setTimeout(() => {
              setFlippingCoords((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            }, 350);
          },
          onRaycastBlocked: (wallCoord) => {
            const rippleId = `${Date.now().toString()}-${Math.random().toString()}`;
            setShieldRipples((prev) => [...prev, { id: rippleId, coord: wallCoord }]);
            setTimeout(() => {
              setShieldRipples((prev) => prev.filter((r) => r.id !== rippleId));
            }, 600);
          },
          onPierceTriggered: (pos) => {
            const strikeId = `${Date.now().toString()}-${Math.random().toString()}`;
            setPierceStrikes((prev) => [...prev, { id: strikeId, coord: pos }]);
            setTimeout(() => {
              setPierceStrikes((prev) => prev.filter((p) => p.id !== strikeId));
            }, 600);
          },
          onCounterTriggered: (center, reversedCoords, defenderTeamId) => {
            const reversedSet = new Set(
              reversedCoords.map((c) => `${c.x.toString()},${c.y.toString()}`),
            );
            reversedSet.add(`${center.x.toString()},${center.y.toString()}`);

            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) => {
                if (reversedSet.has(`${rX.toString()},${rY.toString()}`) && cell) {
                  if (cell.skillType === "PIERCE") {
                    return { ...cell, isRevealed: true };
                  }
                  return {
                    ...cell,
                    teamId: defenderTeamId,
                    skillType: cell.skillType === "BOMB" ? cell.skillType : "NONE",
                    duration: undefined,
                    isRevealed: true,
                  };
                }
                return cell;
              }),
            );
            setIntermediateBoard(currentIntermediateBoard);

            const vortexId = `${Date.now().toString()}-${Math.random().toString()}`;
            setAbyssVortices((prev) => [...prev, { id: vortexId, center, reversedCoords }]);
            setTimeout(() => {
              setAbyssVortices((prev) => prev.filter((v) => v.id !== vortexId));
            }, 750);
          },
          onBombTriggered: (center, blastCoords, teamId) => {
            const blastSet = new Set(blastCoords.map((c) => `${c.x.toString()},${c.y.toString()}`));
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) => {
                if (blastSet.has(`${rX.toString()},${rY.toString()}`) && cell) {
                  if (cell.skillType === "PIERCE") {
                    return { ...cell, isRevealed: true };
                  }
                  return {
                    ...cell,
                    teamId,
                    skillType: cell.skillType === "BOMB" ? cell.skillType : "NONE",
                    duration: undefined,
                    isRevealed: true,
                  };
                }
                return cell;
              }),
            );
            setIntermediateBoard(currentIntermediateBoard);

            const blastId = `${Date.now().toString()}-${Math.random().toString()}`;
            setBlastWaves((prev) => [...prev, { id: blastId, center }]);
            setTimeout(() => {
              setBlastWaves((prev) => prev.filter((b) => b.id !== blastId));
            }, 700);
          },
          onPurifyPulse: (center, affectedCoords, teamId) => {
            const affectedSet = new Set(
              affectedCoords.map((c) => `${c.x.toString()},${c.y.toString()}`),
            );
            currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
              row.map((cell, rX) => {
                if (affectedSet.has(`${rX.toString()},${rY.toString()}`) && cell) {
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
            );
            setIntermediateBoard(currentIntermediateBoard);

            const auraId = `${Date.now().toString()}-${Math.random().toString()}`;
            setAuraPulses((prev) => [...prev, { id: auraId, center }]);
            setTimeout(() => {
              setAuraPulses((prev) => prev.filter((a) => a.id !== auraId));
            }, 750);
          },
          onAddFloatingText: (text, pos, variant) => {
            const textId = `${Date.now().toString()}-${Math.random().toString()}`;
            setFloatingTexts((prev) => [...prev, { id: textId, text, coord: pos, variant }]);
            setTimeout(() => {
              setFloatingTexts((prev) => prev.filter((t) => t.id !== textId));
            }, 1250);
          },
          onTriggerScreenShake: (durationMs = 350) => {
            setIsScreenShaking(true);
            setTimeout(() => {
              setIsScreenShaking(false);
            }, durationMs);
          },
          onTriggerScreenFlash: (color, durationMs = 350) => {
            setScreenFlash(color);
            setTimeout(() => {
              setScreenFlash(null);
            }, durationMs);
          },
          onGameOver: () => {
            setShowGameOverModal(true);
          },
        });

        setGameState(nextState);
        setEventLogs((prev) => [...events, ...prev]);
        setSelectedSkill((prev) => getNextSelectedSkill(nextState, prev, isHumanTurn));
        if (nextState.isGameOver) {
          setShowGameOverModal(true);
        }
      } finally {
        setIsAnimating(false);
        setIntermediateBoard(null);
      }
    },
    [gameState.board, isHumanTurn, matchTracker],
  );

  // Automated AI turn execution for PVE (Bot turn) or AI_VS_AI (Both turns)
  useEffect(() => {
    if (
      !gameState.isGameOver &&
      !isAnimating &&
      isCurrentPlayerAi &&
      (gameMode !== "AI_VS_AI" || isAiPlaying)
    ) {
      const delayMs = aiSpeed === "FAST" ? 250 : 600;
      const timer = setTimeout(() => {
        try {
          const action =
            aiAction ?? selectBestMove(gameState, gameState.activePlayerId, aiDifficulty);
          const { nextState, events } = dispatch(gameState, action);
          void executeEventChoreography(nextState, events, action);
        } catch (err) {
          if (err instanceof Error) {
            handleShowToast(formatErrorMessage(err.message), "error");
          }
          // Failsafe: pass turn if AI action encounters an error to prevent game stall
          try {
            const passAction: Action = {
              type: "PASS_TURN",
              playerId: gameState.activePlayerId,
            };
            const { nextState, events } = dispatch(gameState, passAction);
            void executeEventChoreography(nextState, events, passAction);
          } catch {
            // If pass also fails, state remains
          }
        }
      }, delayMs);

      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [
    gameMode,
    isCurrentPlayerAi,
    isAiPlaying,
    aiSpeed,
    aiDifficulty,
    gameState,
    isAnimating,
    aiAction,
    executeEventChoreography,
    handleShowToast,
  ]);

  const handleAiStep = () => {
    if (gameState.isGameOver || isAnimating || !isCurrentPlayerAi) return;
    try {
      const action = aiAction ?? selectBestMove(gameState, gameState.activePlayerId, aiDifficulty);
      const { nextState, events } = dispatch(gameState, action);
      void executeEventChoreography(nextState, events, action);
    } catch (err) {
      if (err instanceof Error) {
        handleShowToast(formatErrorMessage(err.message), "error");
      }
      try {
        const passAction: Action = {
          type: "PASS_TURN",
          playerId: gameState.activePlayerId,
        };
        const { nextState, events } = dispatch(gameState, passAction);
        void executeEventChoreography(nextState, events, passAction);
      } catch {
        // Failsafe
      }
    }
  };

  const handleCellClick = (coord: Coord) => {
    if (isReplayMode) return;
    if (isAnimating) return;
    if (gameMode === "AI_VS_AI") {
      handleShowToast(
        "雙 AI 演示模式進行中，棋盤由 AI 自主落子。若需手動下棋請切換至雙人或人機模式。",
        "info",
      );
      return;
    }
    if (gameMode === "PVE" && gameState.activePlayerId === 2) return;

    try {
      const placeAction: Action = {
        type: "PLACE_PIECE",
        playerId: gameState.activePlayerId,
        coord,
        skillType: effectiveSkill,
      };
      const { nextState, events } = dispatch(gameState, placeAction);
      void executeEventChoreography(nextState, events, placeAction);
    } catch (err) {
      if (err instanceof Error) {
        handleShowToast(formatErrorMessage(err.message), "error");
      }
    }
  };

  const handlePassTurn = () => {
    if (isReplayMode || isAnimating || isCurrentPlayerAi || gameState.isGameOver) {
      return;
    }
    if (availableMoves.standardMoves.length > 0 || availableMoves.pioneerMoves.length > 0) {
      handleShowToast("目前盤面仍有合法落子點，無法跳過回合！", "warning");
      return;
    }
    try {
      const passAction: Action = {
        type: "PASS_TURN",
        playerId: gameState.activePlayerId,
      };
      const { nextState, events } = dispatch(gameState, passAction);
      void executeEventChoreography(nextState, events, passAction);
    } catch (err) {
      if (err instanceof Error) {
        handleShowToast(formatErrorMessage(err.message), "error");
      }
    }
  };

  const handleSelectPreset = (preset: MapPreset) => {
    if (isAnimating) return;
    setSelectedPreset(preset);
    const initial = createInitialGame({ mapPreset: preset, boardSize: 16 });
    setGameState(initial.state);
    setIntermediateBoard(null);
    setEventLogs(initial.events);
    setSelectedSkill("NONE");
    setShowGameOverModal(false);
    matchTracker.reset(initial.state);
    setRecordedTurns(0);
    setIsReplayMode(false);
    setReplaySession(null);
    setIsReplayAutoPlaying(false);
  };

  const handleReset = () => {
    if (isAnimating) return;
    const initial = createInitialGame({
      mapPreset: selectedPreset,
      boardSize: 16,
    });
    setGameState(initial.state);
    setIntermediateBoard(null);
    setEventLogs(initial.events);
    setSelectedSkill("NONE");
    setShowGameOverModal(false);
    matchTracker.reset(initial.state);
    setRecordedTurns(0);
    setIsReplayMode(false);
    setReplaySession(null);
    setIsReplayAutoPlaying(false);
    handleShowToast("對局已重設", "info");
  };

  const handleOpenReplay = (targetIndex?: number) => {
    const history = matchTracker.getHistory();
    const session = createReplaySession(history, targetIndex ?? history.steps.length - 1);
    setReplaySession(session);
    setReplayIndex(session.getCurrentIndex());
    setIsReplayAutoPlaying(false);
    setIsReplayMode(true);
  };

  const handleExitReplay = () => {
    setIsReplayAutoPlaying(false);
    setIsReplayMode(false);
    setReplaySession(null);
  };

  const handleImportSuccess = (importedHistory: MatchHistory) => {
    const session = createReplaySession(importedHistory, importedHistory.steps.length - 1);
    setReplaySession(session);
    setReplayIndex(session.getCurrentIndex());
    setIsReplayAutoPlaying(false);
    setIsReplayMode(true);
  };

  const handleReplayStepChange = (index: number) => {
    if (!replaySession) return;
    replaySession.jumpToStep(index);
    setReplayIndex(replaySession.getCurrentIndex());
  };

  useEffect(() => {
    if (isReplayMode && isReplayAutoPlaying && replaySession) {
      const intervalMs = replaySpeed === "0.5x" ? 1200 : replaySpeed === "1x" ? 600 : 300;
      const timer = setInterval(() => {
        if (replaySession.canStepForward()) {
          replaySession.stepForward();
          setReplayIndex(replaySession.getCurrentIndex());
        } else {
          setIsReplayAutoPlaying(false);
        }
      }, intervalMs);

      return () => {
        clearInterval(timer);
      };
    }
    return undefined;
  }, [isReplayMode, isReplayAutoPlaying, replaySession, replaySpeed]);

  // Team piece count
  const neutralCount = currentBoard.flat().filter((p) => p?.teamId === 0).length;
  const team1Count = currentBoard.flat().filter((p) => p?.teamId === 1).length;
  const team2Count = currentBoard.flat().filter((p) => p?.teamId === 2).length;

  const effectiveDropZone =
    gameMode === "PVE"
      ? gameState.players.find((p) => p.teamId === 1)?.dropZone
      : activePlayer?.dropZone;

  return (
    <div className="min-h-screen bg-slate-900 p-4 font-sans text-slate-100 md:p-8">
      {/* Floating Toast Notification Container - Stable, does NOT displace the board layout */}
      {toast && (
        <div className="pointer-events-none fixed top-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
          <div
            key={toast.key}
            className={cn(
              "pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur-md transition-all",
              toast.type === "error" &&
                "border-rose-500/80 bg-rose-950/95 text-rose-100 shadow-rose-950/50",
              toast.type === "warning" &&
                "border-amber-500/80 bg-amber-950/95 text-amber-100 shadow-amber-950/50",
              toast.type === "success" &&
                "border-emerald-500/80 bg-emerald-950/95 text-emerald-100 shadow-emerald-950/50",
              toast.type === "info" &&
                "border-sky-500/80 bg-sky-950/95 text-sky-100 shadow-sky-950/50",
            )}
          >
            <span>
              {toast.type === "error"
                ? "⚠️"
                : toast.type === "warning"
                  ? "⚡"
                  : toast.type === "success"
                    ? "✅"
                    : "ℹ️"}
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => {
                setToast(null);
              }}
              className="ml-2 cursor-pointer text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Screen Flash Overlay for Abyss Counter */}
      {screenFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-50 bg-purple-950/70 backdrop-blur-xs transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Game Over Settlement Modal */}
      <GameOverModal
        isOpen={showGameOverModal && gameState.isGameOver}
        winnerTeamId={gameState.winnerTeamId}
        team1Count={team1Count}
        team2Count={team2Count}
        neutralCount={neutralCount}
        currentTurn={gameState.currentTurn}
        mapPreset={gameState.mapPreset}
        gameMode={gameMode}
        onClose={() => setShowGameOverModal(false)}
        onReset={handleReset}
        onOpenReplay={() => handleOpenReplay(0)}
        onOpenExport={() => setIsExportModalOpen(true)}
      />

      {/* Game Header */}
      <GameHeader
        gameMode={gameMode}
        setGameMode={(mode) => {
          setGameMode(mode);
          setSelectedSkill("NONE");
        }}
        setSelectedSkill={setSelectedSkill}
        isAnimating={isAnimating}
        isGodMode={isGodMode}
        setIsGodMode={setIsGodMode}
        isAiPlaying={isAiPlaying}
        setIsAiPlaying={setIsAiPlaying}
        isGameOver={gameState.isGameOver}
        onAiStep={handleAiStep}
        aiSpeed={aiSpeed}
        setAiSpeed={setAiSpeed}
        isMuted={isMuted}
        setIsMuted={(muted) => {
          setIsMuted(muted);
          handleShowToast(muted ? "音效已靜音" : "音效已開啟", "info");
        }}
        onReset={handleReset}
        isReplayMode={isReplayMode}
        recordedTurns={recordedTurns}
        onOpenReplay={() => handleOpenReplay()}
        onExitReplay={handleExitReplay}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenImport={() => setIsImportModalOpen(true)}
      />

      {/* Map Preset Bar */}
      <MapPresetBar
        selectedPreset={selectedPreset}
        isAnimating={isAnimating}
        onSelectPreset={handleSelectPreset}
        neutralCount={neutralCount}
      />

      {/* Replay Controls & Battlefield Status Bar */}
      {isReplayMode && replaySession && (
        <ReplayControls
          session={replaySession}
          replayIndex={replayIndex}
          isPlaying={isReplayAutoPlaying}
          speed={replaySpeed}
          viewerId={replayViewerId}
          onStepChange={handleReplayStepChange}
          onTogglePlay={() => {
            setIsReplayAutoPlaying((prev) => !prev);
          }}
          onSpeedChange={setReplaySpeed}
          onViewerChange={setReplayViewerId}
          onExitReplay={handleExitReplay}
          onOpenExport={() => {
            setIsExportModalOpen(true);
          }}
        />
      )}

      <BattlefieldStatusBar
        isReplayMode={isReplayMode}
        replayIndex={replayIndex}
        replayStepNotation={replaySession?.getCurrentStep()?.notation}
        isGameOver={gameState.isGameOver}
        winnerTeamId={gameState.winnerTeamId}
        team1Count={team1Count}
        team2Count={team2Count}
        isAnimating={isAnimating}
        gameMode={gameMode}
        isAiPlaying={isAiPlaying}
        activePlayerName={
          activePlayer ? (activePlayer.teamId === 1 ? "第一隊" : "第二隊") : undefined
        }
        activePlayerTeamId={activePlayer?.teamId ?? 1}
        isCurrentPlayerAi={isCurrentPlayerAi}
        isPioneerActive={availableMoves.isPioneerActive}
        pioneerMovesCount={availableMoves.pioneerMoves.length}
        isDropPhase={gameState.isDropPhase}
        dropTurnsRemaining={gameState.dropTurnsRemaining}
        dropZone={effectiveDropZone}
        mapPreset={gameState.mapPreset}
        onExitReplay={handleExitReplay}
        onShowGameOverModal={() => setShowGameOverModal(true)}
        onReset={handleReset}
      />

      {/* Main Game Arena */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Left Column: Player 1 Card (Black) */}
        <div className="space-y-4">
          <PlayerCard
            teamId={1}
            player={player1}
            isActive={effectiveDisplayedState.activePlayerId === (player1?.id ?? 1)}
            isAi={isPlayer1Ai}
            isGodMode={isGodMode}
            specialsCount={player1SpecialsCount}
            boardPieceCount={team1Count}
            isAnimating={isAnimating}
            effectiveSkill={effectiveSkill}
            onSelectSkill={setSelectedSkill}
            gameMode={gameMode}
          />
        </div>

        {/* Center: 16x16 Chessboard Grid */}
        <div className="flex flex-col items-center lg:col-span-2">
          <GameBoard
            gameState={gameState}
            currentBoard={currentBoard}
            activePlayerTeamId={activePlayer?.teamId ?? 1}
            viewerTeamId={viewerTeamId}
            isAnimating={isAnimating}
            isScreenShaking={isScreenShaking}
            isCurrentPlayerAi={isCurrentPlayerAi}
            gameMode={gameMode}
            standardMoveSet={standardMoveSet}
            pioneerMoveSet={pioneerMoveSet}
            previewCapturedSet={previewCapturedSet}
            flippingCoords={flippingCoords}
            poppingCoord={poppingCoord}
            hoveredCoord={hoveredCoord}
            setHoveredCoord={setHoveredCoord}
            effectiveDropZone={effectiveDropZone}
            blastWaves={blastWaves}
            auraPulses={auraPulses}
            shieldRipples={shieldRipples}
            pierceStrikes={pierceStrikes}
            abyssVortices={abyssVortices}
            pioneerBridges={pioneerBridges}
            floatingTexts={floatingTexts}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Right Column: Player 2 Card (White), Telemetry, Event Logs */}
        <div className="space-y-4">
          <PlayerCard
            teamId={2}
            player={player2}
            isActive={effectiveDisplayedState.activePlayerId === (player2?.id ?? 2)}
            isAi={isPlayer2Ai}
            isGodMode={isGodMode}
            specialsCount={player2SpecialsCount}
            boardPieceCount={team2Count}
            isAnimating={isAnimating}
            effectiveSkill={effectiveSkill}
            onSelectSkill={setSelectedSkill}
            gameMode={gameMode}
          />

          <MatchTelemetryCard
            gameState={gameState}
            activePlayerName={
              activePlayer
                ? activePlayer.teamId === 1
                  ? "第一隊（黑方）"
                  : "第二隊（白方）"
                : undefined
            }
            activePlayerTeamId={activePlayer?.teamId ?? 1}
            onPassTurn={handlePassTurn}
            isAnimating={isAnimating}
            isCurrentPlayerAi={isCurrentPlayerAi}
            gameMode={gameMode}
            aiDifficulty={aiDifficulty}
            setAiDifficulty={setAiDifficulty}
            dropZone={effectiveDropZone}
            team1Count={team1Count}
            team2Count={team2Count}
            neutralCount={neutralCount}
          />

          <EventLogPanel eventLogs={eventLogs} />
        </div>
      </div>

      {/* Match History Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        history={matchTracker.getHistory()}
        onShowToast={handleShowToast}
      />

      {/* Match History Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        onShowToast={handleShowToast}
      />
    </div>
  );
}

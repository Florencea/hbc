import { useEffect, useState } from "react";
import {
  BoardOverlay,
  type AuraPulseEffect,
  type BlastWaveEffect,
  type PioneerBridgeEffect,
  type ShieldRippleEffect,
} from "./components/BoardOverlay.tsx";
import {
  FloatingCombatText,
  type CombatTextItem,
} from "./components/FloatingCombatText.tsx";
import {
  createInitialGame,
  dispatch,
  getAvailableMoves,
  isWithinDropZone,
  sanitizeForViewer,
  SKILL_SPECS,
  type Board,
  type Coord,
  type GameEvent,
  type GameState,
  type MapPreset,
  type MaskedPiece,
  type Piece,
  type Player,
  type SkillType,
} from "./engine/index.ts";
import { playEvents } from "./fx/choreography.ts";
import { isAudioMuted, toggleAudioMuted } from "./fx/sound.ts";

function getTeamColorClass(teamId: number): string {
  if (teamId === 0) {
    return "border-amber-400/80 bg-slate-800 text-amber-300 ring-1 ring-amber-500/40";
  }
  if (teamId === 1) {
    return "border-sky-300/80 bg-sky-400 text-slate-950";
  }
  return "border-rose-300/80 bg-rose-500 text-white";
}

function getTeamName(teamId: number): string {
  if (teamId === 0) {
    return "中立錨點";
  }
  if (teamId === 1) {
    return "第一隊（蒼藍）";
  }
  return "第二隊（緋紅）";
}

function getLegalMarkerClass(teamId: number, isPioneer: boolean): string {
  if (isPioneer) {
    return teamId === 1
      ? "h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
      : "h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]";
  }
  return teamId === 1
    ? "h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400 ring-2 ring-sky-300/70 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
    : "h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500 ring-2 ring-rose-300/70 shadow-[0_0_8px_rgba(244,63,94,0.7)]";
}

const MAP_PRESETS: { preset: MapPreset; label: string; desc: string }[] = [
  {
    preset: "CROSSROADS",
    label: "十字路口",
    desc: "中心十字錨點",
  },
  {
    preset: "ARCHIPELAGO",
    label: "群島孤域",
    desc: "四象限孤島",
  },
  {
    preset: "TRENCHES",
    label: "交錯戰壕",
    desc: "縱橫交錯道",
  },
];

interface SkillVisualConfig {
  label: string;
  annotationStyle: string;
  buttonStyle: string;
  code: string;
}

const SKILL_CONFIG: Record<SkillType, SkillVisualConfig> = {
  NONE: {
    label: "常規棋",
    annotationStyle: "",
    buttonStyle: "bg-slate-800 text-slate-200 border-slate-700",
    code: "",
  },
  WALL: {
    label: "翡翠城壁 (綠)",
    annotationStyle:
      "bg-slate-950/85 text-emerald-400 border border-emerald-500/50",
    buttonStyle: "bg-emerald-950/60 text-emerald-200 border-emerald-800/80",
    code: "壁",
  },
  PIERCE: {
    label: "天空守望者 (藍)",
    annotationStyle: "bg-slate-950/85 text-cyan-300 border border-cyan-400/50",
    buttonStyle: "bg-sky-950/60 text-sky-200 border-sky-800/80",
    code: "守",
  },
  BOMB: {
    label: "殺戮盛宴 (紅)",
    annotationStyle: "bg-slate-950/85 text-rose-400 border border-rose-400/50",
    buttonStyle: "bg-rose-950/60 text-rose-200 border-rose-800/80",
    code: "宴",
  },
  PURIFY: {
    label: "救贖之光 (黃)",
    annotationStyle:
      "bg-slate-950/85 text-amber-400 border border-amber-400/50",
    buttonStyle: "bg-amber-950/60 text-amber-200 border-amber-800/80",
    code: "光",
  },
  COUNTER: {
    label: "深淵復仇者 (黑)",
    annotationStyle: "bg-black/90 text-purple-300 border border-purple-500/60",
    buttonStyle:
      "bg-slate-950/90 text-purple-200 border-purple-900/80 hover:border-purple-600/80",
    code: "仇",
  },
};

const SKILL_OPTIONS: { type: SkillType; label: string }[] = [
  { type: "NONE", label: "常規棋" },
  { type: "WALL", label: "翡翠城壁 (綠)" },
  { type: "PIERCE", label: "天空守望者 (藍)" },
  { type: "BOMB", label: "殺戮盛宴 (紅)" },
  { type: "PURIFY", label: "救贖之光 (黃)" },
  { type: "COUNTER", label: "深淵復仇者 (黑)" },
];

function formatErrorMessage(msg: string): string {
  if (msg.includes("outside assigned drop zone")) {
    return "初始空降階段中，落子必須在指定的空降區域內！";
  }
  if (msg.includes("Forced special move required")) {
    return "特技庫存已達上限！本回合強制施放特技，無法放置常規棋。";
  }
  if (msg.includes("Player does not have this skill")) {
    return "特技庫存不足，無法放置該特技棋！";
  }
  if (msg.includes("Illegal move")) {
    return "無效落子：必須夾殺至少一顆敵方棋子，或在拓荒階段進行合法橋接。";
  }
  if (msg.includes("already occupied")) {
    return "該格已有棋子，無法重複落子！";
  }
  if (msg.includes("Not this player's turn")) {
    return "非當前行動隊伍的回合！";
  }
  if (msg.includes("Cannot pass turn")) {
    return "目前盤面仍有合法落子點，無法跳過回合！";
  }
  if (msg.includes("already over")) {
    return "對局已結束！";
  }
  return msg;
}

interface ToastNotification {
  key: number;
  message: string;
  type: "error" | "info" | "warning";
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  PIECE_PLACED: "落子",
  PIONEER_PLACED: "拓荒落子",
  RAYCAST_BLOCKED: "翡翠格擋",
  PIECE_REVEALED: "特技揭示",
  FLIP_BATCH: "夾殺翻轉",
  COUNTER_TRIGGERED: "深淵反擊",
  BOMB_TRIGGERED: "殺戮引爆",
  PURIFY_PULSE: "救贖脈衝",
  SKILL_ACQUIRED: "特技充能",
  FORCED_SPECIAL_TRIGGERED: "強制特技",
  DROP_PHASE_STARTED: "空降開始",
  DROP_PHASE_ENDED: "全域開啟",
  TURN_CHANGED: "回合輪替",
  GAME_OVER: "對局結束",
};

/**
 * Priority order when forced special is triggered:
 * Furthest down the list, longest cooldown, most powerful:
 * COUNTER (CD 5) -> PURIFY (CD 4) -> WALL (CD 3) -> BOMB (CD 2) -> PIERCE (CD 2)
 */
const FORCED_SPECIAL_PRIORITY: Exclude<SkillType, "NONE">[] = [
  "COUNTER",
  "PURIFY",
  "WALL",
  "BOMB",
  "PIERCE",
];

function getNextSelectedSkill(
  nextState: GameState,
  currentSkill: SkillType,
): SkillType {
  const incomingPlayer = nextState.players.find(
    (p) => p.id === nextState.activePlayerId,
  );
  if (!incomingPlayer) return currentSkill;

  if (incomingPlayer.isForcedSpecial) {
    // Automatically pre-select the skill further down the list / highest CD / most powerful
    const preferred = FORCED_SPECIAL_PRIORITY.find(
      (sk) => incomingPlayer.hand[sk] > 0,
    );
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
  const [isMuted, setIsMuted] = useState<boolean>(() => isAudioMuted());
  const [eventLogs, setEventLogs] = useState<GameEvent[]>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).events,
  );
  const [toast, setToast] = useState<ToastNotification | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [toast]);

  const handleShowToast = (
    message: string,
    type: "error" | "info" | "warning" = "error",
  ) => {
    setToast((prev) => ({
      key: (prev?.key ?? 0) + 1,
      message,
      type,
    }));
  };

  // Animation and Visual FX states
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [intermediateBoard, setIntermediateBoard] = useState<Board | null>(
    null,
  );
  const [flippingCoords, setFlippingCoords] = useState<Set<string>>(
    () => new Set(),
  );
  const [poppingCoord, setPoppingCoord] = useState<Coord | null>(null);
  const [isScreenShaking, setIsScreenShaking] = useState<boolean>(false);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<CombatTextItem[]>([]);
  const [blastWaves, setBlastWaves] = useState<BlastWaveEffect[]>([]);
  const [auraPulses, setAuraPulses] = useState<AuraPulseEffect[]>([]);
  const [shieldRipples, setShieldRipples] = useState<ShieldRippleEffect[]>([]);
  const [pioneerBridges, setPioneerBridges] = useState<PioneerBridgeEffect[]>(
    [],
  );

  const activePlayer: Player | undefined = gameState.players.find(
    (p) => p.id === gameState.activePlayerId,
  );

  // Resolve effective skill: if in forced special, auto-select highest CD / furthest skill if current is NONE or out of stock
  const effectiveSkill: SkillType = (() => {
    if (activePlayer?.isForcedSpecial) {
      if (selectedSkill !== "NONE" && activePlayer.hand[selectedSkill] > 0) {
        return selectedSkill;
      }
      const preferred = FORCED_SPECIAL_PRIORITY.find(
        (sk) => activePlayer.hand[sk] > 0,
      );
      return preferred ?? "NONE";
    }
    return selectedSkill;
  })();

  const displayedState = isGodMode
    ? gameState
    : sanitizeForViewer(gameState, gameState.activePlayerId);

  const currentBoard: (Piece | MaskedPiece | null)[][] = intermediateBoard
    ? isGodMode
      ? intermediateBoard
      : intermediateBoard.map((row) =>
          row.map((piece) => {
            if (!piece) return null;
            if (piece.isRevealed) return piece;
            if (piece.teamId === activePlayer?.teamId) return piece;
            return { ...piece, skillType: "NONE" };
          }),
        )
    : displayedState.board;

  const player1 = displayedState.players.find((p) => p.teamId === 1);
  const player2 = displayedState.players.find((p) => p.teamId === 2);

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

  const availableMoves = getAvailableMoves(
    gameState,
    gameState.activePlayerId,
    effectiveSkill,
  );

  const standardMoveSet = new Set(
    availableMoves.standardMoves.map(
      (m) => `${m.x.toString()},${m.y.toString()}`,
    ),
  );
  const pioneerMoveSet = new Set(
    availableMoves.pioneerMoves.map(
      (m) => `${m.x.toString()},${m.y.toString()}`,
    ),
  );

  const executeEventChoreography = async (
    nextState: GameState,
    events: GameEvent[],
  ) => {
    if (events.length === 0) {
      setGameState(nextState);
      setSelectedSkill((prev) => getNextSelectedSkill(nextState, prev));
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
            row.map((cell, rX) =>
              rX === pos.x && rY === pos.y ? { ...piece } : cell,
            ),
          );
          setIntermediateBoard(currentIntermediateBoard);
          setPoppingCoord(pos);
          setTimeout(() => {
            setPoppingCoord(null);
          }, 180);
        },
        onPioneerPlaced: (pos, piece) => {
          currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
            row.map((cell, rX) =>
              rX === pos.x && rY === pos.y ? { ...piece } : cell,
            ),
          );
          setIntermediateBoard(currentIntermediateBoard);
          setPoppingCoord(pos);
          setTimeout(() => {
            setPoppingCoord(null);
          }, 180);

          let closest: Coord | null = null;
          let minDistance = Infinity;
          for (let y = 0; y < gameState.size; y++) {
            for (let x = 0; x < gameState.size; x++) {
              if (x === pos.x && y === pos.y) continue;
              const p = currentIntermediateBoard[y][x];
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
            setPioneerBridges((prev) => [
              ...prev,
              { id: bridgeId, from: pos, to: closest },
            ]);
            setTimeout(() => {
              setPioneerBridges((prev) =>
                prev.filter((b) => b.id !== bridgeId),
              );
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
                ? { ...cell, teamId: toTeamId }
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
          setShieldRipples((prev) => [
            ...prev,
            { id: rippleId, coord: wallCoord },
          ]);
          setTimeout(() => {
            setShieldRipples((prev) => prev.filter((r) => r.id !== rippleId));
          }, 500);
        },
        onCounterTriggered: (center, reversedCoords, defenderTeamId) => {
          const reversedSet = new Set(
            reversedCoords.map((c) => `${c.x.toString()},${c.y.toString()}`),
          );
          reversedSet.add(`${center.x.toString()},${center.y.toString()}`);

          currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
            row.map((cell, rX) => {
              if (
                reversedSet.has(`${rX.toString()},${rY.toString()}`) &&
                cell
              ) {
                return { ...cell, teamId: defenderTeamId };
              }
              return cell;
            }),
          );
          setIntermediateBoard(currentIntermediateBoard);
        },
        onBombTriggered: (center, blastCoords, teamId) => {
          const blastSet = new Set(
            blastCoords.map((c) => `${c.x.toString()},${c.y.toString()}`),
          );
          currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
            row.map((cell, rX) => {
              if (blastSet.has(`${rX.toString()},${rY.toString()}`) && cell) {
                return { ...cell, teamId };
              }
              return cell;
            }),
          );
          setIntermediateBoard(currentIntermediateBoard);

          const blastId = `${Date.now().toString()}-${Math.random().toString()}`;
          setBlastWaves((prev) => [...prev, { id: blastId, center }]);
          setTimeout(() => {
            setBlastWaves((prev) => prev.filter((b) => b.id !== blastId));
          }, 500);
        },
        onPurifyPulse: (center, affectedCoords, teamId) => {
          const affectedSet = new Set(
            affectedCoords.map((c) => `${c.x.toString()},${c.y.toString()}`),
          );
          currentIntermediateBoard = currentIntermediateBoard.map((row, rY) =>
            row.map((cell, rX) => {
              if (
                affectedSet.has(`${rX.toString()},${rY.toString()}`) &&
                cell
              ) {
                return { ...cell, teamId };
              }
              return cell;
            }),
          );
          setIntermediateBoard(currentIntermediateBoard);

          const auraId = `${Date.now().toString()}-${Math.random().toString()}`;
          setAuraPulses((prev) => [...prev, { id: auraId, center }]);
          setTimeout(() => {
            setAuraPulses((prev) => prev.filter((a) => a.id !== auraId));
          }, 600);
        },
        onAddFloatingText: (text, pos, variant) => {
          const textId = `${Date.now().toString()}-${Math.random().toString()}`;
          setFloatingTexts((prev) => [
            ...prev,
            { id: textId, text, coord: pos, variant },
          ]);
          setTimeout(() => {
            setFloatingTexts((prev) => prev.filter((t) => t.id !== textId));
          }, 850);
        },
        onTriggerScreenShake: (durationMs = 200) => {
          setIsScreenShaking(true);
          setTimeout(() => {
            setIsScreenShaking(false);
          }, durationMs);
        },
        onTriggerScreenFlash: (color = "purple", durationMs = 250) => {
          setScreenFlash(color);
          setTimeout(() => {
            setScreenFlash(null);
          }, durationMs);
        },
      });

      setGameState(nextState);
      setEventLogs((prev) => [...events, ...prev]);
      setSelectedSkill((prev) => getNextSelectedSkill(nextState, prev));
    } finally {
      setIsAnimating(false);
      setIntermediateBoard(null);
    }
  };

  const handleCellClick = (coord: Coord) => {
    if (isAnimating) return;
    try {
      const { nextState, events } = dispatch(gameState, {
        type: "PLACE_PIECE",
        playerId: gameState.activePlayerId,
        coord,
        skillType: effectiveSkill,
      });
      void executeEventChoreography(nextState, events);
    } catch (err) {
      if (err instanceof Error) {
        handleShowToast(formatErrorMessage(err.message), "error");
      }
    }
  };

  const handlePassTurn = () => {
    if (isAnimating) return;
    try {
      const { nextState, events } = dispatch(gameState, {
        type: "PASS_TURN",
        playerId: gameState.activePlayerId,
      });
      void executeEventChoreography(nextState, events);
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
    handleShowToast("對局已重設", "info");
  };

  // Team piece count
  const neutralCount = currentBoard
    .flat()
    .filter((p) => p?.teamId === 0).length;
  const team1Count = currentBoard.flat().filter((p) => p?.teamId === 1).length;
  const team2Count = currentBoard.flat().filter((p) => p?.teamId === 2).length;

  return (
    <div className="min-h-screen bg-slate-900 p-4 font-sans text-slate-100 md:p-8">
      {/* Floating Toast Notification Container - Does NOT displace the board layout */}
      {toast && (
        <div className="pointer-events-none fixed top-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
          <div
            key={toast.key}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
              toast.type === "error"
                ? "border-rose-500/80 bg-rose-950/95 text-rose-100 shadow-rose-950/50"
                : toast.type === "warning"
                  ? "border-amber-500/80 bg-amber-950/95 text-amber-100 shadow-amber-950/50"
                  : "border-sky-500/80 bg-sky-950/95 text-sky-100 shadow-sky-950/50"
            }`}
          >
            <span>
              {toast.type === "error"
                ? "⚠️"
                : toast.type === "warning"
                  ? "⚡"
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

      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <span className="text-blue-500">HBC</span>
            <span>多陣營黑白棋核心引擎</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            五大技能棋、隱藏陷阱與連鎖反應（16x16 無頭引擎）
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const nextMuted = toggleAudioMuted();
              setIsMuted(nextMuted);
            }}
            className={`cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              isMuted
                ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
                : "border border-sky-500/40 bg-sky-950/40 text-sky-200 hover:bg-sky-900/60"
            }`}
          >
            {isMuted ? "🔇 靜音" : "🔊 音效開啟"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsGodMode(!isGodMode);
            }}
            disabled={isAnimating}
            className={`cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isGodMode
                ? "bg-purple-700 text-white hover:bg-purple-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {isGodMode ? "上帝視角（全揭示）" : "戰爭迷霧（玩家視角）"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isAnimating}
            className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            重設對局
          </button>
        </div>
      </header>

      {/* Map Preset Selector Bar */}
      <section className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            地圖預設：
          </span>
          <div className="flex flex-wrap gap-2">
            {MAP_PRESETS.map(({ preset, label, desc }) => {
              const isSelected = selectedPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  disabled={isAnimating}
                  onClick={() => {
                    handleSelectPreset(preset);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-400"
                      : "cursor-pointer bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] ${
                      isSelected ? "text-blue-200" : "text-slate-400"
                    }`}
                  >
                    ({desc})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300">
            <span className="text-amber-400">⚓ 中立錨點：</span>{" "}
            <span className="font-bold text-white">
              {neutralCount.toString()}
            </span>{" "}
            顆
          </span>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Side: Game Board */}
        <section className="flex flex-col items-center lg:col-span-8">
          {/* Consolidated Battlefield Status Bar - Stable height prevents board jitter */}
          <div className="mb-3 flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2 text-xs shadow-sm">
            {isAnimating ? (
              <div className="flex items-center gap-2 text-purple-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
                </span>
                <span className="font-bold tracking-wider">連鎖結算中...</span>
                <span className="text-slate-400">
                  正在執行事件序列與戰鬥動畫
                </span>
              </div>
            ) : availableMoves.isPioneerActive ? (
              <div className="flex items-center gap-2 text-amber-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                <span className="font-bold tracking-wider">拓荒階段啟動：</span>
                <span className="text-slate-300">
                  無可夾殺路徑，請於領地 2 格內放置拓荒橋樑棋
                </span>
              </div>
            ) : gameState.isDropPhase ? (
              <div className="flex items-center gap-2 text-amber-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                </span>
                <span className="font-bold tracking-wider">
                  初始空降階段（Turn 0 配置）：
                </span>
                <span className="text-slate-300">
                  棋子落點限制於專屬空降區域內
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-semibold">
                  全域棋局階段：解除空降限制，套用標準黑白棋規則
                </span>
              </div>
            )}

            {/* Right Status Badge */}
            <div className="flex shrink-0 items-center gap-2">
              {isAnimating ? (
                <span className="rounded bg-purple-900/60 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-300 ring-1 ring-purple-500/40">
                  操作鎖定
                </span>
              ) : availableMoves.isPioneerActive ? (
                <span className="rounded bg-amber-900/60 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/40">
                  {availableMoves.pioneerMoves.length.toString()} 個拓荒目標點
                </span>
              ) : gameState.isDropPhase ? (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="rounded bg-amber-900/60 px-2 py-0.5 text-amber-300">
                    剩餘 {gameState.dropTurnsRemaining.toString()} 回合
                  </span>
                  {activePlayer?.dropZone && (
                    <span className="hidden rounded bg-slate-800 px-2 py-0.5 text-slate-300 sm:inline">
                      中心 ({activePlayer.dropZone.center.x.toString()},{" "}
                      {activePlayer.dropZone.center.y.toString()}) 半徑=
                      {activePlayer.dropZone.radius.toString()}
                    </span>
                  )}
                </div>
              ) : (
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                  地圖：{gameState.mapPreset}
                </span>
              )}
            </div>
          </div>

          <div
            className={`relative rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-2xl transition-transform ${
              isScreenShaking ? "animate-board-shake" : ""
            }`}
          >
            {/* Visual FX Overlays */}
            <BoardOverlay
              boardSize={gameState.size}
              blastWaves={blastWaves}
              auraPulses={auraPulses}
              shieldRipples={shieldRipples}
              pioneerBridges={pioneerBridges}
            />
            <FloatingCombatText
              items={floatingTexts}
              boardSize={gameState.size}
            />

            <div
              className="grid gap-0.5 rounded bg-slate-800/60 p-0.5"
              style={{
                gridTemplateColumns: `repeat(${gameState.size.toString()}, minmax(0, 1fr))`,
              }}
            >
              {currentBoard.map((row, y) =>
                row.map((piece, x) => {
                  const key = `${x.toString()},${y.toString()}`;
                  const isStandardLegal = standardMoveSet.has(key);
                  const isPioneerLegal = pioneerMoveSet.has(key);
                  const isLegal = isStandardLegal || isPioneerLegal;
                  const inDropZone =
                    gameState.isDropPhase &&
                    activePlayer?.dropZone &&
                    isWithinDropZone({ x, y }, activePlayer.dropZone);
                  const isFlipping = flippingCoords.has(key);
                  const isPopping =
                    poppingCoord?.x === x && poppingCoord.y === y;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleCellClick({ x, y });
                      }}
                      disabled={
                        isAnimating ||
                        gameState.isGameOver ||
                        (piece !== null && !isLegal)
                      }
                      className={`relative flex h-6 w-6 items-center justify-center rounded-xs transition-all sm:h-7 sm:w-7 md:h-8 md:w-8 ${
                        (x + y) % 2 === 0
                          ? "bg-slate-900/90"
                          : "bg-slate-800/70"
                      } ${
                        gameState.isDropPhase
                          ? inDropZone
                            ? activePlayer.teamId === 1
                              ? "bg-sky-950/30 ring-1 ring-sky-400/50 ring-inset"
                              : "bg-rose-950/30 ring-1 ring-rose-400/50 ring-inset"
                            : "opacity-40"
                          : ""
                      } ${
                        isAnimating
                          ? "cursor-not-allowed"
                          : isLegal
                            ? activePlayer?.teamId === 1
                              ? "cursor-pointer hover:bg-sky-950/40 hover:ring-1 hover:ring-sky-400/60"
                              : "cursor-pointer hover:bg-rose-950/40 hover:ring-1 hover:ring-rose-400/60"
                            : "hover:bg-slate-700/50"
                      }`}
                    >
                      {/* Legal Move Marker matching active team color */}
                      {piece === null && !isAnimating && isStandardLegal && (
                        <span
                          className={getLegalMarkerClass(
                            activePlayer?.teamId ?? 1,
                            false,
                          )}
                        />
                      )}
                      {piece === null && !isAnimating && isPioneerLegal && (
                        <span
                          className={getLegalMarkerClass(
                            activePlayer?.teamId ?? 1,
                            true,
                          )}
                        />
                      )}

                      {/* Piece Representation */}
                      {piece && (
                        <div
                          className={`relative flex h-5 w-5 items-center justify-center rounded-full border shadow-xs transition-transform sm:h-6 sm:w-6 md:h-7 md:w-7 ${getTeamColorClass(
                            piece.teamId,
                          )} ${
                            !piece.isRevealed
                              ? "border-dashed ring-1 ring-slate-400/50"
                              : ""
                          } ${isFlipping ? "animate-piece-flip" : ""} ${
                            isPopping ? "animate-piece-pop" : ""
                          }`}
                        >
                          {piece.teamId === 0 ? (
                            <span className="text-[10px] sm:text-xs">⚓</span>
                          ) : SKILL_CONFIG[piece.skillType].code ? (
                            <span
                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black sm:h-4 sm:w-4 sm:text-[10px] ${
                                SKILL_CONFIG[piece.skillType].annotationStyle
                              }`}
                            >
                              {SKILL_CONFIG[piece.skillType].code}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </section>

        {/* Right Side: Game Controls & Telemetry */}
        <section className="flex flex-col gap-6 lg:col-span-4">
          {/* Match Controls Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                對局遙測資訊
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-200">
                第 {gameState.currentTurn.toString()} 回合
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">當前回合：</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full border ${
                      activePlayer?.teamId === 1
                        ? "border-sky-300 bg-sky-400"
                        : "border-rose-400 bg-rose-500"
                    }`}
                  />
                  <span>
                    {activePlayer?.name ?? "未知玩家"} (
                    {getTeamName(activePlayer?.teamId ?? 1)})
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={handlePassTurn}
                disabled={isAnimating || gameState.isGameOver}
                className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                跳過回合
              </button>
            </div>

            {/* Game Phase & Drop Zone Status */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
              <span>遊戲階段：</span>
              <span className="font-semibold text-slate-200">
                {gameState.isDropPhase ? (
                  <span className="text-amber-400">
                    初始空降階段（剩餘 {gameState.dropTurnsRemaining.toString()}{" "}
                    回合）
                  </span>
                ) : (
                  <span className="text-emerald-400">全域對局</span>
                )}
              </span>
            </div>

            {activePlayer?.dropZone && gameState.isDropPhase && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>當前空降區：</span>
                <span className="font-mono text-slate-300">
                  中心 ({activePlayer.dropZone.center.x.toString()},{" "}
                  {activePlayer.dropZone.center.y.toString()})，半徑=
                  {activePlayer.dropZone.radius.toString()}
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                盤面棋數統計：
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md border border-sky-500/40 bg-sky-950/80 px-2 py-0.5 font-bold text-sky-300">
                  {team1Count.toString()} 蒼藍
                </span>
                <span className="text-slate-600">/</span>
                <span className="rounded-md border border-rose-500/40 bg-rose-950/80 px-2 py-0.5 font-bold text-rose-300">
                  {team2Count.toString()} 緋紅
                </span>
                <span className="text-slate-600">/</span>
                <span className="rounded-md border border-amber-500/40 bg-slate-800 px-2 py-0.5 font-bold text-amber-300">
                  {neutralCount.toString()} 錨點
                </span>
              </div>
            </div>
          </div>

          {/* Team 1 Panel (Sky) */}
          {(() => {
            const isActive = activePlayer?.teamId === 1;
            return (
              <div
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-all ${
                  isActive
                    ? "border-sky-500/80 bg-slate-950 shadow-lg ring-1 shadow-sky-950/30 ring-sky-500/40"
                    : "border-slate-800/80 bg-slate-950/60 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-sky-300/80 bg-sky-400" />
                    <span className="text-xs font-bold text-slate-200">
                      第一隊（蒼藍）
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        行動中
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        等待中
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {player1?.isForcedSpecial && (
                      <span className="animate-pulse rounded border border-amber-500/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300 ring-1 ring-amber-400/40">
                        ⚡ 強制特技
                      </span>
                    )}
                    <span className="rounded-md border border-purple-500/40 bg-purple-950/60 px-2 py-0.5 text-[11px] font-black text-purple-200 shadow-xs">
                      特技: {player1SpecialsCount.toString()} 枚
                    </span>
                    <span className="rounded-md border border-sky-400/40 bg-sky-950/60 px-2 py-0.5 text-[11px] font-black text-sky-200 shadow-xs">
                      盤面: {team1Count.toString()} 顆
                    </span>
                  </div>
                </div>

                {player1?.isForcedSpecial && isActive && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/70 bg-amber-950/70 px-3 py-2 text-xs text-amber-200 shadow-md">
                    <span className="text-base">⚡</span>
                    <div className="flex flex-col">
                      <span className="font-bold tracking-wide text-amber-300">
                        強制特技施放階段 (Forced Special)
                      </span>
                      <span className="text-[11px] text-amber-200/90">
                        特技庫存已達上限且充能完畢！已自動選取優先度最高之特技（
                        {SKILL_CONFIG[effectiveSkill].label.split(" ")[0]}
                        ），本回合必須放置特殊棋。
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {SKILL_OPTIONS.map((opt) => {
                    const isNone = opt.type === "NONE";
                    const spec =
                      opt.type !== "NONE" ? SKILL_SPECS[opt.type] : null;
                    const count = isNone
                      ? Infinity
                      : (player1?.hand[opt.type] ?? 0);
                    const maxHand = spec?.maxHand ?? Infinity;
                    const charge = isNone
                      ? 0
                      : (player1?.charge[opt.type] ?? 0);
                    const cd = spec?.cd ?? 0;

                    const isOutOfStock = !isNone && count <= 0;
                    const isForbidden =
                      isNone && (player1?.isForcedSpecial ?? false);
                    const isDisabled =
                      isAnimating || !isActive || isOutOfStock || isForbidden;
                    const isSelected = isActive && effectiveSkill === opt.type;
                    const config = SKILL_CONFIG[opt.type];

                    return (
                      <button
                        key={opt.type}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isActive && !isDisabled) {
                            setSelectedSkill(opt.type);
                          }
                        }}
                        title={
                          !isActive
                            ? "等待第一隊（蒼藍）回合"
                            : isForbidden
                              ? "強制特技生效中，禁止放置常規棋"
                              : isOutOfStock
                                ? "無庫存可用（冷卻中）"
                                : `選擇 ${config.label}`
                        }
                        className={`relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-sky-400 bg-slate-800 text-white shadow-md ring-2 ring-sky-500/50"
                            : isDisabled
                              ? "cursor-not-allowed border-slate-800/60 bg-slate-900/30 text-slate-500 opacity-40"
                              : `${config.buttonStyle} cursor-pointer opacity-85 hover:opacity-100`
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-sky-300/80 bg-sky-400 shadow-xs">
                              {config.code ? (
                                <span
                                  className={`flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-black ${config.annotationStyle}`}
                                >
                                  {config.code}
                                </span>
                              ) : null}
                            </span>
                            <span className="truncate text-[11px] font-bold">
                              {opt.label.split(" ")[0]}
                            </span>
                          </div>

                          {/* Prominent Stock Badge */}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-tight ${
                              isNone
                                ? "border border-slate-700 bg-slate-800 text-slate-300"
                                : count >= maxHand
                                  ? "border border-amber-400/80 bg-amber-500/30 text-amber-200 shadow-xs ring-1 ring-amber-400/40"
                                  : count > 0
                                    ? "border border-emerald-400/80 bg-emerald-500/30 text-emerald-100 shadow-xs ring-1 ring-emerald-400/40"
                                    : "border border-rose-900/60 bg-rose-950/60 text-rose-400/90"
                            }`}
                          >
                            {isNone
                              ? "∞ 無限"
                              : count >= maxHand
                                ? `庫存 ${count.toString()}/${maxHand.toString()}（滿）`
                                : count > 0
                                  ? `庫存 ${count.toString()}/${maxHand.toString()}`
                                  : `0/${maxHand.toString()}（無庫存）`}
                          </span>
                        </div>

                        {!isNone && (
                          <div className="w-full">
                            <div className="mb-0.5 flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">冷卻進度</span>
                              <span className="font-mono font-bold text-slate-200">
                                {charge.toString()}/{cd.toString()} 回合
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  count >= maxHand
                                    ? "bg-amber-400"
                                    : charge >= cd - 1
                                      ? "bg-sky-400"
                                      : "bg-blue-600"
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.round((charge / cd) * 100)).toString()}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {isForbidden && (
                          <span className="text-[10px] font-bold text-red-400">
                            🚫 禁下常規棋
                          </span>
                        )}
                        {!isNone &&
                          isOutOfStock &&
                          !isForbidden &&
                          isActive && (
                            <span className="text-[10px] font-semibold text-rose-400">
                              ❌ 無庫存（冷卻中）
                            </span>
                          )}
                        {!isNone && count > 0 && !isForbidden && isActive && (
                          <span className="text-[10px] font-semibold text-emerald-400">
                            ✔ 可部署
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Team 2 Panel (Rose) */}
          {(() => {
            const isActive = activePlayer?.teamId === 2;
            return (
              <div
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-all ${
                  isActive
                    ? "border-rose-500/80 bg-slate-950 shadow-lg ring-1 shadow-rose-950/30 ring-rose-500/40"
                    : "border-slate-800/80 bg-slate-950/60 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-rose-300/80 bg-rose-500" />
                    <span className="text-xs font-bold text-slate-200">
                      第二隊（緋紅）
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        行動中
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        等待中
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {player2?.isForcedSpecial && (
                      <span className="animate-pulse rounded border border-amber-500/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300 ring-1 ring-amber-400/40">
                        ⚡ 強制特技
                      </span>
                    )}
                    <span className="rounded-md border border-purple-500/40 bg-purple-950/60 px-2 py-0.5 text-[11px] font-black text-purple-200 shadow-xs">
                      特技: {player2SpecialsCount.toString()} 枚
                    </span>
                    <span className="rounded-md border border-rose-400/40 bg-rose-950/60 px-2 py-0.5 text-[11px] font-black text-rose-200 shadow-xs">
                      盤面: {team2Count.toString()} 顆
                    </span>
                  </div>
                </div>

                {player2?.isForcedSpecial && isActive && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/70 bg-amber-950/70 px-3 py-2 text-xs text-amber-200 shadow-md">
                    <span className="text-base">⚡</span>
                    <div className="flex flex-col">
                      <span className="font-bold tracking-wide text-amber-300">
                        強制特技施放階段 (Forced Special)
                      </span>
                      <span className="text-[11px] text-amber-200/90">
                        特技庫存已達上限且充能完畢！已自動選取優先度最高之特技（
                        {SKILL_CONFIG[effectiveSkill].label.split(" ")[0]}
                        ），本回合必須放置特殊棋。
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {SKILL_OPTIONS.map((opt) => {
                    const isNone = opt.type === "NONE";
                    const spec =
                      opt.type !== "NONE" ? SKILL_SPECS[opt.type] : null;
                    const count = isNone
                      ? Infinity
                      : (player2?.hand[opt.type] ?? 0);
                    const maxHand = spec?.maxHand ?? Infinity;
                    const charge = isNone
                      ? 0
                      : (player2?.charge[opt.type] ?? 0);
                    const cd = spec?.cd ?? 0;

                    const isOutOfStock = !isNone && count <= 0;
                    const isForbidden =
                      isNone && (player2?.isForcedSpecial ?? false);
                    const isDisabled =
                      isAnimating || !isActive || isOutOfStock || isForbidden;
                    const isSelected = isActive && effectiveSkill === opt.type;
                    const config = SKILL_CONFIG[opt.type];

                    return (
                      <button
                        key={opt.type}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isActive && !isDisabled) {
                            setSelectedSkill(opt.type);
                          }
                        }}
                        title={
                          !isActive
                            ? "等待第二隊（緋紅）回合"
                            : isForbidden
                              ? "強制特技生效中，禁止放置常規棋"
                              : isOutOfStock
                                ? "無庫存可用（冷卻中）"
                                : `選擇 ${config.label}`
                        }
                        className={`relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-left text-xs transition-all ${
                          isSelected
                            ? "border-rose-400 bg-slate-800 text-white shadow-md ring-2 ring-rose-500/50"
                            : isDisabled
                              ? "cursor-not-allowed border-slate-800/60 bg-slate-900/30 text-slate-500 opacity-40"
                              : `${config.buttonStyle} cursor-pointer opacity-85 hover:opacity-100`
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rose-300/80 bg-rose-500 shadow-xs">
                              {config.code ? (
                                <span
                                  className={`flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-black ${config.annotationStyle}`}
                                >
                                  {config.code}
                                </span>
                              ) : null}
                            </span>
                            <span className="truncate text-[11px] font-bold">
                              {opt.label.split(" ")[0]}
                            </span>
                          </div>

                          {/* Prominent Stock Badge */}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-tight ${
                              isNone
                                ? "border border-slate-700 bg-slate-800 text-slate-300"
                                : count >= maxHand
                                  ? "border border-amber-400/80 bg-amber-500/30 text-amber-200 shadow-xs ring-1 ring-amber-400/40"
                                  : count > 0
                                    ? "border border-emerald-400/80 bg-emerald-500/30 text-emerald-100 shadow-xs ring-1 ring-emerald-400/40"
                                    : "border border-rose-900/60 bg-rose-950/60 text-rose-400/90"
                            }`}
                          >
                            {isNone
                              ? "∞ 無限"
                              : count >= maxHand
                                ? `庫存 ${count.toString()}/${maxHand.toString()}（滿）`
                                : count > 0
                                  ? `庫存 ${count.toString()}/${maxHand.toString()}`
                                  : `0/${maxHand.toString()}（無庫存）`}
                          </span>
                        </div>

                        {!isNone && (
                          <div className="w-full">
                            <div className="mb-0.5 flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">冷卻進度</span>
                              <span className="font-mono font-bold text-slate-200">
                                {charge.toString()}/{cd.toString()} 回合
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  count >= maxHand
                                    ? "bg-amber-400"
                                    : charge >= cd - 1
                                      ? "bg-sky-400"
                                      : "bg-blue-600"
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.round((charge / cd) * 100)).toString()}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {isForbidden && (
                          <span className="text-[10px] font-bold text-red-400">
                            🚫 禁下常規棋
                          </span>
                        )}
                        {!isNone &&
                          isOutOfStock &&
                          !isForbidden &&
                          isActive && (
                            <span className="text-[10px] font-semibold text-rose-400">
                              ❌ 無庫存（冷卻中）
                            </span>
                          )}
                        {!isNone && count > 0 && !isForbidden && isActive && (
                          <span className="text-[10px] font-semibold text-emerald-400">
                            ✔ 可部署
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Event Log Stream */}
          <div className="flex min-h-64 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                事件溯源日誌串流
              </span>
              <span className="text-xs text-slate-500">
                {eventLogs.length.toString()} 筆事件
              </span>
            </div>

            <div className="max-h-72 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
              {eventLogs.length === 0 ? (
                <div className="py-4 text-center text-slate-500 italic">
                  尚無事件。落子以觸發引擎狀態轉移。
                </div>
              ) : (
                eventLogs.map((ev, idx) => (
                  <div
                    key={`${ev.type}-${idx.toString()}`}
                    className="flex flex-col gap-1 rounded border border-slate-800/80 bg-slate-900 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-blue-400">
                          {ev.type}
                        </span>
                        {EVENT_TYPE_LABELS[ev.type] && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {EVENT_TYPE_LABELS[ev.type]}
                          </span>
                        )}
                      </div>
                      {ev.type === "DROP_PHASE_STARTED" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          地圖預設：{ev.mapPreset}
                        </span>
                      )}
                      {ev.type === "PIONEER_PLACED" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          拓荒橋樑 ({ev.coord.x.toString()},{" "}
                          {ev.coord.y.toString()})
                        </span>
                      )}
                      {ev.type === "DROP_PHASE_ENDED" && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          全域對局已啟動
                        </span>
                      )}
                      {ev.type === "RAYCAST_BLOCKED" && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          翡翠城壁格擋
                        </span>
                      )}
                      {ev.type === "COUNTER_TRIGGERED" && (
                        <span className="rounded border border-purple-500/40 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                          深淵復仇者反擊
                        </span>
                      )}
                      {ev.type === "BOMB_TRIGGERED" && (
                        <span className="rounded border border-rose-500/40 bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          殺戮盛宴引爆
                        </span>
                      )}
                      {ev.type === "PURIFY_PULSE" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          救贖之光淨化
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {JSON.stringify(ev)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

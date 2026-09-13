import { useCallback, useEffect, useState } from "react";
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
  collectAllRaycasts,
  createInitialGame,
  dispatch,
  getAvailableMoves,
  isWithinDropZone,
  sanitizeForViewer,
  selectBestMove,
  SKILL_SPECS,
  type Action,
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

export type GameMode = "PVP" | "PVE" | "AI_VS_AI";

function getTeamColorClass(teamId: number): string {
  if (teamId === 0) {
    return "border-amber-400/90 bg-slate-800 text-amber-300 ring-1 ring-amber-500/50 shadow-md";
  }
  if (teamId === 1) {
    return "border-zinc-400/90 bg-linear-to-br from-zinc-800 via-zinc-900 to-black text-zinc-100 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_3px_6px_rgba(0,0,0,0.9)] ring-1 ring-zinc-300/60";
  }
  return "border-zinc-300 bg-linear-to-br from-white via-zinc-100 to-zinc-200 text-zinc-900 shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_3px_6px_rgba(0,0,0,0.35)] ring-1 ring-zinc-300/80";
}

function getTeamName(teamId: number): string {
  if (teamId === 0) {
    return "中立錨點";
  }
  if (teamId === 1) {
    return "第一隊（黑方）";
  }
  return "第二隊（白方）";
}

function getLegalMarkerClass(teamId: number, isPioneer: boolean): string {
  if (isPioneer) {
    return teamId === 1
      ? "h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-950 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
      : "h-2.5 w-2.5 animate-pulse rounded-full bg-white ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]";
  }
  return teamId === 1
    ? "h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-950 ring-2 ring-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
    : "h-2.5 w-2.5 animate-pulse rounded-full bg-white ring-2 ring-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.9)]";
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

interface SkillInfoDetail {
  name: string;
  role: string;
  badge: string;
  badgeColor: string;
  cdText: string;
  maxHandText: string;
  trigger: string;
  effect: string;
  tactics: string;
}

const SKILL_DETAILS: Record<SkillType, SkillInfoDetail> = {
  NONE: {
    name: "常規棋",
    role: "經典黑白棋",
    badge: "基礎骨幹",
    badgeColor: "border-slate-700 bg-slate-800 text-slate-300",
    cdText: "無冷卻",
    maxHandText: "∞ 無上限",
    trigger: "主動落子",
    effect:
      "遵循經典黑白棋規則，在 8 個方向的任一直線上夾住敵方棋子並將其全數翻轉。此棋為建構地盤與拓荒推進的基本單位。",
    tactics:
      "注意：當所有特殊棋庫存已滿且無法繼續充能時，將觸發「強制特技」，該回合將被鎖定禁止放置常規棋。",
  },
  WALL: {
    name: "翡翠城壁",
    role: "射線攔截者",
    badge: "綠色防禦",
    badgeColor: "border-emerald-500/50 bg-emerald-950/80 text-emerald-300",
    cdText: "4 回合",
    maxHandText: "1 枚",
    trigger: "常駐被動格擋",
    effect:
      "格擋敵方射線穿透，不可被常規夾擊翻轉。反擊（COUNTER）逆轉路徑遇城壁亦會停止。僅能被「殺戮盛宴」引爆或「救贖之光」淨化。",
    tactics:
      "守角、卡死關鍵邊線與阻絕敵方大面積射線翻盤的防守核心，能穩定構建不可動搖的堅實地盤邊界。",
  },
  PIERCE: {
    name: "天空守望者",
    role: "穿透突防者",
    badge: "藍色突擊",
    badgeColor: "border-cyan-400/50 bg-sky-950/80 text-cyan-300",
    cdText: "3 回合",
    maxHandText: "2 枚",
    trigger: "主動落子貫穿",
    effect:
      "射線無視敵方「翡翠城壁」阻擋直接貫穿翻轉，且在翻轉敵方「深淵復仇者」時完全免疫其反噬。行使穿透或免疫特性時揭示真身。",
    tactics:
      "破防王牌！專門克制敵方城壁鐵桶陣與復仇陷阱，適合用來搶佔角落或強行突破敵方封鎖線。",
  },
  BOMB: {
    name: "殺戮盛宴",
    role: "範圍爆破者",
    badge: "紅色毀滅",
    badgeColor: "border-rose-400/50 bg-rose-950/80 text-rose-300",
    cdText: "4 回合",
    maxHandText: "2 枚",
    trigger: "被翻轉/連鎖引爆",
    effect:
      "被射線翻轉、被反擊波及或被相鄰炸彈波及時引爆，摧毀周圍 3x3 範圍內所有棋子（含友軍與城壁）並轉化為引爆方常規棋；引爆後自身亦化為常規棋。",
    tactics:
      "強大清盤與逆轉神器！多顆炸彈可引發連鎖引爆（Chain Reaction）席捲大半盤面，但需注意敵我不分避免重創友軍。",
  },
  PURIFY: {
    name: "救贖之光",
    role: "範圍淨化者",
    badge: "黃色中和",
    badgeColor: "border-amber-400/50 bg-amber-950/80 text-amber-300",
    cdText: "5 回合",
    maxHandText: "1 枚",
    trigger: "每回合結束脈衝",
    effect:
      "放置後每回合結束時向周圍 3x3 釋放淨化光環，持續 3 回合（duration: 3）後自毀衰退。範圍內所有敵我特殊棋無聲轉化為施放方之常規棋（不觸發炸彈與反擊）。",
    tactics:
      "和平解除敵方致命地雷陣與反擊陷阱的戰略神器，能毫無風險地奪取特技據點並消除威脅。",
  },
  COUNTER: {
    name: "深淵復仇者",
    role: "致命反噬陷阱",
    badge: "黑紫反擊",
    badgeColor: "border-purple-500/50 bg-purple-950/80 text-purple-300",
    cdText: "7 回合",
    maxHandText: "1 枚",
    trigger: "被敵方翻轉時",
    effect:
      "以未揭示狀態潛伏於盤面。當被敵方棋子（天空守望者除外）翻轉時，瞬間逆轉整條吃子射線，將敵方落下的棋子及沿途所有翻轉棋子強行反噬奪為己方棋子！",
    tactics:
      "最高威懾力的致命陷阱！故意露出破綻誘使敵方大面積夾擊，達成一擊必殺的反客為主逆轉。",
  },
};

function SkillDetailTooltip({
  skillType,
  index,
}: {
  skillType: SkillType;
  index: number;
}) {
  const detail = SKILL_DETAILS[skillType];
  const config = SKILL_CONFIG[skillType];
  const isTopRow = index < 2;
  const isLeftCol = index % 2 === 0;

  return (
    <div
      className={`pointer-events-none absolute z-50 w-72 rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md transition-all duration-150 ${
        isTopRow ? "top-full mt-2" : "bottom-full mb-2"
      } ${
        isLeftCol ? "left-0" : "right-0"
      } opacity-0 group-focus-within:opacity-100 group-hover:opacity-100`}
    >
      {/* Card Header: Icon + Name + Role + Badge */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] font-black">
            {config.code ? (
              <span className={config.annotationStyle}>{config.code}</span>
            ) : (
              <span className="text-[10px] text-slate-400">●</span>
            )}
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-slate-100">{detail.name}</span>
            <span className="text-[10px] text-slate-400">{detail.role}</span>
          </div>
        </div>
        <span
          className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${detail.badgeColor}`}
        >
          {detail.badge}
        </span>
      </div>

      {/* Parameters: Cooldown, Hand Cap, Trigger Timing */}
      <div className="my-2 grid grid-cols-3 gap-1 rounded-lg border border-slate-800/80 bg-slate-900/70 p-1.5 text-center text-[10px]">
        <div className="flex flex-col">
          <span className="text-slate-400">冷卻時間</span>
          <span className="font-mono font-bold text-amber-300">
            {detail.cdText}
          </span>
        </div>
        <div className="flex flex-col border-x border-slate-800/80">
          <span className="text-slate-400">手牌上限</span>
          <span className="font-mono font-bold text-emerald-300">
            {detail.maxHandText}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-slate-400">觸發機制</span>
          <span className="font-bold text-sky-300">{detail.trigger}</span>
        </div>
      </div>

      {/* Effects & Tactical Tips */}
      <div className="space-y-1.5 text-[11px] leading-relaxed">
        <div>
          <span className="font-bold text-slate-200">【作用效果】</span>
          <p className="mt-0.5 text-slate-300/90">{detail.effect}</p>
        </div>
        <div>
          <span className="font-bold text-amber-300/90">【戰術建議】</span>
          <p className="mt-0.5 text-slate-400">{detail.tactics}</p>
        </div>
      </div>
    </div>
  );
}

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
  const incomingPlayer = nextState.players.find(
    (p) => p.id === nextState.activePlayerId,
  );
  if (!incomingPlayer) return "NONE";

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
  const [gameMode, setGameMode] = useState<GameMode>("PVE");
  const [isAiPlaying, setIsAiPlaying] = useState<boolean>(true);
  const [aiSpeed, setAiSpeed] = useState<"NORMAL" | "FAST">("NORMAL");
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => isAudioMuted());
  const [eventLogs, setEventLogs] = useState<GameEvent[]>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).events,
  );
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [hoveredCoord, setHoveredCoord] = useState<Coord | null>(null);

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

  const isCurrentPlayerAi =
    gameMode === "AI_VS_AI" ||
    (gameMode === "PVE" && gameState.activePlayerId === 2);

  const isPlayer1Ai = gameMode === "AI_VS_AI";
  const isPlayer2Ai = gameMode === "PVE" || gameMode === "AI_VS_AI";

  const isHumanTurn =
    gameMode === "PVP" ||
    (gameMode === "PVE" && gameState.activePlayerId === 1);

  // Pre-calculate AI move decision for current state so UI highlights and board previews match the AI's actual choice
  const aiAction: Action | null = (() => {
    if (gameState.isGameOver || !isCurrentPlayerAi) return null;
    try {
      return selectBestMove(gameState, gameState.activePlayerId, "MEDIUM");
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
      const preferred = FORCED_SPECIAL_PRIORITY.find(
        (sk) => activePlayer.hand[sk] > 0,
      );
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

  const currentBoard: (Piece | MaskedPiece | null)[][] = intermediateBoard
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

  // In PVE mode during bot's turn, do not show computer's possible legal moves
  const availableMoves =
    gameMode === "PVE" && gameState.activePlayerId === 2
      ? { standardMoves: [], pioneerMoves: [], isPioneerActive: false }
      : getAvailableMoves(gameState, gameState.activePlayerId, effectiveSkill);

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

  // Hover preview: preview board state after capturing pieces (assuming standard pieces)
  const previewCapturedSet = (() => {
    if (
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
      "NONE",
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
    async (nextState: GameState, events: GameEvent[]) => {
      if (events.length === 0) {
        setGameState(nextState);
        setSelectedSkill((prev) =>
          getNextSelectedSkill(nextState, prev, isHumanTurn),
        );
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
          onGameOver: () => {
            setShowGameOverModal(true);
          },
        });

        setGameState(nextState);
        setEventLogs((prev) => [...events, ...prev]);
        setSelectedSkill((prev) =>
          getNextSelectedSkill(nextState, prev, isHumanTurn),
        );
        if (nextState.isGameOver) {
          setShowGameOverModal(true);
        }
      } finally {
        setIsAnimating(false);
        setIntermediateBoard(null);
      }
    },
    [gameState.board, gameState.size, isHumanTurn],
  );

  // Automated AI turn execution for PVE (Bot turn) or AI_VS_AI (Both turns)
  useEffect(() => {
    if (gameState.isGameOver || isAnimating) return;
    if (!isCurrentPlayerAi) return;
    if (gameMode === "AI_VS_AI" && !isAiPlaying) return;

    const delayMs = aiSpeed === "FAST" ? 250 : 600;
    const timer = setTimeout(() => {
      try {
        const action =
          aiAction ??
          selectBestMove(gameState, gameState.activePlayerId, "MEDIUM");
        const { nextState, events } = dispatch(gameState, action);
        void executeEventChoreography(nextState, events);
      } catch (err) {
        if (err instanceof Error) {
          handleShowToast(formatErrorMessage(err.message), "error");
        }
        // Failsafe: pass turn if AI action encounters an error to prevent game stall
        try {
          const { nextState, events } = dispatch(gameState, {
            type: "PASS_TURN",
            playerId: gameState.activePlayerId,
          });
          void executeEventChoreography(nextState, events);
        } catch {
          // If pass also fails, state remains
        }
      }
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [
    gameMode,
    isCurrentPlayerAi,
    isAiPlaying,
    aiSpeed,
    gameState,
    isAnimating,
    aiAction,
    executeEventChoreography,
  ]);

  const handleAiStep = () => {
    if (gameState.isGameOver || isAnimating || !isCurrentPlayerAi) return;
    try {
      const action =
        aiAction ??
        selectBestMove(gameState, gameState.activePlayerId, "MEDIUM");
      const { nextState, events } = dispatch(gameState, action);
      void executeEventChoreography(nextState, events);
    } catch (err) {
      if (err instanceof Error) {
        handleShowToast(formatErrorMessage(err.message), "error");
      }
      try {
        const { nextState, events } = dispatch(gameState, {
          type: "PASS_TURN",
          playerId: gameState.activePlayerId,
        });
        void executeEventChoreography(nextState, events);
      } catch {
        // Failsafe
      }
    }
  };

  const handleCellClick = (coord: Coord) => {
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
    if (isAnimating || isCurrentPlayerAi || gameState.isGameOver) return;
    if (
      availableMoves.standardMoves.length > 0 ||
      availableMoves.pioneerMoves.length > 0
    ) {
      handleShowToast("目前盤面仍有合法落子點，無法跳過回合！", "warning");
      return;
    }
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
    setShowGameOverModal(false);
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

      {/* Game Over Settlement Modal */}
      {showGameOverModal && gameState.isGameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowGameOverModal(false);
              }}
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>

            {/* Winner Announcement Header */}
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-3xl shadow-inner">
                {gameState.winnerTeamId === 1 || gameState.winnerTeamId === 2
                  ? "🏆"
                  : "🤝"}
              </div>
              <h2 className="text-xl font-black tracking-wide text-white">
                {gameState.winnerTeamId === 1
                  ? "第一隊（黑方）獲勝！"
                  : gameState.winnerTeamId === 2
                    ? "第二隊（白方）獲勝！"
                    : "勢均力敵・平局結算！"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {gameState.winnerTeamId === null
                  ? "雙方棋子數完全相同，平分秋色"
                  : `恭喜 ${
                      gameState.winnerTeamId === 1 ? "黑方" : "白方"
                    } 奪得本局對戰勝利！`}
              </p>
            </div>

            {/* Score Comparison Display */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* Team 1 (Black) */}
              <div
                className={`flex flex-col items-center rounded-xl border p-4 transition-all ${
                  gameState.winnerTeamId === 1
                    ? "border-zinc-500 bg-zinc-950 shadow-lg ring-2 ring-zinc-400/80"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-500 bg-zinc-950 shadow-xs ring-1 ring-zinc-700/60" />
                  <span className="text-xs font-bold text-slate-300">
                    第一隊（黑方）
                  </span>
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  {team1Count.toString()}
                </div>
                <span className="mt-1 text-[10px] text-slate-400">枚棋子</span>
                {gameState.winnerTeamId === 1 && (
                  <span className="mt-2 rounded-full border border-amber-400/80 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    👑 優勝
                  </span>
                )}
              </div>

              {/* Team 2 (White) */}
              <div
                className={`flex flex-col items-center rounded-xl border p-4 transition-all ${
                  gameState.winnerTeamId === 2
                    ? "border-slate-300 bg-slate-800 shadow-lg ring-2 ring-slate-200/80"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 bg-white shadow-xs ring-1 ring-slate-200/80" />
                  <span className="text-xs font-bold text-slate-300">
                    第二隊（白方）
                  </span>
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  {team2Count.toString()}
                </div>
                <span className="mt-1 text-[10px] text-slate-400">枚棋子</span>
                {gameState.winnerTeamId === 2 && (
                  <span className="mt-2 rounded-full border border-amber-400/80 bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                    👑 優勝
                  </span>
                )}
              </div>
            </div>

            {/* Match Summary Telemetry */}
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-400">
              <div className="flex justify-between border-b border-slate-800/60 py-1">
                <span>對戰模式</span>
                <span className="font-semibold text-slate-200">
                  {gameMode === "PVP"
                    ? "👥 同機雙人"
                    : gameMode === "PVE"
                      ? "🤖 人機對戰"
                      : "⚔️ 雙 AI 演示"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1">
                <span>總對局回合</span>
                <span className="font-mono font-bold text-slate-200">
                  {gameState.currentTurn.toString()} 回合
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 py-1">
                <span>地圖預設</span>
                <span className="font-semibold text-slate-200">
                  {gameState.mapPreset}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span>中立錨點存留</span>
                <span className="font-mono font-bold text-amber-300">
                  {neutralCount.toString()} 顆
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 text-center text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-500"
              >
                🔄 再玩一局
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGameOverModal(false);
                }}
                className="flex-1 cursor-pointer rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-center text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
              >
                🔍 檢視棋盤
              </button>
            </div>
          </div>
        </div>
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Game Mode Selector */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setGameMode("PVP");
                setSelectedSkill("NONE");
              }}
              disabled={isAnimating}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                gameMode === "PVP"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              👥 同機雙人
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode("PVE");
                setSelectedSkill("NONE");
              }}
              disabled={isAnimating}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                gameMode === "PVE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🤖 人機對戰
            </button>
            <button
              type="button"
              onClick={() => {
                setGameMode("AI_VS_AI");
                setSelectedSkill("NONE");
                setIsGodMode(true);
                setIsAiPlaying(true);
              }}
              disabled={isAnimating}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                gameMode === "AI_VS_AI"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚔️ 雙 AI 演示
            </button>
          </div>

          {/* AI vs AI Spectator Controls Toolbar */}
          {gameMode === "AI_VS_AI" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-950/50 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setIsAiPlaying(!isAiPlaying);
                }}
                disabled={gameState.isGameOver}
                className={`cursor-pointer rounded px-2.5 py-1 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  isAiPlaying
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "bg-emerald-600 text-white hover:bg-emerald-500"
                }`}
              >
                {isAiPlaying ? "⏸️ 暫停" : "▶️ 繼續"}
              </button>
              <button
                type="button"
                onClick={handleAiStep}
                disabled={isAnimating || gameState.isGameOver || isAiPlaying}
                title="單步執行 AI 決策"
                className="cursor-pointer rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⏭️ 單步
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiSpeed(aiSpeed === "NORMAL" ? "FAST" : "NORMAL");
                }}
                className="cursor-pointer rounded bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-purple-300 hover:bg-slate-700"
              >
                {aiSpeed === "NORMAL" ? "1x 正常" : "2x 快速"}
              </button>
            </div>
          )}

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
              if (gameMode !== "PVE") {
                setIsGodMode(!isGodMode);
              }
            }}
            disabled={isAnimating || gameMode === "PVE"}
            title={
              gameMode === "PVE" ? "人機對戰時強制維持玩家視角" : undefined
            }
            className={`cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              gameMode === "PVE"
                ? "border border-slate-700 bg-slate-800 text-slate-400"
                : isGodMode
                  ? "bg-purple-700 text-white hover:bg-purple-600"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {gameMode === "PVE"
              ? "戰爭迷霧（玩家視角）"
              : isGodMode
                ? "上帝視角（全揭示）"
                : "戰爭迷霧（玩家視角）"}
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
            {gameState.isGameOver ? (
              <div className="flex items-center gap-2 text-amber-300">
                <span className="text-base">🏆</span>
                <span className="font-bold tracking-wider">
                  對局結束：
                  {gameState.winnerTeamId === 1
                    ? "第一隊（黑方）獲勝！"
                    : gameState.winnerTeamId === 2
                      ? "第二隊（白方）獲勝！"
                      : "雙方勢均力敵・平手！"}
                </span>
                <span className="font-mono text-[11px] text-slate-300">
                  (黑 {team1Count.toString()} : 白 {team2Count.toString()})
                </span>
              </div>
            ) : isAnimating ? (
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
            ) : gameMode === "AI_VS_AI" ? (
              <div className="flex items-center gap-2 text-purple-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-purple-500" />
                </span>
                <span className="font-bold tracking-wider">
                  雙 AI 演示進行中：
                </span>
                <span className="text-slate-300">
                  {isAiPlaying
                    ? `${activePlayer?.name ?? "AI"}（${getTeamName(activePlayer?.teamId ?? 1)}）思考中...`
                    : "已暫停，點擊播放或單步執行推演"}
                </span>
              </div>
            ) : gameMode === "PVE" && gameState.activePlayerId === 2 ? (
              <div className="flex items-center gap-2 text-slate-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-300" />
                </span>
                <span className="font-bold tracking-wider">
                  AI 電腦思考中...
                </span>
                <span className="text-slate-400">
                  正在評估最佳落子戰略與連鎖效應
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
              {gameState.isGameOver ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGameOverModal(true);
                    }}
                    className="cursor-pointer rounded bg-blue-600 px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-xs hover:bg-blue-500"
                  >
                    📊 查看結算
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="cursor-pointer rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-200 hover:bg-slate-700"
                  >
                    🔄 重新開局
                  </button>
                </div>
              ) : isAnimating ? (
                <span className="rounded bg-purple-900/60 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-300 ring-1 ring-purple-500/40">
                  操作鎖定
                </span>
              ) : gameMode === "AI_VS_AI" ? (
                <span className="rounded border border-purple-500/40 bg-purple-950/60 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-300 ring-1 ring-purple-500/40">
                  {isAiPlaying ? "AI 自主演示" : "演示暫停"}
                </span>
              ) : gameMode === "PVE" && gameState.activePlayerId === 2 ? (
                <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-200 ring-1 ring-slate-500/40">
                  電腦回合
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
                  {(() => {
                    const dropZoneToShow =
                      gameMode === "PVE"
                        ? gameState.players.find((p) => p.teamId === 1)
                            ?.dropZone
                        : activePlayer?.dropZone;
                    return (
                      dropZoneToShow && (
                        <span className="hidden rounded bg-slate-800 px-2 py-0.5 text-slate-300 sm:inline">
                          中心 ({dropZoneToShow.center.x.toString()},{" "}
                          {dropZoneToShow.center.y.toString()}) 半徑=
                          {dropZoneToShow.radius.toString()}
                        </span>
                      )
                    );
                  })()}
                </div>
              ) : (
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                  地圖：{gameState.mapPreset}
                </span>
              )}
            </div>
          </div>

          <div
            className={`relative rounded-xl border border-emerald-900/60 bg-emerald-950/70 p-3 shadow-2xl transition-transform ${
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
              className="grid gap-0.5 rounded bg-emerald-950 p-0.5"
              style={{
                gridTemplateColumns: `repeat(${gameState.size.toString()}, minmax(0, 1fr))`,
              }}
              onMouseLeave={() => {
                setHoveredCoord(null);
              }}
            >
              {currentBoard.map((row, y) =>
                row.map((piece, x) => {
                  const key = `${x.toString()},${y.toString()}`;
                  const isStandardLegal = standardMoveSet.has(key);
                  const isPioneerLegal = pioneerMoveSet.has(key);
                  const isLegal = isStandardLegal || isPioneerLegal;
                  const effectiveDropZone =
                    gameMode === "PVE"
                      ? gameState.players.find((p) => p.teamId === 1)?.dropZone
                      : activePlayer?.dropZone;
                  const inDropZone =
                    gameState.isDropPhase &&
                    effectiveDropZone &&
                    isWithinDropZone({ x, y }, effectiveDropZone);
                  const isFlipping = flippingCoords.has(key);
                  const isPopping =
                    poppingCoord?.x === x && poppingCoord.y === y;

                  const isHovered =
                    hoveredCoord?.x === x && hoveredCoord.y === y;
                  const isPreviewPlacement =
                    !isAnimating &&
                    piece === null &&
                    isHovered &&
                    isStandardLegal;
                  const isPreviewFlipped =
                    !isAnimating && previewCapturedSet.has(key);

                  return (
                    <button
                      key={key}
                      type="button"
                      onMouseEnter={() => {
                        if (
                          !isAnimating &&
                          !isCurrentPlayerAi &&
                          isStandardLegal
                        ) {
                          setHoveredCoord({ x, y });
                        }
                      }}
                      onMouseLeave={() => {
                        if (hoveredCoord?.x === x && hoveredCoord.y === y) {
                          setHoveredCoord(null);
                        }
                      }}
                      onClick={() => {
                        setHoveredCoord(null);
                        handleCellClick({ x, y });
                      }}
                      disabled={
                        isAnimating ||
                        gameState.isGameOver ||
                        (gameMode === "PVE" &&
                          gameState.activePlayerId === 2) ||
                        (piece !== null && !isLegal)
                      }
                      className={`relative flex h-6 w-6 items-center justify-center rounded-xs transition-all sm:h-7 sm:w-7 md:h-8 md:w-8 ${
                        (x + y) % 2 === 0
                          ? "bg-emerald-900/90"
                          : "bg-emerald-800/80"
                      } ${
                        gameState.isDropPhase
                          ? inDropZone
                            ? (gameMode === "PVE"
                                ? 1
                                : (activePlayer?.teamId ?? 1)) === 1
                              ? "bg-emerald-800/90 ring-2 ring-zinc-300/80 ring-inset"
                              : "bg-emerald-800/90 ring-2 ring-white/90 ring-inset"
                            : "opacity-45"
                          : ""
                      } ${
                        isAnimating
                          ? "cursor-not-allowed"
                          : isLegal
                            ? activePlayer?.teamId === 1
                              ? "cursor-pointer hover:bg-emerald-700/90 hover:ring-1 hover:ring-zinc-300/80"
                              : "cursor-pointer hover:bg-emerald-700/90 hover:ring-1 hover:ring-white/90"
                            : "hover:bg-emerald-800/50"
                      }`}
                    >
                      {/* Legal Move Marker matching active team color (hidden during preview ghost piece) */}
                      {piece === null &&
                        !isAnimating &&
                        isStandardLegal &&
                        !isPreviewPlacement && (
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

                      {/* Hover Preview Ghost Piece */}
                      {isPreviewPlacement && (
                        <div
                          className={`relative flex h-5 w-5 items-center justify-center rounded-full border border-dashed shadow-xs transition-all sm:h-6 sm:w-6 md:h-7 md:w-7 ${
                            activePlayer?.teamId === 1
                              ? "border-zinc-400/80 bg-zinc-950/60 text-zinc-100 ring-2 ring-zinc-500/70"
                              : "border-zinc-200/80 bg-white/70 text-zinc-900 ring-2 ring-white/70"
                          }`}
                        >
                          <span className="text-[9px] font-black opacity-90 sm:text-[10px]">
                            +
                          </span>
                        </div>
                      )}

                      {/* Piece Representation (including Preview Flipped State) */}
                      {piece && (
                        <div
                          className={`relative flex h-5 w-5 items-center justify-center rounded-full border shadow-xs transition-transform sm:h-6 sm:w-6 md:h-7 md:w-7 ${
                            isPreviewFlipped
                              ? `${getTeamColorClass(
                                  activePlayer?.teamId ?? 1,
                                )} scale-95 shadow-md ring-2 ring-amber-300`
                              : getTeamColorClass(piece.teamId)
                          } ${
                            !piece.isRevealed &&
                            !isPreviewFlipped &&
                            piece.teamId === viewerTeamId
                              ? "border-dashed ring-1 ring-slate-400/50"
                              : ""
                          } ${
                            piece.skillType === "PURIFY" &&
                            piece.duration !== undefined
                              ? "shadow-xs ring-1 shadow-amber-500/30 ring-amber-400/80"
                              : ""
                          } ${isFlipping ? "animate-piece-flip" : ""} ${
                            isPopping ? "animate-piece-pop" : ""
                          }`}
                        >
                          {isPreviewFlipped ? null : piece.teamId === 0 ? (
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

                          {/* Revealed PURIFY Remaining Duration Marker */}
                          {!isPreviewFlipped &&
                            piece.skillType === "PURIFY" &&
                            piece.duration !== undefined && (
                              <span
                                title={`救贖之光：淨化光環生效中（剩餘 ${piece.duration.toString()} 回合）`}
                                className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300 bg-amber-400 text-[8px] font-black text-slate-950 shadow-md ring-1 ring-slate-950 sm:h-4 sm:w-4 sm:text-[9px]"
                              >
                                {piece.duration.toString()}
                              </span>
                            )}
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
                        ? "border-zinc-500 bg-zinc-950 shadow-xs ring-1 ring-zinc-700/60"
                        : "border-zinc-300 bg-white shadow-xs ring-1 ring-zinc-200/80"
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
                disabled={
                  isAnimating || gameState.isGameOver || isCurrentPlayerAi
                }
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

            {(() => {
              const dropZoneToShow =
                gameMode === "PVE"
                  ? gameState.players.find((p) => p.teamId === 1)?.dropZone
                  : activePlayer?.dropZone;
              return (
                dropZoneToShow &&
                gameState.isDropPhase && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>當前空降區：</span>
                    <span className="font-mono text-slate-300">
                      中心 ({dropZoneToShow.center.x.toString()},{" "}
                      {dropZoneToShow.center.y.toString()})，半徑=
                      {dropZoneToShow.radius.toString()}
                    </span>
                  </div>
                )
              );
            })()}

            <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                盤面棋數統計：
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-0.5 font-bold text-zinc-100">
                  {team1Count.toString()} 黑棋
                </span>
                <span className="text-slate-600">/</span>
                <span className="rounded-md border border-slate-300/80 bg-slate-100 px-2 py-0.5 font-bold text-slate-900">
                  {team2Count.toString()} 白棋
                </span>
                <span className="text-slate-600">/</span>
                <span className="rounded-md border border-amber-500/40 bg-slate-800 px-2 py-0.5 font-bold text-amber-300">
                  {neutralCount.toString()} 錨點
                </span>
              </div>
            </div>
          </div>

          {/* Team 1 Panel (Black) */}
          {(() => {
            const isActive = activePlayer?.teamId === 1;
            return (
              <div
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-all ${
                  isActive
                    ? "border-zinc-500/80 bg-slate-950 shadow-lg ring-1 shadow-zinc-950/50 ring-zinc-500/40"
                    : "border-slate-800/80 bg-slate-950/60 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-500 bg-zinc-950 shadow-xs ring-1 ring-zinc-700/60" />
                    <span className="text-xs font-bold text-slate-200">
                      第一隊（黑方）{isPlayer1Ai ? " (AI 電腦)" : ""}
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-zinc-500/40 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
                        {isPlayer1Ai ? "思考中" : "行動中"}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        等待中
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isPlayer1Ai && player1?.isForcedSpecial && (
                      <span className="animate-pulse rounded border border-amber-500/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300 ring-1 ring-amber-400/40">
                        ⚡ 強制特技
                      </span>
                    )}
                    <span className="rounded-md border border-purple-400/60 bg-purple-950/80 px-2.5 py-0.5 text-[11px] font-black text-purple-200 shadow-sm ring-1 ring-purple-500/40">
                      特技:{" "}
                      {isPlayer1Ai && !isGodMode
                        ? "迷霧隱藏"
                        : `${player1SpecialsCount.toString()} 枚`}
                    </span>
                    <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-black text-zinc-200 shadow-xs">
                      盤面: {team1Count.toString()} 顆
                    </span>
                  </div>
                </div>

                {isPlayer1Ai && !isGodMode ? (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🤖</span>
                        <span className="font-bold text-slate-200">
                          AI 電腦決策核心（黑方）
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "animate-pulse border border-zinc-500/50 bg-zinc-800/60 text-zinc-200"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isActive ? "即時運算中" : "待命狀態"}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-400">
                      演示模式：黑方戰略佈局與特技手牌受戰爭迷霧保護（切換為上帝視角可查看完整手牌）。
                    </p>

                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-400">
                      <span>戰術策略：全域啟發式權重評估</span>
                      <span className="font-mono font-bold text-zinc-300">
                        MEDIUM
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {player1?.isForcedSpecial && isActive && (
                      <div className="flex items-center justify-between rounded-md border border-amber-500/60 bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200 shadow-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>⚡</span>
                          <span className="text-amber-300">強制特技</span>
                        </div>
                        <span className="text-[11px] text-amber-200/80">
                          {isPlayer1Ai
                            ? `AI 已選【${SKILL_CONFIG[effectiveSkill].label.split(" ")[0]}】`
                            : "庫存已滿・限落特殊棋"}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {SKILL_OPTIONS.map((opt, optIdx) => {
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
                          isAnimating ||
                          !isActive ||
                          isOutOfStock ||
                          isForbidden ||
                          isPlayer1Ai;
                        const isSelected =
                          isActive && effectiveSkill === opt.type;
                        const config = SKILL_CONFIG[opt.type];

                        return (
                          <div
                            key={opt.type}
                            className="group relative flex flex-col focus-within:z-30 hover:z-30"
                          >
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (isActive && !isDisabled) {
                                  setSelectedSkill(opt.type);
                                }
                              }}
                              aria-label={`${config.label}，庫存 ${count.toString()} 枚`}
                              className={`flex h-full w-full flex-col justify-between rounded-lg border p-2 text-left transition-all ${
                                isSelected
                                  ? "border-zinc-300 bg-zinc-900 text-white shadow-lg ring-2 shadow-zinc-950/50 ring-zinc-400/80"
                                  : isDisabled
                                    ? "cursor-not-allowed border-slate-800/60 bg-slate-900/20 text-slate-500 opacity-45"
                                    : count > 0 && !isNone
                                      ? count >= maxHand
                                        ? "hover:bg-slate-850 cursor-pointer border-amber-500/50 bg-slate-900/90 text-slate-100 shadow-xs hover:border-amber-400"
                                        : "hover:bg-slate-850 cursor-pointer border-zinc-600/60 bg-slate-900/90 text-slate-100 shadow-xs hover:border-zinc-400"
                                      : `${config.buttonStyle} cursor-pointer opacity-85 hover:opacity-100`
                              }`}
                            >
                              {/* Piece Name & Stock */}
                              <div className="flex w-full items-center justify-between gap-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-600 bg-zinc-950 text-zinc-100 shadow-xs ring-1 ring-zinc-700/60">
                                    {config.code ? (
                                      <span
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-black ${config.annotationStyle}`}
                                      >
                                        {config.code}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="truncate text-xs leading-tight font-bold">
                                    {opt.label.split(" ")[0]}
                                  </span>
                                </div>

                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    isNone
                                      ? "border border-slate-700 bg-slate-800 text-slate-300"
                                      : count >= maxHand
                                        ? "border border-amber-400/80 bg-amber-500/20 text-amber-300"
                                        : count > 0
                                          ? "border border-emerald-400/80 bg-emerald-500/20 text-emerald-300"
                                          : "border border-slate-800 bg-slate-900/80 text-slate-500"
                                  }`}
                                >
                                  {isNone
                                    ? "∞"
                                    : `${count.toString()}/${maxHand.toString()}`}
                                </span>
                              </div>

                              {/* Status / Cooldown */}
                              <div className="mt-1.5 w-full border-t border-slate-800/80 pt-1">
                                {isForbidden ? (
                                  <span className="text-[10px] font-medium text-rose-400">
                                    🚫 禁落常規棋
                                  </span>
                                ) : isNone ? (
                                  <span className="text-[10px] text-slate-400">
                                    無限庫存
                                  </span>
                                ) : count >= maxHand ? (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-amber-300">
                                      就緒 MAX
                                    </span>
                                    <span className="font-mono text-[9px] text-amber-400/90">
                                      可部署
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span
                                        className={
                                          count === 0
                                            ? "text-amber-400/90"
                                            : "text-slate-400"
                                        }
                                      >
                                        {count === 0 ? "充能中" : "充能"}
                                      </span>
                                      <span className="font-mono font-bold text-slate-300">
                                        {charge.toString()}/{cd.toString()}
                                      </span>
                                    </div>
                                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                                      <div
                                        className={`h-full transition-all duration-300 ${
                                          count === 0
                                            ? charge >= cd - 1
                                              ? "bg-amber-400"
                                              : "bg-amber-600/80"
                                            : charge >= cd - 1
                                              ? "bg-zinc-300"
                                              : "bg-zinc-500"
                                        }`}
                                        style={{
                                          width: `${Math.min(100, Math.round((charge / cd) * 100)).toString()}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>

                            {/* Hover Skill Explanation Card */}
                            <SkillDetailTooltip
                              skillType={opt.type}
                              index={optIdx}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Team 2 Panel (White) */}
          {(() => {
            const isActive = activePlayer?.teamId === 2;
            return (
              <div
                className={`flex flex-col gap-3 rounded-lg border p-4 transition-all ${
                  isActive
                    ? "border-slate-300/80 bg-slate-950 shadow-lg ring-1 shadow-slate-200/20 ring-slate-300/40"
                    : "border-slate-800/80 bg-slate-950/60 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300 bg-white shadow-xs ring-1 ring-slate-200/80" />
                    <span className="text-xs font-bold text-slate-200">
                      第二隊（白方）{isPlayer2Ai ? " (AI 電腦)" : ""}
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-slate-300/40 bg-slate-100/20 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                        {isPlayer2Ai ? "思考中" : "行動中"}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        等待中
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isPlayer2Ai && player2?.isForcedSpecial && (
                      <span className="animate-pulse rounded border border-amber-500/60 bg-amber-500/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-amber-300 ring-1 ring-amber-400/40">
                        ⚡ 強制特技
                      </span>
                    )}
                    <span className="rounded-md border border-purple-400/60 bg-purple-950/80 px-2.5 py-0.5 text-[11px] font-black text-purple-200 shadow-sm ring-1 ring-purple-500/40">
                      特技:{" "}
                      {isPlayer2Ai && !isGodMode
                        ? "迷霧隱藏"
                        : `${player2SpecialsCount.toString()} 枚`}
                    </span>
                    <span className="rounded-md border border-slate-300/40 bg-slate-800/80 px-2 py-0.5 text-[11px] font-black text-slate-200 shadow-xs">
                      盤面: {team2Count.toString()} 顆
                    </span>
                  </div>
                </div>

                {isPlayer2Ai && !isGodMode ? (
                  <div className="flex flex-col gap-2.5 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🤖</span>
                        <span className="font-bold text-slate-200">
                          AI 電腦決策核心（白方）
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "animate-pulse border border-slate-400/50 bg-slate-700/60 text-slate-200"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isActive ? "即時運算中" : "待命狀態"}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {gameMode === "PVE"
                        ? "單人對戰模式：電腦戰略佈局與特技手牌均受戰爭迷霧嚴格保護，不公開顯示。"
                        : "演示模式：白方戰略佈局與特技手牌受戰爭迷霧保護（切換為上帝視角可查看完整手牌）。"}
                    </p>

                    <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-400">
                      <span>戰術策略：全域啟發式權重評估</span>
                      <span className="font-mono font-bold text-slate-300">
                        MEDIUM
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {player2?.isForcedSpecial && isActive && (
                      <div className="flex items-center justify-between rounded-md border border-amber-500/60 bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200 shadow-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span>⚡</span>
                          <span className="text-amber-300">強制特技</span>
                        </div>
                        <span className="text-[11px] text-amber-200/80">
                          {isPlayer2Ai
                            ? `AI 已選【${SKILL_CONFIG[effectiveSkill].label.split(" ")[0]}】`
                            : "庫存已滿・限落特殊棋"}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {SKILL_OPTIONS.map((opt, optIdx) => {
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
                          isAnimating ||
                          !isActive ||
                          isOutOfStock ||
                          isForbidden ||
                          isPlayer2Ai;
                        const isSelected =
                          isActive && effectiveSkill === opt.type;
                        const config = SKILL_CONFIG[opt.type];

                        return (
                          <div
                            key={opt.type}
                            className="group relative flex flex-col focus-within:z-30 hover:z-30"
                          >
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (isActive && !isDisabled) {
                                  setSelectedSkill(opt.type);
                                }
                              }}
                              aria-label={`${config.label}，庫存 ${count.toString()} 枚`}
                              className={`flex h-full w-full flex-col justify-between rounded-lg border p-2 text-left transition-all ${
                                isSelected
                                  ? "border-slate-200 bg-slate-800 text-white shadow-lg ring-2 shadow-slate-200/20 ring-slate-300/80"
                                  : isDisabled
                                    ? "cursor-not-allowed border-slate-800/60 bg-slate-900/20 text-slate-500 opacity-45"
                                    : count > 0 && !isNone
                                      ? count >= maxHand
                                        ? "hover:bg-slate-850 cursor-pointer border-amber-500/50 bg-slate-900/90 text-slate-100 shadow-xs hover:border-amber-400"
                                        : "hover:bg-slate-850 cursor-pointer border-slate-400/40 bg-slate-900/90 text-slate-100 shadow-xs hover:border-slate-300"
                                      : `${config.buttonStyle} cursor-pointer opacity-85 hover:opacity-100`
                              }`}
                            >
                              {/* Piece Name & Stock */}
                              <div className="flex w-full items-center justify-between gap-1">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/80">
                                    {config.code ? (
                                      <span
                                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black ${config.annotationStyle}`}
                                      >
                                        {config.code}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="truncate text-xs leading-tight font-bold">
                                    {opt.label.split(" ")[0]}
                                  </span>
                                </div>

                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    isNone
                                      ? "border border-slate-700 bg-slate-800 text-slate-300"
                                      : count >= maxHand
                                        ? "border border-amber-400/80 bg-amber-500/20 text-amber-300"
                                        : count > 0
                                          ? "border border-emerald-400/80 bg-emerald-500/20 text-emerald-300"
                                          : "border border-slate-800 bg-slate-900/80 text-slate-500"
                                  }`}
                                >
                                  {isNone
                                    ? "∞"
                                    : `${count.toString()}/${maxHand.toString()}`}
                                </span>
                              </div>

                              {/* Status / Cooldown */}
                              <div className="mt-1.5 w-full border-t border-slate-800/80 pt-1">
                                {isForbidden ? (
                                  <span className="text-[10px] font-medium text-rose-400">
                                    🚫 禁落常規棋
                                  </span>
                                ) : isNone ? (
                                  <span className="text-[10px] text-slate-400">
                                    無限庫存
                                  </span>
                                ) : count >= maxHand ? (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-amber-300">
                                      就緒 MAX
                                    </span>
                                    <span className="font-mono text-[9px] text-amber-400/90">
                                      可部署
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span
                                        className={
                                          count === 0
                                            ? "text-amber-400/90"
                                            : "text-slate-400"
                                        }
                                      >
                                        {count === 0 ? "充能中" : "充能"}
                                      </span>
                                      <span className="font-mono font-bold text-slate-200">
                                        {charge.toString()}/{cd.toString()}
                                      </span>
                                    </div>
                                    <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                                      <div
                                        className={`h-full transition-all duration-300 ${
                                          count === 0
                                            ? charge >= cd - 1
                                              ? "bg-amber-400"
                                              : "bg-amber-600/80"
                                            : charge >= cd - 1
                                              ? "bg-slate-200"
                                              : "bg-slate-400"
                                        }`}
                                        style={{
                                          width: `${Math.min(100, Math.round((charge / cd) * 100)).toString()}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </button>

                            {/* Hover Skill Explanation Card */}
                            <SkillDetailTooltip
                              skillType={opt.type}
                              index={optIdx}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
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

import type { MapPreset, MaskedPiece, Piece, SkillType } from "../engine/index.ts";

export type GameMode = "PVP" | "PVE" | "AI_VS_AI";

export function getTeamColorClass(teamId: number): string {
  if (teamId === 0) {
    return "border-amber-400/90 bg-slate-800 text-amber-300 ring-1 ring-amber-500/50 shadow-md";
  }
  if (teamId === 1) {
    return "border-zinc-400/90 bg-linear-to-br from-zinc-800 via-zinc-900 to-black text-zinc-100 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45),0_3px_6px_rgba(0,0,0,0.9)] ring-1 ring-zinc-300/60";
  }
  return "border-zinc-300 bg-linear-to-br from-white via-zinc-100 to-zinc-200 text-zinc-900 shadow-[inset_0_1px_2px_rgba(255,255,255,1),0_3px_6px_rgba(0,0,0,0.35)] ring-1 ring-zinc-300/80";
}

export function getTeamName(teamId: number): string {
  if (teamId === 0) {
    return "中立錨點";
  }
  if (teamId === 1) {
    return "第一隊（黑方）";
  }
  return "第二隊（白方）";
}

export function getLegalMarkerClass(teamId: number, isPioneer: boolean): string {
  if (isPioneer) {
    return teamId === 1
      ? "h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-950 ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
      : "h-2.5 w-2.5 animate-pulse rounded-full bg-white ring-2 ring-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]";
  }
  return teamId === 1
    ? "h-2.5 w-2.5 animate-pulse rounded-full bg-zinc-950 ring-2 ring-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
    : "h-2.5 w-2.5 animate-pulse rounded-full bg-white ring-2 ring-zinc-300 shadow-[0_0_8px_rgba(255,255,255,0.9)]";
}

export const MAP_PRESETS: { preset: MapPreset; label: string; desc: string }[] = [
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

export interface SkillVisualConfig {
  label: string;
  annotationStyle: string;
  buttonStyle: string;
  code: string;
}

export const SKILL_CONFIG: Record<SkillType, SkillVisualConfig> = {
  NONE: {
    label: "常規棋",
    annotationStyle: "",
    buttonStyle: "bg-slate-800 text-slate-200 border-slate-700",
    code: "",
  },
  WALL: {
    label: "翡翠城壁 (綠)",
    annotationStyle:
      "bg-emerald-950/90 text-emerald-300 border border-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.7)]",
    buttonStyle: "bg-emerald-950/60 text-emerald-200 border-emerald-800/80",
    code: "壁",
  },
  PIERCE: {
    label: "天空守望者 (藍)",
    annotationStyle:
      "bg-sky-950/90 text-cyan-300 border border-cyan-400/80 shadow-[0_0_6px_rgba(56,189,248,0.7)]",
    buttonStyle: "bg-sky-950/60 text-sky-200 border-sky-800/80",
    code: "守",
  },
  BOMB: {
    label: "殺戮盛宴 (紅)",
    annotationStyle:
      "bg-rose-950/90 text-rose-200 border border-rose-400/80 shadow-[0_0_6px_rgba(244,63,94,0.7)]",
    buttonStyle: "bg-rose-950/60 text-rose-200 border-rose-800/80",
    code: "宴",
  },
  PURIFY: {
    label: "救贖之光 (黃)",
    annotationStyle:
      "bg-amber-950/90 text-amber-200 border border-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,0.7)]",
    buttonStyle: "bg-amber-950/60 text-amber-200 border-amber-800/80",
    code: "光",
  },
  COUNTER: {
    label: "深淵復仇者 (黑)",
    annotationStyle:
      "bg-slate-950/95 text-purple-300 border border-purple-400/80 shadow-[0_0_6px_rgba(168,85,247,0.7)]",
    buttonStyle: "bg-slate-950/90 text-purple-200 border-purple-900/80 hover:border-purple-600/80",
    code: "仇",
  },
};

export function getSpecialPieceGlowClass(piece: Piece | MaskedPiece): string {
  if (!piece.isRevealed || piece.skillType === "NONE") return "";
  switch (piece.skillType) {
    case "WALL":
      return "ring-1 ring-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.6)]";
    case "PIERCE":
      return "ring-1 ring-cyan-400/90 shadow-[0_0_8px_rgba(56,189,248,0.6)]";
    case "BOMB":
      return "ring-1 ring-rose-500/90 shadow-[0_0_8px_rgba(244,63,94,0.65)]";
    case "PURIFY":
      return "ring-1 ring-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.7)]";
    case "COUNTER":
      return "ring-1 ring-purple-500/90 shadow-[0_0_8px_rgba(168,85,247,0.7)]";
    default:
      return "";
  }
}

export const SKILL_OPTIONS: { type: SkillType; label: string }[] = [
  { type: "NONE", label: "常規棋" },
  { type: "WALL", label: "翡翠城壁 (綠)" },
  { type: "PIERCE", label: "天空守望者 (藍)" },
  { type: "BOMB", label: "殺戮盛宴 (紅)" },
  { type: "PURIFY", label: "救贖之光 (黃)" },
  { type: "COUNTER", label: "深淵復仇者 (黑)" },
];

export interface SkillInfoDetail {
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

export const SKILL_DETAILS: Record<SkillType, SkillInfoDetail> = {
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
    tactics: "破防王牌！專門克制敵方城壁鐵桶陣與復仇陷阱，適合用來搶佔角落或強行突破敵方封鎖線。",
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
    tactics: "和平解除敵方致命地雷陣與反擊陷阱的戰略神器，能毫無風險地奪取特技據點並消除威脅。",
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
    tactics: "最高威懾力的致命陷阱！故意露出破撻誘使敵方大面積夾擊，達成一擊必殺的反客為主逆轉。",
  },
};

export function formatErrorMessage(msg: string): string {
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

export const EVENT_TYPE_LABELS: Record<string, string> = {
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

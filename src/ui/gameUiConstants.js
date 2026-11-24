export function getTeamName(teamId) {
  if (teamId === 0) {
    return "中立錨點";
  }
  if (teamId === 1) {
    return "第一隊（黑方）";
  }
  return "第二隊（白方）";
}

export const MAP_PRESETS = Object.freeze([
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
]);

export const SKILL_CONFIG = Object.freeze({
  NONE: { label: "常規棋", code: "" },
  WALL: { label: "翡翠城壁 (綠)", code: "壁" },
  PIERCE: { label: "天空守望者 (藍)", code: "守" },
  BOMB: { label: "殺戮盛宴 (紅)", code: "宴" },
  PURIFY: { label: "救贖之光 (黃)", code: "光" },
  COUNTER: { label: "深淵復仇者 (黑)", code: "仇" },
});

export const SKILL_OPTIONS = Object.freeze([
  { type: "NONE", label: "常規棋" },
  { type: "WALL", label: "翡翠城壁 (綠)" },
  { type: "PIERCE", label: "天空守望者 (藍)" },
  { type: "BOMB", label: "殺戮盛宴 (紅)" },
  { type: "PURIFY", label: "救贖之光 (黃)" },
  { type: "COUNTER", label: "深淵復仇者 (黑)" },
]);

export const SKILL_DETAILS = Object.freeze({
  NONE: {
    name: "常規棋",
    role: "經典黑白棋",
    badge: "基礎骨幹",
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
    cdText: "7 回合",
    maxHandText: "1 枚",
    trigger: "被敵方翻轉時",
    effect:
      "以未揭示狀態潛伏於盤面。當被敵方棋子（天空守望者除外）翻轉時，瞬間逆轉整條吃子射線，將敵方落下的棋子及沿途所有翻轉棋子強行反噬奪為己方棋子！",
    tactics:
      "最高威懾力的致命陷阱！故意露出破綻誘使敵方大面積夾擊，達成一擊必殺的反客為主逆轉。",
  },
});

/**
 * Pure semantic visual state resolver for board pieces, mapped to CSS data-* attributes.
 */
export function getPieceVisualState(piece, options) {
  const displayTeamId = options.isPreviewFlipped
    ? options.activePlayerTeamId
    : piece.teamId;
  const isOwnHidden =
    !options.isPreviewFlipped &&
    !piece.isRevealed &&
    piece.teamId === options.viewerTeamId;

  if (options.isPreviewFlipped) {
    return {
      displayTeamId,
      rimState: "preview-flip",
      isOwnHidden: false,
      glowSkill: "",
    };
  }
  if (piece.skillType === "PURIFY" && piece.duration !== undefined) {
    return {
      displayTeamId,
      rimState: "purify-active",
      isOwnHidden,
      glowSkill: "",
    };
  }
  if (piece.isRevealed && piece.skillType !== "NONE") {
    return {
      displayTeamId,
      rimState: "glow",
      isOwnHidden: false,
      glowSkill: piece.skillType,
    };
  }
  return {
    displayTeamId,
    rimState: "default",
    isOwnHidden,
    glowSkill: "",
  };
}

export function formatErrorMessage(msg) {
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

export const EVENT_TYPE_LABELS = Object.freeze({
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
});

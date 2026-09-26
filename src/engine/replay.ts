import { createInitialGame, dispatch } from "./pipeline.ts";
import { sanitizeForViewer } from "./sanitize.ts";
import {
  type Action,
  type Coord,
  type GameEvent,
  type GameState,
  type MapPreset,
  type MaskedGameState,
  type SkillType,
} from "./types.ts";

/**
 * Metadata for a recorded HBC match.
 */
interface MatchMetadata {
  id: string;
  date: string;
  mapPreset: MapPreset;
  boardSize: number;
  players: { id: number; teamId: number; name: string }[];
  winnerTeamId: number | null;
  totalTurns: number;
  isGameOver: boolean;
}

/**
 * A single step record in the match history.
 */
export interface MatchStepRecord {
  stepIndex: number;
  turnNumber: number;
  playerId: number;
  action: Action;
  events: GameEvent[];
  notation: string;
  stateSnapshot: GameState;
}

/**
 * Complete serializable match history container.
 */
export interface MatchHistory {
  metadata: MatchMetadata;
  initialState: GameState;
  steps: MatchStepRecord[];
}

/**
 * Replay Session interface for stepping through a recorded match.
 */
export interface ReplaySession {
  getHistory(): MatchHistory;
  getCurrentIndex(): number;
  getTotalSteps(): number;
  getCurrentStep(): MatchStepRecord | null;
  getCurrentState(): GameState;
  getCurrentMaskedState(
    viewerPlayerId?: number | null,
  ): MaskedGameState | GameState;
  canStepForward(): boolean;
  canStepBackward(): boolean;
  stepForward(): { state: GameState; step: MatchStepRecord } | null;
  stepBackward(): { state: GameState; step: MatchStepRecord | null } | null;
  jumpToStep(index: number): { state: GameState; step: MatchStepRecord | null };
  jumpToStart(): GameState;
  jumpToEnd(): GameState;
}

/**
 * Live tracker for building match history as actions are dispatched.
 */
export interface MatchTracker {
  recordStep(
    action: Action,
    nextState: GameState,
    events: GameEvent[],
  ): MatchStepRecord;
  getHistory(): MatchHistory;
  reset(initialState: GameState, matchId?: string): void;
}

/**
 * Converts a 0-indexed coordinate into an algebraic string (e.g. {x: 0, y: 0} -> "A1", {x: 7, y: 7} -> "H8").
 * Board columns are mapped A-P for 16x16, rows are 1-indexed (1-16).
 */
export function coordToAlgebraic(coord: Coord): string {
  const colChar = String.fromCharCode(65 + coord.x);
  const rowNum = coord.y + 1;
  return `${colChar}${rowNum.toString()}`;
}

/**
 * Parses an algebraic coordinate string (e.g. "H8", "a1", "P16") into a 0-indexed Coord.
 */
export function algebraicToCoord(algebraic: string): Coord {
  const trimmed = algebraic.trim().toUpperCase();
  const match = /^([A-P])([1-9]|1[0-6])$/.exec(trimmed);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid algebraic coordinate: "${algebraic}"`);
  }
  const col = match[1].charCodeAt(0) - 65;
  const row = parseInt(match[2], 10) - 1;
  return { x: col, y: row };
}

/**
 * Formats a game action and resulting events into an HBC-PGN notation string.
 * Example: "1. P1:H8[NONE] {flips:2}" or "2. P2:PASS"
 */
export function formatActionNotation(
  action: Action,
  events: GameEvent[],
  moveNumber?: number,
): string {
  const prefix = moveNumber != null ? `${moveNumber.toString()}. ` : "";

  if (action.type === "PASS_TURN") {
    return `${prefix}P${action.playerId.toString()}:PASS`;
  }

  const coordStr = coordToAlgebraic(action.coord);
  const skill = action.skillType ?? "NONE";
  const baseNotation = `${prefix}P${action.playerId.toString()}:${coordStr}[${skill}]`;

  // Aggregate event summary annotations
  const annotations: string[] = [];
  let totalFlips = 0;
  let wallBlocks = 0;
  let penetrations = 0;
  let bombDetonations = 0;
  let bombAffected = 0;
  let counterTriggers = 0;
  let counterReversed = 0;
  let purifyPulses = 0;
  let purifyAffected = 0;
  let isPioneer = false;

  for (const ev of events) {
    switch (ev.type) {
      case "FLIP_BATCH":
        totalFlips += ev.coords.length;
        break;
      case "RAYCAST_BLOCKED":
        wallBlocks += 1;
        break;
      case "PIECE_REVEALED":
        if (ev.reason === "PENETRATE") penetrations += 1;
        break;
      case "BOMB_TRIGGERED":
        bombDetonations += 1;
        bombAffected += ev.blastCoords.length;
        break;
      case "COUNTER_TRIGGERED":
        counterTriggers += 1;
        counterReversed += ev.reversedCoords.length;
        break;
      case "PURIFY_PULSE":
        purifyPulses += 1;
        purifyAffected += ev.affectedCoords.length;
        break;
      case "PIONEER_PLACED":
        isPioneer = true;
        break;
    }
  }

  if (isPioneer) annotations.push("pioneer:1");
  if (totalFlips > 0) annotations.push(`flips:${totalFlips.toString()}`);
  if (wallBlocks > 0) annotations.push(`block:${wallBlocks.toString()}`);
  if (penetrations > 0)
    annotations.push(`penetrate:${penetrations.toString()}`);
  if (bombDetonations > 0) {
    annotations.push(
      `bomb:${bombDetonations.toString()}(${bombAffected.toString()})`,
    );
  }
  if (counterTriggers > 0) {
    annotations.push(
      `counter:${counterTriggers.toString()}(${counterReversed.toString()})`,
    );
  }
  if (purifyPulses > 0) {
    annotations.push(
      `purify:${purifyPulses.toString()}(${purifyAffected.toString()})`,
    );
  }

  if (annotations.length > 0) {
    return `${baseNotation} {${annotations.join(",")}}`;
  }
  return baseNotation;
}

const INFINITY_TOKEN = "__HBC_INFINITY__";

function jsonInfinityReplacer(_key: string, value: unknown): unknown {
  if (value === Infinity) {
    return INFINITY_TOKEN;
  }
  return value;
}

function jsonInfinityReviver(key: string, value: unknown): unknown {
  if (value === INFINITY_TOKEN) {
    return Infinity;
  }
  if (key === "NONE" && value === null) {
    return Infinity;
  }
  return value;
}

/**
 * Deep clones a GameState object while correctly preserving `Infinity` hand values.
 */
function cloneGameState(state: GameState): GameState {
  const json = JSON.stringify(state, jsonInfinityReplacer);
  return JSON.parse(json, jsonInfinityReviver) as GameState;
}

/**
 * Serializes match history to a structured JSON string with full state snapshots.
 */
export function serializeMatchHistoryToJson(history: MatchHistory): string {
  return JSON.stringify(history, jsonInfinityReplacer, 2);
}

/**
 * Deserializes a JSON string back into a full MatchHistory object.
 */
export function deserializeMatchHistoryFromJson(jsonStr: string): MatchHistory {
  const parsed = JSON.parse(jsonStr, jsonInfinityReviver) as unknown;
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("metadata" in parsed) ||
    !("initialState" in parsed) ||
    !("steps" in parsed) ||
    !Array.isArray((parsed as { steps: unknown }).steps)
  ) {
    throw new Error("Invalid HBC match history JSON: missing required fields");
  }
  return parsed as MatchHistory;
}

/**
 * Formats match result for standard PGN headers.
 */
function formatResult(metadata: MatchMetadata): string {
  if (!metadata.isGameOver) {
    return "*";
  }
  if (metadata.winnerTeamId === 1) {
    return "1-0";
  }
  if (metadata.winnerTeamId === 2) {
    return "0-1";
  }
  return "1/2-1/2";
}

/**
 * Serializes match history into standard HBC-PGN format.
 */
export function serializeToHbcPgn(history: MatchHistory): string {
  const meta = history.metadata;
  const p1Name = meta.players.find((p) => p.teamId === 1)?.name ?? "Black";
  const p2Name = meta.players.find((p) => p.teamId === 2)?.name ?? "White";

  const headers = [
    `[Event "HBC Strategic Match"]`,
    `[Site "HBC Headless Engine"]`,
    `[Date "${meta.date.split("T")[0] ?? meta.date}"]`,
    `[Round "1"]`,
    `[MapPreset "${meta.mapPreset}"]`,
    `[BoardSize "${meta.boardSize.toString()}"]`,
    `[Team1 "${p1Name}"]`,
    `[Team2 "${p2Name}"]`,
    `[Result "${formatResult(meta)}"]`,
    `[TotalTurns "${meta.totalTurns.toString()}"]`,
  ];

  const moveTexts = history.steps.map((step) => step.notation);

  return `${headers.join("\n")}\n\n${moveTexts.join(" ")}\n`;
}

/**
 * Parsed representation of an HBC-PGN string.
 */
export interface ParsedHbcPgn {
  headers: Record<string, string>;
  mapPreset: MapPreset;
  boardSize: number;
  actions: Action[];
}

/**
 * Parses an HBC-PGN string into tag headers and an ordered list of actions.
 */
export function parseHbcPgn(pgnString: string): ParsedHbcPgn {
  const headers: Record<string, string> = {};
  const lines = pgnString.split(/\r?\n/);
  const bodyLines: string[] = [];
  let inHeaders = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (inHeaders) {
      if (trimmed.startsWith("[")) {
        const headerMatch = /^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]\s*$/.exec(
          trimmed,
        );
        if (headerMatch?.[1] && headerMatch[2] !== undefined) {
          headers[headerMatch[1]] = headerMatch[2];
        }
      } else if (trimmed === "") {
        inHeaders = false;
      } else {
        inHeaders = false;
        bodyLines.push(line);
      }
    } else {
      bodyLines.push(line);
    }
  }

  const moveBody = bodyLines.join("\n");

  const mapPresetRaw = headers.MapPreset;
  let mapPreset: MapPreset = "CROSSROADS";
  if (
    mapPresetRaw === "CROSSROADS" ||
    mapPresetRaw === "ARCHIPELAGO" ||
    mapPresetRaw === "TRENCHES"
  ) {
    mapPreset = mapPresetRaw;
  }

  const boardSizeRaw = headers.BoardSize;
  const boardSize = boardSizeRaw ? parseInt(boardSizeRaw, 10) : 16;

  // Regex to match:
  // e.g. "1. P1:H8[NONE] {flips:2}" or "P1:H8[WALL]" or "P2:PASS"
  const tokenRegex =
    /(?:(\d+)\.\s*)?P(\d+):([A-Za-z](?:1[0-6]|[1-9])|PASS)(?:\[([A-Z]+)\])?(?:\s*\{[^}]*\})?/gi;

  const actions: Action[] = [];
  let tokenMatch: RegExpExecArray | null;

  while ((tokenMatch = tokenRegex.exec(moveBody)) !== null) {
    const playerId = parseInt(tokenMatch[2] ?? "1", 10);
    const target = tokenMatch[3]?.toUpperCase();
    const skillRaw = tokenMatch[4]?.toUpperCase() as SkillType | undefined;

    if (target === "PASS") {
      actions.push({
        type: "PASS_TURN",
        playerId,
      });
    } else if (target) {
      const coord = algebraicToCoord(target);
      const skillType: SkillType =
        skillRaw === "WALL" ||
        skillRaw === "PIERCE" ||
        skillRaw === "BOMB" ||
        skillRaw === "PURIFY" ||
        skillRaw === "COUNTER"
          ? skillRaw
          : "NONE";

      actions.push({
        type: "PLACE_PIECE",
        playerId,
        coord,
        skillType,
      });
    }
  }

  return {
    headers,
    mapPreset,
    boardSize,
    actions,
  };
}

/**
 * Deterministically replays a sequence of actions from the initial game state,
 * constructing a complete MatchHistory with state snapshots and generated events.
 */
export function replayMatchActions(
  mapPreset: MapPreset,
  boardSize: number,
  actions: Action[],
): { history: MatchHistory; finalState: GameState } {
  const initial = createInitialGame({ mapPreset, boardSize });
  let currentState = initial.state;

  const metadata: MatchMetadata = {
    id: `replay-${Date.now().toString()}`,
    date: new Date().toISOString(),
    mapPreset,
    boardSize,
    players: initial.state.players.map((p) => ({
      id: p.id,
      teamId: p.teamId,
      name: p.name,
    })),
    winnerTeamId: null,
    totalTurns: 0,
    isGameOver: false,
  };

  const steps: MatchStepRecord[] = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    if (!action) continue;

    const { nextState, events } = dispatch(currentState, action);
    const stepNotation = formatActionNotation(action, events, i + 1);

    steps.push({
      stepIndex: i,
      turnNumber: nextState.currentTurn,
      playerId: action.playerId,
      action,
      events,
      notation: stepNotation,
      stateSnapshot: cloneGameState(nextState),
    });

    currentState = nextState;
  }

  metadata.totalTurns = steps.length;
  metadata.isGameOver = currentState.isGameOver;
  metadata.winnerTeamId = currentState.winnerTeamId;

  const history: MatchHistory = {
    metadata,
    initialState: cloneGameState(initial.state),
    steps,
  };

  return { history, finalState: currentState };
}

/**
 * Creates a ReplaySession controller for stepping through recorded matches.
 */
export function createReplaySession(
  history: MatchHistory,
  initialIndex?: number,
): ReplaySession {
  const totalSteps = history.steps.length;
  let currentIndex =
    initialIndex !== undefined
      ? Math.max(-1, Math.min(totalSteps - 1, initialIndex))
      : totalSteps - 1;

  return {
    getHistory(): MatchHistory {
      return history;
    },

    getCurrentIndex(): number {
      return currentIndex;
    },

    getTotalSteps(): number {
      return totalSteps;
    },

    getCurrentStep(): MatchStepRecord | null {
      if (currentIndex < 0 || currentIndex >= totalSteps) {
        return null;
      }
      return history.steps[currentIndex] ?? null;
    },

    getCurrentState(): GameState {
      if (currentIndex < 0 || totalSteps === 0) {
        return history.initialState;
      }
      const step = history.steps[currentIndex];
      return step ? step.stateSnapshot : history.initialState;
    },

    getCurrentMaskedState(
      viewerPlayerId?: number | null,
    ): MaskedGameState | GameState {
      const state = this.getCurrentState();
      if (viewerPlayerId == null) {
        return state;
      }
      return sanitizeForViewer(state, viewerPlayerId);
    },

    canStepForward(): boolean {
      return currentIndex < totalSteps - 1;
    },

    canStepBackward(): boolean {
      return currentIndex > -1;
    },

    stepForward(): { state: GameState; step: MatchStepRecord } | null {
      if (currentIndex >= totalSteps - 1) {
        return null;
      }
      currentIndex += 1;
      const step = history.steps[currentIndex];
      if (!step) return null;
      return { state: step.stateSnapshot, step };
    },

    stepBackward(): { state: GameState; step: MatchStepRecord | null } | null {
      if (currentIndex <= -1) {
        return null;
      }
      currentIndex -= 1;
      if (currentIndex === -1) {
        return { state: history.initialState, step: null };
      }
      const step = history.steps[currentIndex];
      if (!step) return null;
      return { state: step.stateSnapshot, step };
    },

    jumpToStep(index: number): {
      state: GameState;
      step: MatchStepRecord | null;
    } {
      currentIndex = Math.max(-1, Math.min(totalSteps - 1, index));
      if (currentIndex === -1) {
        return { state: history.initialState, step: null };
      }
      const step = history.steps[currentIndex];
      return {
        state: step ? step.stateSnapshot : history.initialState,
        step: step ?? null,
      };
    },

    jumpToStart(): GameState {
      currentIndex = -1;
      return history.initialState;
    },

    jumpToEnd(): GameState {
      currentIndex = totalSteps - 1;
      return this.getCurrentState();
    },
  };
}

/**
 * Creates a MatchTracker instance for recording live moves as they occur.
 */
export function createMatchTracker(
  initialState: GameState,
  matchId?: string,
): MatchTracker {
  let history: MatchHistory = {
    metadata: {
      id: matchId ?? `match-${Date.now().toString()}`,
      date: new Date().toISOString(),
      mapPreset: initialState.mapPreset,
      boardSize: initialState.size,
      players: initialState.players.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        name: p.name,
      })),
      winnerTeamId: initialState.winnerTeamId,
      totalTurns: 0,
      isGameOver: initialState.isGameOver,
    },
    initialState: cloneGameState(initialState),
    steps: [],
  };

  return {
    recordStep(
      action: Action,
      nextState: GameState,
      events: GameEvent[],
    ): MatchStepRecord {
      const stepIndex = history.steps.length;
      const notation = formatActionNotation(action, events, stepIndex + 1);
      const stateSnapshot = cloneGameState(nextState);

      const stepRecord: MatchStepRecord = {
        stepIndex,
        turnNumber: nextState.currentTurn,
        playerId: action.playerId,
        action,
        events,
        notation,
        stateSnapshot,
      };

      history.steps.push(stepRecord);
      history.metadata.totalTurns = history.steps.length;
      history.metadata.isGameOver = nextState.isGameOver;
      history.metadata.winnerTeamId = nextState.winnerTeamId;

      return stepRecord;
    },

    getHistory(): MatchHistory {
      return history;
    },

    reset(newInitialState: GameState, newMatchId?: string): void {
      history = {
        metadata: {
          id: newMatchId ?? `match-${Date.now().toString()}`,
          date: new Date().toISOString(),
          mapPreset: newInitialState.mapPreset,
          boardSize: newInitialState.size,
          players: newInitialState.players.map((p) => ({
            id: p.id,
            teamId: p.teamId,
            name: p.name,
          })),
          winnerTeamId: newInitialState.winnerTeamId,
          totalTurns: 0,
          isGameOver: newInitialState.isGameOver,
        },
        initialState: cloneGameState(newInitialState),
        steps: [],
      };
    },
  };
}

import { useState } from "react";
import {
  createInitialGame,
  dispatch,
  getAvailableMoves,
  isWithinDropZone,
  sanitizeForViewer,
  SKILL_SPECS,
  type Coord,
  type GameEvent,
  type GameState,
  type MapPreset,
  type Player,
  type SkillType,
} from "./engine/index.ts";

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
    return "Neutral Anchor";
  }
  if (teamId === 1) {
    return "Team 1 (Sky)";
  }
  return "Team 2 (Rose)";
}

const MAP_PRESETS: { preset: MapPreset; label: string; desc: string }[] = [
  {
    preset: "CROSSROADS",
    label: "Crossroads",
    desc: "Center Cross Anchors",
  },
  {
    preset: "ARCHIPELAGO",
    label: "Archipelago",
    desc: "4 Quadrant Islands",
  },
  {
    preset: "TRENCHES",
    label: "Trenches",
    desc: "Intersecting Paths",
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
    label: "Normal (NONE)",
    annotationStyle: "",
    buttonStyle: "bg-slate-800 text-slate-200 border-slate-700",
    code: "",
  },
  WALL: {
    label: "Wall (Green)",
    annotationStyle:
      "bg-slate-950/85 text-emerald-400 border border-emerald-500/50",
    buttonStyle: "bg-emerald-950/60 text-emerald-200 border-emerald-800/80",
    code: "W",
  },
  PIERCE: {
    label: "Pierce (Blue)",
    annotationStyle: "bg-slate-950/85 text-cyan-300 border border-cyan-400/50",
    buttonStyle: "bg-sky-950/60 text-sky-200 border-sky-800/80",
    code: "P",
  },
  BOMB: {
    label: "Bomb (Red)",
    annotationStyle: "bg-slate-950/85 text-rose-400 border border-rose-400/50",
    buttonStyle: "bg-rose-950/60 text-rose-200 border-rose-800/80",
    code: "B",
  },
  PURIFY: {
    label: "Purify (Yellow)",
    annotationStyle:
      "bg-slate-950/85 text-amber-400 border border-amber-400/50",
    buttonStyle: "bg-amber-950/60 text-amber-200 border-amber-800/80",
    code: "U",
  },
  COUNTER: {
    label: "Counter (Purple)",
    annotationStyle:
      "bg-slate-950/85 text-purple-400 border border-purple-400/50",
    buttonStyle: "bg-purple-950/60 text-purple-200 border-purple-800/80",
    code: "C",
  },
};

const SKILL_OPTIONS: { type: SkillType; label: string }[] = [
  { type: "NONE", label: "Normal (NONE)" },
  { type: "WALL", label: "Wall (Green)" },
  { type: "PIERCE", label: "Pierce (Blue)" },
  { type: "BOMB", label: "Bomb (Red)" },
  { type: "PURIFY", label: "Purify (Yellow)" },
  { type: "COUNTER", label: "Counter (Purple)" },
];

export default function App() {
  const [selectedPreset, setSelectedPreset] = useState<MapPreset>("CROSSROADS");
  const [gameState, setGameState] = useState<GameState>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).state,
  );
  const [selectedSkill, setSelectedSkill] = useState<SkillType>("NONE");
  const [isGodMode, setIsGodMode] = useState<boolean>(true);
  const [eventLogs, setEventLogs] = useState<GameEvent[]>(
    () => createInitialGame({ mapPreset: "CROSSROADS", boardSize: 16 }).events,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePlayer: Player | undefined = gameState.players.find(
    (p) => p.id === gameState.activePlayerId,
  );

  const displayedState = isGodMode
    ? gameState
    : sanitizeForViewer(gameState, gameState.activePlayerId);

  const player1 = displayedState.players.find((p) => p.teamId === 1);
  const player2 = displayedState.players.find((p) => p.teamId === 2);

  const availableMoves = getAvailableMoves(
    gameState,
    gameState.activePlayerId,
    selectedSkill,
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

  const handleCellClick = (coord: Coord) => {
    setErrorMsg(null);
    try {
      const { nextState, events } = dispatch(gameState, {
        type: "PLACE_PIECE",
        playerId: gameState.activePlayerId,
        coord,
        skillType: selectedSkill,
      });
      setGameState(nextState);
      setEventLogs((prev) => [...events, ...prev]);

      // Synchronize selectedSkill for incoming active player
      const incomingPlayer = nextState.players.find(
        (p) => p.id === nextState.activePlayerId,
      );
      if (incomingPlayer) {
        if (incomingPlayer.isForcedSpecial) {
          const available = (
            ["WALL", "PIERCE", "BOMB", "PURIFY", "COUNTER"] as const
          ).find((sk) => incomingPlayer.hand[sk] > 0);
          setSelectedSkill(available ?? "NONE");
        } else if (
          selectedSkill !== "NONE" &&
          incomingPlayer.hand[selectedSkill] <= 0
        ) {
          setSelectedSkill("NONE");
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  const handlePassTurn = () => {
    setErrorMsg(null);
    try {
      const { nextState, events } = dispatch(gameState, {
        type: "PASS_TURN",
        playerId: gameState.activePlayerId,
      });
      setGameState(nextState);
      setEventLogs((prev) => [...events, ...prev]);

      // Synchronize selectedSkill for incoming active player
      const incomingPlayer = nextState.players.find(
        (p) => p.id === nextState.activePlayerId,
      );
      if (incomingPlayer) {
        if (incomingPlayer.isForcedSpecial) {
          const available = (
            ["WALL", "PIERCE", "BOMB", "PURIFY", "COUNTER"] as const
          ).find((sk) => incomingPlayer.hand[sk] > 0);
          setSelectedSkill(available ?? "NONE");
        } else if (
          selectedSkill !== "NONE" &&
          incomingPlayer.hand[selectedSkill] <= 0
        ) {
          setSelectedSkill("NONE");
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  const handleSelectPreset = (preset: MapPreset) => {
    setSelectedPreset(preset);
    const initial = createInitialGame({ mapPreset: preset, boardSize: 16 });
    setGameState(initial.state);
    setEventLogs(initial.events);
    setErrorMsg(null);
    setSelectedSkill("NONE");
  };

  const handleReset = () => {
    const initial = createInitialGame({
      mapPreset: selectedPreset,
      boardSize: 16,
    });
    setGameState(initial.state);
    setEventLogs(initial.events);
    setErrorMsg(null);
    setSelectedSkill("NONE");
  };

  // Team piece count
  const neutralCount = gameState.board
    .flat()
    .filter((p) => p?.teamId === 0).length;
  const team1Count = gameState.board
    .flat()
    .filter((p) => p?.teamId === 1).length;
  const team2Count = gameState.board
    .flat()
    .filter((p) => p?.teamId === 2).length;

  return (
    <div className="min-h-screen bg-slate-900 p-4 font-sans text-slate-100 md:p-8">
      <header className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <span className="text-blue-500">HBC</span>
            <span>Multi-Team Reversi Core Engine</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            5-Skill Variant, Hidden Traps & Chain Reaction (16x16 Headless
            Engine)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIsGodMode(!isGodMode);
            }}
            className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
              isGodMode
                ? "bg-purple-700 text-white hover:bg-purple-600"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {isGodMode ? "God Mode (All Revealed)" : "Fog of War (Player View)"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            Reset Game
          </button>
        </div>
      </header>

      {/* Map Preset Selector Bar */}
      <section className="mx-auto mb-6 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Map Preset:
          </span>
          <div className="flex flex-wrap gap-2">
            {MAP_PRESETS.map(({ preset, label, desc }) => {
              const isSelected = selectedPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    handleSelectPreset(preset);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-xs ring-1 ring-blue-400"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
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
            <span className="text-amber-400">⚓ Neutral Anchors:</span>{" "}
            <span className="font-bold text-white">
              {neutralCount.toString()}
            </span>{" "}
            pcs
          </span>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Side: Game Board */}
        <section className="flex flex-col items-center lg:col-span-8">
          {errorMsg && (
            <div className="mb-3 w-full rounded border border-red-800 bg-red-950/80 px-4 py-2 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {gameState.isDropPhase ? (
            <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 animate-ping rounded-full bg-amber-400" />
                <span className="font-bold tracking-wider uppercase">
                  Drop Phase Active (Turn 0 Setup)
                </span>
                <span className="text-slate-300">
                  Placements restricted to assigned drop zone.
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>
                  Drop Turns Rem:{" "}
                  <strong className="text-amber-300">
                    {gameState.dropTurnsRemaining.toString()}
                  </strong>
                </span>
                {activePlayer?.dropZone && (
                  <span className="rounded bg-amber-900/60 px-2 py-0.5 text-amber-200">
                    Zone ({activePlayer.dropZone.center.x.toString()},{" "}
                    {activePlayer.dropZone.center.y.toString()}) R=
                    {activePlayer.dropZone.radius.toString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-3 flex w-full items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-1.5 text-xs text-emerald-300">
              <span className="font-semibold">
                🌐 Full-Board Phase: Drop restrictions lifted! Standard Reversi
                rules apply.
              </span>
              <span className="text-[11px] text-emerald-400/80">
                Preset: {gameState.mapPreset}
              </span>
            </div>
          )}

          {availableMoves.isPioneerActive && (
            <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 animate-ping rounded-full bg-amber-400" />
                <span className="font-bold tracking-wider uppercase">
                  Pioneer Phase Active:
                </span>
                <span>
                  No capture moves available. Place a bridge piece within 2
                  tiles of your territory.
                </span>
              </div>
              <span className="rounded bg-amber-900/60 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                {availableMoves.pioneerMoves.length.toString()} bridge targets
              </span>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-2xl">
            <div
              className="grid gap-0.5 rounded bg-slate-800/60 p-0.5"
              style={{
                gridTemplateColumns: `repeat(${gameState.size.toString()}, minmax(0, 1fr))`,
              }}
            >
              {displayedState.board.map((row, y) =>
                row.map((piece, x) => {
                  const key = `${x.toString()},${y.toString()}`;
                  const isStandardLegal = standardMoveSet.has(key);
                  const isPioneerLegal = pioneerMoveSet.has(key);
                  const isLegal = isStandardLegal || isPioneerLegal;
                  const inDropZone =
                    gameState.isDropPhase &&
                    activePlayer?.dropZone &&
                    isWithinDropZone({ x, y }, activePlayer.dropZone);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        handleCellClick({ x, y });
                      }}
                      disabled={
                        gameState.isGameOver || (piece !== null && !isLegal)
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
                      } hover:bg-slate-700/50`}
                    >
                      {/* Legal Move Marker */}
                      {piece === null && isStandardLegal && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400/50" />
                      )}
                      {piece === null && isPioneerLegal && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400/80 ring-2 ring-amber-400/30" />
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
                Match Telemetry
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-200">
                Turn {gameState.currentTurn.toString()}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Active Turn:</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full border ${
                      activePlayer?.teamId === 1
                        ? "border-sky-300 bg-sky-400"
                        : "border-rose-400 bg-rose-500"
                    }`}
                  />
                  <span>
                    {activePlayer?.name ?? "Unknown"} (
                    {getTeamName(activePlayer?.teamId ?? 1)})
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={handlePassTurn}
                className="cursor-pointer rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
              >
                Pass Turn
              </button>
            </div>

            {/* Game Phase & Drop Zone Status */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs text-slate-400">
              <span>Game Phase:</span>
              <span className="font-semibold text-slate-200">
                {gameState.isDropPhase ? (
                  <span className="text-amber-400">
                    Drop Phase ({gameState.dropTurnsRemaining.toString()} turns
                    rem)
                  </span>
                ) : (
                  <span className="text-emerald-400">Full-Board Play</span>
                )}
              </span>
            </div>

            {activePlayer?.dropZone && gameState.isDropPhase && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>Active Drop Zone:</span>
                <span className="font-mono text-slate-300">
                  Center ({activePlayer.dropZone.center.x.toString()},{" "}
                  {activePlayer.dropZone.center.y.toString()}), R=
                  {activePlayer.dropZone.radius.toString()}
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-xs text-slate-400">
              <span>Board Factions:</span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="font-bold text-sky-300">
                  {team1Count.toString()} Sky
                </span>
                <span className="text-slate-600">/</span>
                <span className="font-bold text-rose-300">
                  {team2Count.toString()} Rose
                </span>
                <span className="text-slate-600">/</span>
                <span className="font-bold text-amber-400">
                  {neutralCount.toString()} Neutral
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
                      Team 1 (Sky)
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        ACTIVE TURN
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        Waiting
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {player1?.isForcedSpecial && (
                      <span className="rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        ⚡ FORCED
                      </span>
                    )}
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">
                      {team1Count.toString()} pcs
                    </span>
                  </div>
                </div>

                {player1?.isForcedSpecial && isActive && (
                  <div className="flex items-center gap-2 rounded border border-amber-500/60 bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200">
                    <span className="text-sm">⚡</span>
                    <span className="text-[11px] font-semibold">
                      Forced Special: Hand capacity overflowed! Must place a
                      special skill.
                    </span>
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
                    const isDisabled = !isActive || isOutOfStock || isForbidden;
                    const isSelected = isActive && selectedSkill === opt.type;
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
                            ? "Waiting for Team 1's turn"
                            : isForbidden
                              ? "Blocked by Forced Special"
                              : isOutOfStock
                                ? "No stock available (count: 0)"
                                : `Select ${config.label}`
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
                            <span className="truncate text-[11px] font-semibold">
                              {opt.label.split(" ")[0]}
                            </span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              isNone
                                ? "bg-slate-800 text-slate-400"
                                : count >= maxHand
                                  ? "border border-amber-500/50 bg-amber-500/20 text-amber-300"
                                  : count > 0
                                    ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                                    : "border border-slate-800 bg-slate-800 text-slate-500"
                            }`}
                          >
                            {isNone
                              ? "∞"
                              : `${count.toString()}/${maxHand.toString()}`}
                          </span>
                        </div>

                        {!isNone && (
                          <div className="w-full">
                            <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span>CD Charge</span>
                              <span className="font-mono text-[9px]">
                                {charge.toString()}/{cd.toString()}
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
                          <span className="text-[9px] font-semibold text-red-400">
                            🚫 Blocked
                          </span>
                        )}
                        {!isNone &&
                          isOutOfStock &&
                          !isForbidden &&
                          isActive && (
                            <span className="text-[9px] text-slate-500">
                              Stock: 0
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
                      Team 2 (Rose)
                    </span>
                    {isActive ? (
                      <span className="animate-pulse rounded border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        ACTIVE TURN
                      </span>
                    ) : (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                        Waiting
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {player2?.isForcedSpecial && (
                      <span className="rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                        ⚡ FORCED
                      </span>
                    )}
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-bold text-white">
                      {team2Count.toString()} pcs
                    </span>
                  </div>
                </div>

                {player2?.isForcedSpecial && isActive && (
                  <div className="flex items-center gap-2 rounded border border-amber-500/60 bg-amber-950/60 px-2.5 py-1.5 text-xs text-amber-200">
                    <span className="text-sm">⚡</span>
                    <span className="text-[11px] font-semibold">
                      Forced Special: Hand capacity overflowed! Must place a
                      special skill.
                    </span>
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
                    const isDisabled = !isActive || isOutOfStock || isForbidden;
                    const isSelected = isActive && selectedSkill === opt.type;
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
                            ? "Waiting for Team 2's turn"
                            : isForbidden
                              ? "Blocked by Forced Special"
                              : isOutOfStock
                                ? "No stock available (count: 0)"
                                : `Select ${config.label}`
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
                            <span className="truncate text-[11px] font-semibold">
                              {opt.label.split(" ")[0]}
                            </span>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              isNone
                                ? "bg-slate-800 text-slate-400"
                                : count >= maxHand
                                  ? "border border-amber-500/50 bg-amber-500/20 text-amber-300"
                                  : count > 0
                                    ? "border border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                                    : "border border-slate-800 bg-slate-800 text-slate-500"
                            }`}
                          >
                            {isNone
                              ? "∞"
                              : `${count.toString()}/${maxHand.toString()}`}
                          </span>
                        </div>

                        {!isNone && (
                          <div className="w-full">
                            <div className="mb-0.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span>CD Charge</span>
                              <span className="font-mono text-[9px]">
                                {charge.toString()}/{cd.toString()}
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
                          <span className="text-[9px] font-semibold text-red-400">
                            🚫 Blocked
                          </span>
                        )}
                        {!isNone &&
                          isOutOfStock &&
                          !isForbidden &&
                          isActive && (
                            <span className="text-[9px] text-slate-500">
                              Stock: 0
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
                Event Sourcing Stream
              </span>
              <span className="text-xs text-slate-500">
                {eventLogs.length.toString()} events
              </span>
            </div>

            <div className="max-h-72 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
              {eventLogs.length === 0 ? (
                <div className="py-4 text-center text-slate-500 italic">
                  No events yet. Place a piece to trigger engine transitions.
                </div>
              ) : (
                eventLogs.map((ev, idx) => (
                  <div
                    key={`${ev.type}-${idx.toString()}`}
                    className="flex flex-col gap-1 rounded border border-slate-800/80 bg-slate-900 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-400">
                        {ev.type}
                      </span>
                      {ev.type === "DROP_PHASE_STARTED" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          Preset: {ev.mapPreset}
                        </span>
                      )}
                      {ev.type === "PIONEER_PLACED" && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          Pioneer Bridge ({ev.coord.x.toString()},{" "}
                          {ev.coord.y.toString()})
                        </span>
                      )}
                      {ev.type === "DROP_PHASE_ENDED" && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                          Full-Board Active
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

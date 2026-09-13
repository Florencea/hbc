import { useState } from "react";
import {
  createInitialState,
  dispatch,
  getLegalMoves,
  sanitizeForViewer,
  type Coord,
  type GameEvent,
  type GameState,
  type Player,
  type SkillType,
} from "./engine/index.ts";

function getTeamShapeClass(teamId: number): string {
  if (teamId === 1) {
    return "rounded-full";
  }
  return "rounded-xs";
}

function getTeamShapeName(teamId: number): string {
  if (teamId === 1) {
    return "Circle";
  }
  return "Square";
}

interface SkillVisualConfig {
  label: string;
  pieceStyle: string;
  buttonStyle: string;
  code: string;
}

const SKILL_CONFIG: Record<SkillType, SkillVisualConfig> = {
  NONE: {
    label: "Normal (NONE)",
    pieceStyle: "bg-slate-300 text-slate-900 border border-slate-400/70",
    buttonStyle: "bg-slate-800 text-slate-200 border-slate-700",
    code: "",
  },
  WALL: {
    label: "Wall (Green)",
    pieceStyle:
      "bg-emerald-600/85 text-emerald-100 border border-emerald-400/60",
    buttonStyle: "bg-emerald-950/60 text-emerald-200 border-emerald-800/80",
    code: "W",
  },
  PIERCE: {
    label: "Pierce (Blue)",
    pieceStyle: "bg-sky-600/85 text-sky-100 border border-sky-400/60",
    buttonStyle: "bg-sky-950/60 text-sky-200 border-sky-800/80",
    code: "P",
  },
  BOMB: {
    label: "Bomb (Red)",
    pieceStyle: "bg-rose-600/85 text-rose-100 border border-rose-400/60",
    buttonStyle: "bg-rose-950/60 text-rose-200 border-rose-800/80",
    code: "B",
  },
  PURIFY: {
    label: "Purify (Yellow)",
    pieceStyle: "bg-amber-500/85 text-amber-950 border border-amber-300/60",
    buttonStyle: "bg-amber-950/60 text-amber-200 border-amber-800/80",
    code: "U",
  },
  COUNTER: {
    label: "Counter (Purple)",
    pieceStyle: "bg-purple-600/85 text-purple-100 border border-purple-400/60",
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
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(16),
  );
  const [selectedSkill, setSelectedSkill] = useState<SkillType>("NONE");
  const [isGodMode, setIsGodMode] = useState<boolean>(true);
  const [eventLogs, setEventLogs] = useState<GameEvent[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activePlayer: Player | undefined = gameState.players.find(
    (p) => p.id === gameState.activePlayerId,
  );

  const displayedState = isGodMode
    ? gameState
    : sanitizeForViewer(gameState, gameState.activePlayerId);

  const legalMoves = getLegalMoves(
    gameState,
    gameState.activePlayerId,
    selectedSkill,
  );

  const legalMoveSet = new Set(
    legalMoves.map((m) => `${m.x.toString()},${m.y.toString()}`),
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
    } catch (err) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      }
    }
  };

  const handleReset = () => {
    setGameState(createInitialState(16));
    setEventLogs([]);
    setErrorMsg(null);
    setSelectedSkill("NONE");
  };

  // Team piece count
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

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Side: Game Board */}
        <section className="flex flex-col items-center lg:col-span-8">
          {errorMsg && (
            <div className="mb-3 w-full rounded border border-red-800 bg-red-950/80 px-4 py-2 text-xs text-red-300">
              {errorMsg}
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
                  const isLegal = legalMoveSet.has(key);

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
                      } hover:bg-slate-700/50`}
                    >
                      {/* Legal Move Marker */}
                      {isLegal && piece === null && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400/50" />
                      )}

                      {/* Piece Representation */}
                      {piece && (
                        <div
                          className={`flex h-5 w-5 items-center justify-center text-[9px] font-bold shadow-xs transition-transform sm:h-6 sm:w-6 md:h-7 md:w-7 ${getTeamShapeClass(
                            piece.teamId,
                          )} ${SKILL_CONFIG[piece.skillType].pieceStyle} ${
                            !piece.isRevealed ? "border-dashed" : ""
                          }`}
                        >
                          {SKILL_CONFIG[piece.skillType].code}
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
          {/* Status Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Match Telemetry
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                Turn {gameState.currentTurn.toString()}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div
                className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  activePlayer?.teamId === 1
                    ? "border-slate-600 bg-slate-800/80 ring-1 ring-slate-500/50"
                    : "border-slate-800/80 bg-slate-900/40 opacity-75"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-400/80 bg-slate-300" />
                  <span>Team 1 (Circle)</span>
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {team1Count.toString()}
                </div>
              </div>

              <div
                className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
                  activePlayer?.teamId === 2
                    ? "border-slate-600 bg-slate-800/80 ring-1 ring-slate-500/50"
                    : "border-slate-800/80 bg-slate-900/40 opacity-75"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span className="inline-block h-3.5 w-3.5 rounded-xs border border-slate-400/80 bg-slate-300" />
                  <span>Team 2 (Square)</span>
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {team2Count.toString()}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>Active Turn:</span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <span
                  className={`inline-block h-2.5 w-2.5 border border-slate-400/80 bg-slate-300 ${getTeamShapeClass(
                    activePlayer?.teamId ?? 1,
                  )}`}
                />
                <span>
                  {activePlayer?.name ?? "Unknown"} (Team{" "}
                  {activePlayer?.teamId.toString() ?? ""} ·{" "}
                  {getTeamShapeName(activePlayer?.teamId ?? 1)})
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={handlePassTurn}
              className="w-full rounded bg-slate-800 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
            >
              Pass Turn
            </button>
          </div>

          {/* Skill Selector */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Next Piece Skill
              </span>
              <span className="text-[11px] text-slate-500">Color coded</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {SKILL_OPTIONS.map((opt) => {
                const isSelected = selectedSkill === opt.type;
                const config = SKILL_CONFIG[opt.type];
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setSelectedSkill(opt.type);
                    }}
                    className={`flex items-center gap-2 rounded border px-3 py-2 text-left text-xs font-medium transition-all ${
                      isSelected
                        ? "border-slate-300 bg-slate-800/90 text-white ring-1 ring-slate-400/60"
                        : `${config.buttonStyle} opacity-75 hover:opacity-100`
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-xs text-[9px] font-bold ${config.pieceStyle}`}
                    >
                      {config.code}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

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

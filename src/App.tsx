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

const SKILL_OPTIONS: { type: SkillType; label: string; color: string }[] = [
  { type: "NONE", label: "Normal (NONE)", color: "bg-slate-700 text-white" },
  { type: "WALL", label: "Wall (Green)", color: "bg-emerald-600 text-white" },
  { type: "PIERCE", label: "Pierce (Blue)", color: "bg-blue-600 text-white" },
  { type: "BOMB", label: "Bomb (Red)", color: "bg-red-600 text-white" },
  {
    type: "PURIFY",
    label: "Purify (Yellow)",
    color: "bg-amber-500 text-slate-950",
  },
  {
    type: "COUNTER",
    label: "Counter (Dark)",
    color: "bg-purple-950 text-white",
  },
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
              className="grid gap-[2px] rounded bg-slate-800 p-[2px]"
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
                      className={`relative flex h-6 w-6 items-center justify-center rounded-[2px] transition-all sm:h-7 sm:w-7 md:h-8 md:w-8 ${
                        (x + y) % 2 === 0 ? "bg-slate-900" : "bg-slate-800/80"
                      } hover:bg-slate-700/60`}
                    >
                      {/* Legal Move Marker */}
                      {isLegal && piece === null && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400/70" />
                      )}

                      {/* Piece Representation */}
                      {piece && (
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold shadow-sm sm:h-6 sm:w-6 md:h-7 md:w-7 ${
                            piece.teamId === 1
                              ? "border border-sky-200 bg-sky-400 text-slate-950"
                              : "border border-rose-300 bg-rose-500 text-white"
                          }`}
                        >
                          {piece.skillType === "WALL" && "W"}
                          {piece.skillType === "PIERCE" && "P"}
                          {piece.skillType === "BOMB" && "B"}
                          {piece.skillType === "PURIFY" && "U"}
                          {piece.skillType === "COUNTER" && "C"}
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
                className={`rounded border p-3 ${
                  activePlayer?.teamId === 1
                    ? "border-sky-700 bg-sky-950/40"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="text-xs font-semibold text-sky-400">
                  Team 1 (Sky)
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {team1Count.toString()}
                </div>
              </div>

              <div
                className={`rounded border p-3 ${
                  activePlayer?.teamId === 2
                    ? "border-rose-700 bg-rose-950/40"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="text-xs font-semibold text-rose-400">
                  Team 2 (Rose)
                </div>
                <div className="mt-1 text-xl font-bold text-white">
                  {team2Count.toString()}
                </div>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>Active Turn:</span>
              <span className="font-semibold text-white">
                {activePlayer?.name ?? "Unknown"} (Team{" "}
                {activePlayer?.teamId.toString() ?? ""})
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
            <span className="mb-3 block text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Next Piece Skill
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SKILL_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => {
                    setSelectedSkill(opt.type);
                  }}
                  className={`rounded border px-3 py-2 text-left text-xs font-medium transition-all ${
                    selectedSkill === opt.type
                      ? "border-blue-400 ring-1 ring-blue-400"
                      : "border-transparent opacity-75 hover:opacity-100"
                  } ${opt.color}`}
                >
                  {opt.label}
                </button>
              ))}
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

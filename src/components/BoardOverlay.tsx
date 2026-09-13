import type { Coord } from "../engine/types.ts";

export interface BlastWaveEffect {
  id: string;
  center: Coord;
}

export interface AuraPulseEffect {
  id: string;
  center: Coord;
}

export interface ShieldRippleEffect {
  id: string;
  coord: Coord;
}

export interface PierceStrikeEffect {
  id: string;
  coord: Coord;
}

export interface AbyssVortexEffect {
  id: string;
  center: Coord;
  reversedCoords: Coord[];
}

export interface PioneerBridgeEffect {
  id: string;
  from: Coord;
  to: Coord;
}

interface BoardOverlayProps {
  boardSize: number;
  blastWaves: BlastWaveEffect[];
  auraPulses: AuraPulseEffect[];
  shieldRipples: ShieldRippleEffect[];
  pierceStrikes?: PierceStrikeEffect[];
  abyssVortices?: AbyssVortexEffect[];
  pioneerBridges: PioneerBridgeEffect[];
}

// Pre-computed ember trajectory offsets for BOMB explosion sparks
const EMBER_DIRECTIONS = [
  { dx: 0, dy: -42 },
  { dx: 30, dy: -30 },
  { dx: 42, dy: 0 },
  { dx: 30, dy: 30 },
  { dx: 0, dy: 42 },
  { dx: -30, dy: 30 },
  { dx: -42, dy: 0 },
  { dx: -30, dy: -30 },
];

// Pre-computed stardust particle offsets for PURIFY sacred aura
const STARDUST_OFFSETS = [
  { x: -28, y: -10, delay: "0ms" },
  { x: 26, y: -15, delay: "80ms" },
  { x: -14, y: 22, delay: "160ms" },
  { x: 18, y: 20, delay: "120ms" },
  { x: 0, y: -30, delay: "40ms" },
  { x: -32, y: 12, delay: "200ms" },
];

export function BoardOverlay({
  boardSize,
  blastWaves,
  auraPulses,
  shieldRipples,
  pierceStrikes = [],
  abyssVortices = [],
  pioneerBridges,
}: BoardOverlayProps) {
  const cellSizePercent = 100 / boardSize;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* 1. Pioneer Bridge SVG Energy Rays */}
      {pioneerBridges.length > 0 && (
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient
              id="bridge-glow"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
            </linearGradient>
            <filter
              id="glow-filter"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {pioneerBridges.map((bridge) => {
            const x1 = ((bridge.from.x + 0.5) / boardSize) * 100;
            const y1 = ((bridge.from.y + 0.5) / boardSize) * 100;
            const x2 = ((bridge.to.x + 0.5) / boardSize) * 100;
            const y2 = ((bridge.to.y + 0.5) / boardSize) * 100;

            return (
              <g key={bridge.id} className="animate-pulse">
                <line
                  x1={`${x1.toString()}%`}
                  y1={`${y1.toString()}%`}
                  x2={`${x2.toString()}%`}
                  y2={`${y2.toString()}%`}
                  stroke="url(#bridge-glow)"
                  strokeWidth="3"
                  strokeDasharray="6 4"
                  filter="url(#glow-filter)"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* 2. COUNTER: Abyssal Vortex & Reversal Void Lightning */}
      {abyssVortices.map((vortex) => {
        const centerX = ((vortex.center.x + 0.5) / boardSize) * 100;
        const centerY = ((vortex.center.y + 0.5) / boardSize) * 100;
        const widthPercent = cellSizePercent * 3.6;
        const heightPercent = cellSizePercent * 3.6;

        return (
          <div key={vortex.id} className="absolute inset-0">
            {/* SVG Lightning Rays Tracing Along Reversed Coordinates */}
            {vortex.reversedCoords.length > 0 && (
              <svg
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <defs>
                  <filter
                    id={`void-glow-${vortex.id}`}
                    x="-30%"
                    y="-30%"
                    width="160%"
                    height="160%"
                  >
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {vortex.reversedCoords.map((rc, idx) => {
                  const x2 = ((rc.x + 0.5) / boardSize) * 100;
                  const y2 = ((rc.y + 0.5) / boardSize) * 100;
                  return (
                    <g
                      key={`${rc.x.toString()}-${rc.y.toString()}-${idx.toString()}`}
                    >
                      <line
                        x1={`${centerX.toString()}%`}
                        y1={`${centerY.toString()}%`}
                        x2={`${x2.toString()}%`}
                        y2={`${y2.toString()}%`}
                        stroke="#a855f7"
                        strokeWidth="4"
                        strokeDasharray="14 6"
                        className="animate-abyss-lightning opacity-90"
                        filter={`url(#void-glow-${vortex.id})`}
                      />
                      <line
                        x1={`${centerX.toString()}%`}
                        y1={`${centerY.toString()}%`}
                        x2={`${x2.toString()}%`}
                        y2={`${y2.toString()}%`}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="animate-abyss-lightning opacity-95"
                      />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Central Abyssal Singularity Dark Core */}
            <div
              className="animate-abyss-singularity absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{
                left: `${centerX.toString()}%`,
                top: `${centerY.toString()}%`,
                width: `${widthPercent.toString()}%`,
                height: `${heightPercent.toString()}%`,
              }}
            >
              <div className="relative flex h-full w-full items-center justify-center">
                {/* Outer Void Aura */}
                <div className="absolute inset-0 rounded-full border border-purple-500/80 bg-radial-[circle_at_center] from-black via-purple-950/80 to-transparent shadow-[0_0_40px_rgba(168,85,247,0.9)]" />
                {/* Inner Black Singularity */}
                <div className="h-1/3 w-1/3 rounded-full border-2 border-purple-300 bg-black shadow-[0_0_20px_rgba(147,51,234,1)] ring-4 ring-purple-600/60" />
              </div>
            </div>
          </div>
        );
      })}

      {/* 3. WALL: Hexagonal Emerald Crystalline Shield & Deflection Sparks */}
      {shieldRipples.map((ripple) => {
        const centerX = ((ripple.coord.x + 0.5) / boardSize) * 100;
        const centerY = ((ripple.coord.y + 0.5) / boardSize) * 100;
        const widthPercent = cellSizePercent * 2.5;
        const heightPercent = cellSizePercent * 2.5;

        return (
          <div
            key={ripple.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${centerX.toString()}%`,
              top: `${centerY.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          >
            {/* Hexagonal Shield Vector */}
            <svg
              viewBox="0 0 100 100"
              className="animate-hex-shield h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={`hex-grad-${ripple.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#10b981" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.85" />
                </linearGradient>
              </defs>
              {/* Outer Hexagon Shield */}
              <polygon
                points="50,4 90,26 90,74 50,96 10,74 10,26"
                fill={`url(#hex-grad-${ripple.id})`}
                stroke="#a7f3d0"
                strokeWidth="3.5"
                className="drop-shadow-[0_0_12px_rgba(52,211,153,0.9)]"
              />
              {/* Inner Honeycomb Core */}
              <polygon
                points="50,18 78,34 78,66 50,82 22,66 22,34"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.85"
              />
              {/* Central Runic Cross */}
              <line
                x1="50"
                y1="28"
                x2="50"
                y2="72"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="28"
                y1="50"
                x2="72"
                y2="50"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Spark Deflection Wave */}
            <div className="animate-shield-spark absolute inset-1 rounded-full border-2 border-emerald-300/80 bg-emerald-400/20" />
          </div>
        );
      })}

      {/* 4. PIERCE: Supersonic Astral Lance & Expanding Sonic Boom Rings */}
      {pierceStrikes.map((pierce) => {
        const centerX = ((pierce.coord.x + 0.5) / boardSize) * 100;
        const centerY = ((pierce.coord.y + 0.5) / boardSize) * 100;
        const widthPercent = cellSizePercent * 2.8;
        const heightPercent = cellSizePercent * 2.8;

        return (
          <div
            key={pierce.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${centerX.toString()}%`,
              top: `${centerY.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          >
            {/* Sonic Boom Rings */}
            <div className="animate-pierce-ring absolute h-full w-full rounded-full border-2 border-cyan-300/90 bg-cyan-400/20 shadow-[0_0_20px_rgba(56,189,248,0.9)]" />

            {/* Supersonic Astral Diamond Lance SVG */}
            <svg
              viewBox="0 0 100 100"
              className="animate-pierce-lance h-4/5 w-4/5"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={`lance-grad-${pierce.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              {/* 4-Pointed High Velocity Astral Spear */}
              <polygon
                points="50,2 62,38 98,50 62,62 50,98 38,62 2,50 38,38"
                fill={`url(#lance-grad-${pierce.id})`}
                stroke="#e0f2fe"
                strokeWidth="2"
                className="drop-shadow-[0_0_15px_rgba(56,189,248,1)]"
              />
              <circle cx="50" cy="50" r="7" fill="#ffffff" />
            </svg>
          </div>
        );
      })}

      {/* 5. BOMB: Multi-Layered Incandescent Core, 3x3 Blast Shockwave & Flying Embers */}
      {blastWaves.map((blast) => {
        const centerX = ((blast.center.x + 0.5) / boardSize) * 100;
        const centerY = ((blast.center.y + 0.5) / boardSize) * 100;
        const widthPercent = cellSizePercent * 3.4;
        const heightPercent = cellSizePercent * 3.4;

        return (
          <div
            key={blast.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${centerX.toString()}%`,
              top: `${centerY.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          >
            {/* Outer 3x3 Fiery Blast Wave */}
            <div className="animate-bomb-shock absolute inset-0 rounded-full border-4 border-rose-500/90 bg-radial-[circle_at_center] from-rose-500/80 via-orange-500/40 to-transparent shadow-[0_0_40px_rgba(244,63,94,0.95)]" />

            {/* Jagged Explosion Ring Texture */}
            <svg
              viewBox="0 0 120 120"
              className="animate-blast-wave absolute h-full w-full"
              aria-hidden="true"
            >
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#f97316"
                strokeWidth="3"
                strokeDasharray="8 6"
                opacity="0.85"
              />
            </svg>

            {/* Incandescent Core Flash */}
            <div className="animate-bomb-core absolute h-1/3 w-1/3 rounded-full bg-linear-to-tr from-white via-yellow-200 to-rose-400 shadow-[0_0_30px_rgba(255,255,255,1)]" />

            {/* Flying Fiery Ember Particles */}
            {EMBER_DIRECTIONS.map((dir, idx) => (
              <div
                key={idx}
                className="animate-shield-spark absolute h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,1)]"
                style={{
                  transform: `translate(${dir.dx.toString()}px, ${dir.dy.toString()}px)`,
                }}
              />
            ))}
          </div>
        );
      })}

      {/* 6. PURIFY: Sacred Golden Mandala, Celestial Aura & Ascending Stardust */}
      {auraPulses.map((aura) => {
        const centerX = ((aura.center.x + 0.5) / boardSize) * 100;
        const centerY = ((aura.center.y + 0.5) / boardSize) * 100;
        const widthPercent = cellSizePercent * 3.4;
        const heightPercent = cellSizePercent * 3.4;

        return (
          <div
            key={aura.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{
              left: `${centerX.toString()}%`,
              top: `${centerY.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          >
            {/* Outer Gentle Celestial Aura Ripple */}
            <div className="animate-aura-pulse absolute inset-0 rounded-full border-2 border-amber-300/95 bg-radial-[circle_at_center] from-amber-400/55 via-amber-500/25 to-transparent shadow-[0_0_35px_rgba(251,191,36,0.85)]" />

            {/* Sacred 12-Fold Sunburst Mandala SVG */}
            <svg
              viewBox="0 0 100 100"
              className="animate-purify-mandala absolute h-4/5 w-4/5"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={`purify-grad-${aura.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              {/* Outer Sacred Ring */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={`url(#purify-grad-${aura.id})`}
                strokeWidth="2.5"
                strokeDasharray="6 3"
              />
              <circle
                cx="50"
                cy="50"
                r="30"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                opacity="0.8"
              />
              {/* Star of Light (Two Overlapping Squares) */}
              <rect
                x="32"
                y="32"
                width="36"
                height="36"
                fill="none"
                stroke="#fef08a"
                strokeWidth="2"
                transform="rotate(0 50 50)"
              />
              <rect
                x="32"
                y="32"
                width="36"
                height="36"
                fill="none"
                stroke="#fef08a"
                strokeWidth="2"
                transform="rotate(45 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="10"
                fill="#ffffff"
                className="drop-shadow-[0_0_12px_rgba(255,255,255,1)]"
              />
            </svg>

            {/* Ascending Holy Stardust Particles */}
            {STARDUST_OFFSETS.map((pt, idx) => (
              <div
                key={idx}
                className="animate-purify-sparkle absolute h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(254,240,138,1)]"
                style={{
                  transform: `translate(${pt.x.toString()}px, ${pt.y.toString()}px)`,
                  animationDelay: pt.delay,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

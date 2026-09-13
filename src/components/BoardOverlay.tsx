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
  pioneerBridges: PioneerBridgeEffect[];
}

export function BoardOverlay({
  boardSize,
  blastWaves,
  auraPulses,
  shieldRipples,
  pioneerBridges,
}: BoardOverlayProps) {
  const cellSizePercent = 100 / boardSize;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Pioneer Bridge SVG Rays */}
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

      {/* 3x3 Bomb Blast Waves */}
      {blastWaves.map((blast) => {
        // A 3x3 area spans 3 cell widths and 3 cell heights, centered at center
        const widthPercent = cellSizePercent * 3.2;
        const heightPercent = cellSizePercent * 3.2;
        const leftPercent =
          ((blast.center.x + 0.5) / boardSize) * 100 - widthPercent / 2;
        const topPercent =
          ((blast.center.y + 0.5) / boardSize) * 100 - heightPercent / 2;

        return (
          <div
            key={blast.id}
            className="animate-blast-wave absolute rounded-full border-2 border-rose-500/90 bg-radial-[circle_at_center] from-rose-500/70 via-orange-500/30 to-transparent shadow-[0_0_30px_rgba(244,63,94,0.8)]"
            style={{
              left: `${leftPercent.toString()}%`,
              top: `${topPercent.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          />
        );
      })}

      {/* 3x3 Purify Aura Ripple Pulse */}
      {auraPulses.map((aura) => {
        const widthPercent = cellSizePercent * 3.2;
        const heightPercent = cellSizePercent * 3.2;
        const leftPercent =
          ((aura.center.x + 0.5) / boardSize) * 100 - widthPercent / 2;
        const topPercent =
          ((aura.center.y + 0.5) / boardSize) * 100 - heightPercent / 2;

        return (
          <div
            key={aura.id}
            className="animate-aura-pulse absolute rounded-full border-2 border-amber-300/90 bg-radial-[circle_at_center] from-amber-400/60 via-amber-500/25 to-transparent shadow-[0_0_25px_rgba(251,191,36,0.8)]"
            style={{
              left: `${leftPercent.toString()}%`,
              top: `${topPercent.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          />
        );
      })}

      {/* Shield Block Ripples */}
      {shieldRipples.map((ripple) => {
        const widthPercent = cellSizePercent * 1.8;
        const heightPercent = cellSizePercent * 1.8;
        const leftPercent =
          ((ripple.coord.x + 0.5) / boardSize) * 100 - widthPercent / 2;
        const topPercent =
          ((ripple.coord.y + 0.5) / boardSize) * 100 - heightPercent / 2;

        return (
          <div
            key={ripple.id}
            className="animate-shield-ripple absolute rounded-full border-2 border-emerald-400/95 bg-emerald-500/30 shadow-[0_0_16px_rgba(52,211,153,0.9)]"
            style={{
              left: `${leftPercent.toString()}%`,
              top: `${topPercent.toString()}%`,
              width: `${widthPercent.toString()}%`,
              height: `${heightPercent.toString()}%`,
            }}
          />
        );
      })}
    </div>
  );
}

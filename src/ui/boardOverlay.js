import { el, svgEl } from "./dom.js";

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

const STARDUST_OFFSETS = [
  { x: -28, y: -10, delay: "0ms" },
  { x: 26, y: -15, delay: "80ms" },
  { x: -14, y: 22, delay: "160ms" },
  { x: 18, y: 20, delay: "120ms" },
  { x: 0, y: -30, delay: "40ms" },
  { x: -32, y: 12, delay: "200ms" },
];

function syncKeyedLayer(container, map, items, createNode) {
  const activeIds = new Set();
  for (const item of items) {
    activeIds.add(item.id);
    if (!map.has(item.id)) {
      const node = createNode(item);
      map.set(item.id, node);
      container.appendChild(node);
    }
  }
  for (const [id, node] of map.entries()) {
    if (!activeIds.has(id)) {
      node.remove();
      map.delete(id);
    }
  }
}

function buildBridgeNode(bridge, boardSize) {
  const x1 = ((bridge.from.x + 0.5) / boardSize) * 100;
  const y1 = ((bridge.from.y + 0.5) / boardSize) * 100;
  const x2 = ((bridge.to.x + 0.5) / boardSize) * 100;
  const y2 = ((bridge.to.y + 0.5) / boardSize) * 100;
  const gradId = `bridge-glow-${bridge.id}`;
  const filterId = `glow-filter-${bridge.id}`;

  return svgEl(
    "svg",
    { className: "board-overlay-svg", "aria-hidden": "true" },
    svgEl(
      "defs",
      null,
      svgEl(
        "linearGradient",
        { id: gradId, x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
        svgEl("stop", {
          offset: "0%",
          "stop-color": "#38bdf8",
          "stop-opacity": "0.9",
        }),
        svgEl("stop", {
          offset: "50%",
          "stop-color": "#fbbf24",
          "stop-opacity": "1",
        }),
        svgEl("stop", {
          offset: "100%",
          "stop-color": "#38bdf8",
          "stop-opacity": "0.9",
        }),
      ),
      svgEl(
        "filter",
        { id: filterId, x: "-20%", y: "-20%", width: "140%", height: "140%" },
        svgEl("feGaussianBlur", { stdDeviation: "3", result: "blur" }),
        svgEl(
          "feMerge",
          null,
          svgEl("feMergeNode", { in: "blur" }),
          svgEl("feMergeNode", { in: "SourceGraphic" }),
        ),
      ),
    ),
    svgEl(
      "g",
      { className: "fx-bridge-pulse" },
      svgEl("line", {
        x1: `${x1}%`,
        y1: `${y1}%`,
        x2: `${x2}%`,
        y2: `${y2}%`,
        stroke: `url(#${gradId})`,
        "stroke-width": "3",
        "stroke-dasharray": "6 4",
        filter: `url(#${filterId})`,
      }),
    ),
  );
}

function buildAbyssNode(vortex, boardSize) {
  const cellSizePercent = 100 / boardSize;
  const centerX = ((vortex.center.x + 0.5) / boardSize) * 100;
  const centerY = ((vortex.center.y + 0.5) / boardSize) * 100;
  const sizePercent = cellSizePercent * 3.6;
  const filterId = `void-glow-${vortex.id}`;

  const children = [];
  if (vortex.reversedCoords.length > 0) {
    const rays = vortex.reversedCoords.map((rc) => {
      const x2 = ((rc.x + 0.5) / boardSize) * 100;
      const y2 = ((rc.y + 0.5) / boardSize) * 100;
      return svgEl(
        "g",
        null,
        svgEl("line", {
          x1: `${centerX}%`,
          y1: `${centerY}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
          stroke: "#a855f7",
          "stroke-width": "4",
          "stroke-dasharray": "14 6",
          className: "fx-abyss-lightning",
          filter: `url(#${filterId})`,
        }),
        svgEl("line", {
          x1: `${centerX}%`,
          y1: `${centerY}%`,
          x2: `${x2}%`,
          y2: `${y2}%`,
          stroke: "#ffffff",
          "stroke-width": "1.5",
          className: "fx-abyss-lightning",
        }),
      );
    });
    children.push(
      svgEl(
        "svg",
        { className: "board-overlay-svg", "aria-hidden": "true" },
        svgEl(
          "defs",
          null,
          svgEl(
            "filter",
            {
              id: filterId,
              x: "-30%",
              y: "-30%",
              width: "160%",
              height: "160%",
            },
            svgEl("feGaussianBlur", { stdDeviation: "4", result: "blur" }),
            svgEl(
              "feMerge",
              null,
              svgEl("feMergeNode", { in: "blur" }),
              svgEl("feMergeNode", { in: "SourceGraphic" }),
            ),
          ),
        ),
        ...rays,
      ),
    );
  }

  children.push(
    el(
      "div",
      {
        className: "fx-anchor fx-abyss-singularity",
        cssVars: {
          "--fx-x": `${centerX}%`,
          "--fx-y": `${centerY}%`,
          "--fx-size": `${sizePercent}%`,
        },
      },
      el("div", { className: "fx-abyss-aura" }),
      el("div", { className: "fx-abyss-core" }),
    ),
  );

  return el("div", { className: "fx-abyss-wrap" }, ...children);
}

function buildShieldNode(ripple, boardSize) {
  const cellSizePercent = 100 / boardSize;
  const centerX = ((ripple.coord.x + 0.5) / boardSize) * 100;
  const centerY = ((ripple.coord.y + 0.5) / boardSize) * 100;
  const sizePercent = cellSizePercent * 2.5;
  const gradId = `hex-grad-${ripple.id}`;

  return el(
    "div",
    {
      className: "fx-anchor",
      cssVars: {
        "--fx-x": `${centerX}%`,
        "--fx-y": `${centerY}%`,
        "--fx-size": `${sizePercent}%`,
      },
    },
    svgEl(
      "svg",
      {
        viewBox: "0 0 100 100",
        className: "fx-hex-shield",
        "aria-hidden": "true",
      },
      svgEl(
        "defs",
        null,
        svgEl(
          "linearGradient",
          { id: gradId, x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
          svgEl("stop", {
            offset: "0%",
            "stop-color": "#6ee7b7",
            "stop-opacity": "0.95",
          }),
          svgEl("stop", {
            offset: "50%",
            "stop-color": "#10b981",
            "stop-opacity": "0.75",
          }),
          svgEl("stop", {
            offset: "100%",
            "stop-color": "#047857",
            "stop-opacity": "0.85",
          }),
        ),
      ),
      svgEl("polygon", {
        points: "50,4 90,26 90,74 50,96 10,74 10,26",
        fill: `url(#${gradId})`,
        stroke: "#a7f3d0",
        "stroke-width": "3.5",
      }),
      svgEl("polygon", {
        points: "50,18 78,34 78,66 50,82 22,66 22,34",
        fill: "none",
        stroke: "#ffffff",
        "stroke-width": "2",
        "stroke-dasharray": "4 2",
        opacity: "0.85",
      }),
      svgEl("line", {
        x1: "50",
        y1: "28",
        x2: "50",
        y2: "72",
        stroke: "#ffffff",
        "stroke-width": "2.5",
        "stroke-linecap": "round",
      }),
      svgEl("line", {
        x1: "28",
        y1: "50",
        x2: "72",
        y2: "50",
        stroke: "#ffffff",
        "stroke-width": "2.5",
        "stroke-linecap": "round",
      }),
    ),
    el("div", { className: "fx-shield-spark" }),
  );
}

function buildPierceNode(pierce, boardSize) {
  const cellSizePercent = 100 / boardSize;
  const centerX = ((pierce.coord.x + 0.5) / boardSize) * 100;
  const centerY = ((pierce.coord.y + 0.5) / boardSize) * 100;
  const sizePercent = cellSizePercent * 2.8;
  const gradId = `lance-grad-${pierce.id}`;

  return el(
    "div",
    {
      className: "fx-anchor",
      cssVars: {
        "--fx-x": `${centerX}%`,
        "--fx-y": `${centerY}%`,
        "--fx-size": `${sizePercent}%`,
      },
    },
    el("div", { className: "fx-pierce-ring" }),
    svgEl(
      "svg",
      {
        viewBox: "0 0 100 100",
        className: "fx-pierce-lance",
        "aria-hidden": "true",
      },
      svgEl(
        "defs",
        null,
        svgEl(
          "linearGradient",
          { id: gradId, x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
          svgEl("stop", { offset: "0%", "stop-color": "#ffffff" }),
          svgEl("stop", { offset: "50%", "stop-color": "#38bdf8" }),
          svgEl("stop", { offset: "100%", "stop-color": "#0284c7" }),
        ),
      ),
      svgEl("polygon", {
        points: "50,2 62,38 98,50 62,62 50,98 38,62 2,50 38,38",
        fill: `url(#${gradId})`,
        stroke: "#e0f2fe",
        "stroke-width": "2",
      }),
      svgEl("circle", { cx: "50", cy: "50", r: "7", fill: "#ffffff" }),
    ),
  );
}

function buildBlastNode(blast, boardSize) {
  const cellSizePercent = 100 / boardSize;
  const centerX = ((blast.center.x + 0.5) / boardSize) * 100;
  const centerY = ((blast.center.y + 0.5) / boardSize) * 100;
  const sizePercent = cellSizePercent * 3.4;

  return el(
    "div",
    {
      className: "fx-anchor",
      cssVars: {
        "--fx-x": `${centerX}%`,
        "--fx-y": `${centerY}%`,
        "--fx-size": `${sizePercent}%`,
      },
    },
    el("div", { className: "fx-bomb-shock" }),
    svgEl(
      "svg",
      {
        viewBox: "0 0 120 120",
        className: "fx-blast-ring",
        "aria-hidden": "true",
      },
      svgEl("circle", {
        cx: "60",
        cy: "60",
        r: "52",
        fill: "none",
        stroke: "#f97316",
        "stroke-width": "3",
        "stroke-dasharray": "8 6",
        opacity: "0.85",
      }),
    ),
    el("div", { className: "fx-bomb-core" }),
    ...EMBER_DIRECTIONS.map((dir) =>
      el("div", {
        className: "fx-ember",
        cssVars: { "--dx": `${dir.dx}px`, "--dy": `${dir.dy}px` },
      }),
    ),
  );
}

function buildAuraNode(aura, boardSize) {
  const cellSizePercent = 100 / boardSize;
  const centerX = ((aura.center.x + 0.5) / boardSize) * 100;
  const centerY = ((aura.center.y + 0.5) / boardSize) * 100;
  const sizePercent = cellSizePercent * 3.4;
  const gradId = `purify-grad-${aura.id}`;

  return el(
    "div",
    {
      className: "fx-anchor",
      cssVars: {
        "--fx-x": `${centerX}%`,
        "--fx-y": `${centerY}%`,
        "--fx-size": `${sizePercent}%`,
      },
    },
    el("div", { className: "fx-aura-pulse" }),
    svgEl(
      "svg",
      {
        viewBox: "0 0 100 100",
        className: "fx-purify-mandala",
        "aria-hidden": "true",
      },
      svgEl(
        "defs",
        null,
        svgEl(
          "linearGradient",
          { id: gradId, x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
          svgEl("stop", {
            offset: "0%",
            "stop-color": "#fef08a",
            "stop-opacity": "0.9",
          }),
          svgEl("stop", {
            offset: "50%",
            "stop-color": "#fbbf24",
            "stop-opacity": "0.75",
          }),
          svgEl("stop", {
            offset: "100%",
            "stop-color": "#d97706",
            "stop-opacity": "0.6",
          }),
        ),
      ),
      svgEl("circle", {
        cx: "50",
        cy: "50",
        r: "44",
        fill: "none",
        stroke: `url(#${gradId})`,
        "stroke-width": "2.5",
        "stroke-dasharray": "6 3",
      }),
      svgEl("circle", {
        cx: "50",
        cy: "50",
        r: "30",
        fill: "none",
        stroke: "#ffffff",
        "stroke-width": "1.5",
        opacity: "0.8",
      }),
      svgEl("rect", {
        x: "32",
        y: "32",
        width: "36",
        height: "36",
        fill: "none",
        stroke: "#fef08a",
        "stroke-width": "2",
      }),
      svgEl("rect", {
        x: "32",
        y: "32",
        width: "36",
        height: "36",
        fill: "none",
        stroke: "#fef08a",
        "stroke-width": "2",
        transform: "rotate(45 50 50)",
      }),
      svgEl("circle", { cx: "50", cy: "50", r: "10", fill: "#ffffff" }),
    ),
    ...STARDUST_OFFSETS.map((pt) =>
      el("div", {
        className: "fx-stardust",
        cssVars: {
          "--dx": `${pt.x}px`,
          "--dy": `${pt.y}px`,
          "--fx-delay": pt.delay,
        },
      }),
    ),
  );
}

export function createBoardOverlay() {
  const element = el("div", {
    className: "board-overlay",
    "aria-hidden": "true",
  });

  const maps = {
    bridges: new Map(),
    abyss: new Map(),
    shields: new Map(),
    pierce: new Map(),
    blasts: new Map(),
    auras: new Map(),
  };

  function update(vm) {
    const { boardSize } = vm;
    syncKeyedLayer(element, maps.bridges, vm.pioneerBridges, (b) =>
      buildBridgeNode(b, boardSize),
    );
    syncKeyedLayer(element, maps.abyss, vm.abyssVortices, (v) =>
      buildAbyssNode(v, boardSize),
    );
    syncKeyedLayer(element, maps.shields, vm.shieldRipples, (r) =>
      buildShieldNode(r, boardSize),
    );
    syncKeyedLayer(element, maps.pierce, vm.pierceStrikes, (p) =>
      buildPierceNode(p, boardSize),
    );
    syncKeyedLayer(element, maps.blasts, vm.blastWaves, (b) =>
      buildBlastNode(b, boardSize),
    );
    syncKeyedLayer(element, maps.auras, vm.auraPulses, (a) =>
      buildAuraNode(a, boardSize),
    );
  }

  return { element, update };
}

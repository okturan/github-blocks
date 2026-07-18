// Shared simulation/baking engine for the defense blocks. Everything here is
// plain string-building ESM — it runs identically in Node, GitHub Actions,
// and the browser (the configurator imports it for live previews).
//
// The trick all defense blocks share: run the game simulation to completion at
// generation time, then serialize every entity's timeline into CSS keyframes.
// The SVG that ships contains no code, only choreography.
import { svgShell, xml } from "./helpers.mjs";

export const PITCH = 15, CELL = 12, RX = 2.5, ROWS = 7;
export const f = (n) => +n.toFixed(2);
export const cellX = (c) => c * PITCH + CELL / 2;
export const cellY = (r) => r * PITCH + CELL / 2;
export const gridWidth = (cols) => cols * PITCH - (PITCH - CELL);

export const BASE_THEMES = {
  light: {
    bg: "#ffffff", fg: "#24292f", dim: "#8b949e",
    pal: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
  dark: {
    bg: "#0d1117", fg: "#e6edf3", dim: "#7d8590",
    pal: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Keyframe document. `anim` takes [time, props] pairs — times in seconds, or
// the strings "0"/"100" for explicit loop endpoints (always provide both:
// without them, CSS fills the gap by interpolating toward base values).
export function makeDoc(D) {
  let animId = 0;
  const css = [], els = [];
  const pct = (t) => Math.min(99.99, Math.max(0, (t / D) * 100));
  const anim = (frames, base) => {
    const name = "a" + (animId++).toString(36);
    const parts = frames
      .map(([t, p]) => [t === "0" ? 0 : t === "100" ? 100 : pct(t), p])
      .sort((a, b) => a[0] - b[0])
      .map(([p, s]) => `${p.toFixed(3)}%{${s}}`).join("");
    css.push(`@keyframes ${name}{${parts}}`);
    return `animation:${name} ${D}s linear infinite;${base || ""}`;
  };
  const el = (tag, attrs, style) => {
    const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
    els.push(`<${tag} ${a}${style ? ` style="${style}"` : ""}/>`);
  };
  return { D, css, els, anim, el, raw: (s) => els.push(s), lift: () => els.splice(0), pct };
}

// Laser flash from tower to target: translucent glow line + bright core.
export function beam(doc, x1, y1, x2, y2, t, color, dur = 0.13) {
  const frames = [["0", "opacity:0"], [t - 0.01, "opacity:0"], [t, "opacity:1"], [t + dur, "opacity:0"], ["100", "opacity:0"]];
  el2(doc, { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), stroke: color, "stroke-width": 5, "stroke-opacity": 0.25, "stroke-linecap": "round" }, doc.anim(frames, "opacity:0"));
  el2(doc, { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), stroke: color, "stroke-width": 2, "stroke-linecap": "round" }, doc.anim(frames, "opacity:0"));
}
function el2(doc, attrs, style) { doc.el("line", attrs, style); }

// Six particles flying outward from a death.
export function burst(doc, x, y, t, color, rnd, n = 6, dist = 14) {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const d = dist * (0.7 + rnd() * 0.6);
    doc.el("circle", { cx: 0, cy: 0, r: f(2 + rnd() * 1.2), fill: color }, doc.anim([
      ["0", "opacity:0"],
      [t - 0.01, `opacity:0;transform:translate(${f(x)}px,${f(y)}px) scale(1)`],
      [t, "opacity:1"],
      [t + 0.45, `opacity:0;transform:translate(${f(x + Math.cos(ang) * d)}px,${f(y + Math.sin(ang) * d)}px) scale(0.3)`],
      ["100", "opacity:0"],
    ], "opacity:0"));
  }
}

// White overlay circle that blinks at each recorded hit time.
export function hitFlash(doc, hits, r) {
  if (!hits.length) return "";
  const frames = [["0", "opacity:0"]];
  for (const t of hits) frames.push([t - 0.01, "opacity:0"], [t, "opacity:0.9"], [t + 0.09, "opacity:0"]);
  frames.push(["100", "opacity:0"]);
  return `<circle r="${f(r)}" fill="#ffffff" style="${doc.anim(frames, "opacity:0")}"/>`;
}

export function drawCells(doc, grid, pal, cellStyle) {
  for (let c = 0; c < grid.length; c++) for (let r = 0; r < ROWS; r++) {
    const style = cellStyle && cellStyle(c, r, grid[c][r]);
    doc.el("rect", { x: c * PITCH, y: r * PITCH, width: CELL, height: CELL, rx: RX, fill: pal[grid[c][r]] }, style || undefined);
  }
}

export function towerMarkers(doc, towers, ring, core) {
  for (const tw of towers) {
    doc.el("circle", { cx: tw.x, cy: tw.y, r: 3.2, fill: "none", stroke: ring, "stroke-width": 1.2 });
    doc.el("circle", { cx: tw.x, cy: tw.y, r: 1.5, fill: core });
  }
}

export function muzzles(doc, towers, color) {
  for (const tw of towers) {
    if (!tw.fires.length) continue;
    const frames = [["0", "opacity:0"]];
    for (const t of tw.fires) frames.push([t - 0.01, "opacity:0"], [t, "opacity:0.9"], [t + 0.16, "opacity:0"]);
    frames.push(["100", "opacity:0"]);
    doc.el("rect", { x: tw.c * PITCH - 1, y: tw.r * PITCH - 1, width: CELL + 2, height: CELL + 2, rx: RX + 1, fill: color }, doc.anim(frames, "opacity:0"));
  }
}

// Tower selection: level-3+ days garrison the graph; sparse profiles promote
// level-2 days up to `min`, dense ones get thinned to `max`. `keep` optionally
// restricts candidates (e.g. within range of a path).
export function pickTowers(grid, { minLevel = 3, promoteLevel = 2, min = 8, max = 30, keep } = {}) {
  const sites = [];
  for (let c = 0; c < grid.length; c++) for (let r = 0; r < ROWS; r++) {
    const lvl = grid[c][r];
    if (lvl < promoteLevel) continue;
    const x = cellX(c), y = cellY(r);
    if (keep && !keep(x, y)) continue;
    sites.push({ c, r, lvl, x, y });
  }
  let towers = sites.filter((s) => s.lvl >= minLevel);
  if (towers.length < min) towers = towers.concat(sites.filter((s) => s.lvl < minLevel)).slice(0, min);
  if (towers.length > max) towers = towers.filter((_, i) => i % Math.ceil(towers.length / max) === 0);
  return towers.map((s) => ({ ...s, cd: 0, fires: [] }));
}

// Enemy HP multiplier so a heavy committer's 30 towers don't trivialize waves
// tuned against a 14-tower graph.
export function hpScale(towerCount, baseline = 14) {
  return Math.min(Math.max(towerCount / baseline, 0.75), 2.2);
}

// Polyline path with arc-length lookup, for road-following blocks.
export function makePath(waypoints) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [x1, y1] = waypoints[i], [x2, y2] = waypoints[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, len, s0: total });
    total += len;
  }
  const at = (s) => {
    let g = segs[0];
    if (s > 0) {
      g = segs.find((sg) => s <= sg.s0 + sg.len) ?? segs[segs.length - 1];
    }
    const k = (s - g.s0) / g.len;
    return [g.x1 + (g.x2 - g.x1) * k, g.y1 + (g.y2 - g.y1) * k];
  };
  const dists = (x, y) => {
    let best = 1e9;
    for (const g of segs) {
      const vx = g.x2 - g.x1, vy = g.y2 - g.y1;
      const t = Math.max(0, Math.min(1, ((x - g.x1) * vx + (y - g.y1) * vy) / (g.len * g.len)));
      best = Math.min(best, Math.hypot(x - (g.x1 + vx * t), y - (g.y1 + vy * t)));
    }
    return best;
  };
  return { segs, total, at, dists, breakS: segs.map((g) => g.s0).concat(total) };
}

// Transform keyframes for constant-speed travel along a path, clipped to
// [tA, tB]. Emits a frame at every waypoint crossing — linear interpolation
// between them is exact.
export function pathFrames(path, v, t0, tA, tB) {
  const frames = [];
  const times = path.breakS.map((s) => t0 + s / v).filter((t) => t > tA && t < tB);
  for (const t of [tA, ...times, tB]) {
    const [x, y] = path.at((t - t0) * v);
    frames.push([t, `transform:translate(${f(x)}px,${f(y)}px)`]);
  }
  return frames;
}

// Common frame: background card, mono header, the baked keyframes, and a
// reduced-motion pause. Width defaults to GitHub's README column.
export function defenseShell({ doc, theme, cols, title, subtitle, ariaLabel, width = 896 }) {
  const GW = gridWidth(cols);
  const vbW = GW + 20, vbH = ROWS * PITCH + 48;
  const body = `<rect x="-10" y="-36" width="${vbW}" height="${vbH}" rx="6" fill="${theme.bg}"/>
  <text class="td-t" x="0" y="-16" font-size="11" fill="${theme.fg}" letter-spacing="2">${xml(title)}</text>
  <text class="td-t" x="${GW}" y="-16" font-size="8" fill="${theme.dim}" text-anchor="end" letter-spacing="1">${xml(subtitle)}</text>
  ${doc.els.join("\n")}`;
  return svgShell({
    width,
    height: Math.round(width * (vbH / vbW)),
    viewBox: `-10 -36 ${vbW} ${vbH}`,
    ariaLabel,
    extraStyle: `*{transform-box:fill-box}.td-t{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:700}@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}${doc.css.join("")}`,
    body,
  });
}

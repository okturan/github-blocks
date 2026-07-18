// Boss Fight — the snk snake returns as the boss. It serpentines through the
// graph eating commit cells while every fortified day (level 2+) fires on it.
// Three endings, mapped to level 1–3: ROUT (the snake dies early), LAST STAND
// (it goes down at ~86% of its run), CONSUMED (the towers can't stop it and
// the graph gets eaten). Deterministic given (grid, level); seed only jitters
// particles.
import {
  BASE_THEMES, ROWS, PITCH, f, cellX, cellY, gridWidth, mulberry32,
  makeDoc, beam, burst, drawCells, towerMarkers, muzzles,
  pickTowers, makePath, pathFrames, defenseShell,
} from "../lib/engine.mjs";

export const ENDINGS = [
  { name: "ROUT", frac: 0.55 },
  { name: "LAST STAND", frac: 0.86 },
  { name: "CONSUMED", frac: Infinity },
];

const ACCENTS = {
  dark: {
    snake: "#a371f7", head: "#d2a8ff", laser: "#f85149",
    turret: "#f0883e", ring: "#0d1117", muzzle: "#f8514933",
    bar: "#a371f7", barBg: "#21262d", barLine: "#30363d",
    win: "#39d353", lose: "#f85149",
  },
  light: {
    snake: "#8250df", head: "#a371f7", laser: "#cf222e",
    turret: "#0a3069", ring: "#ffffff", muzzle: "#ffebe9",
    bar: "#8250df", barBg: "#eaeef2", barLine: "#d0d7de",
    win: "#1a7f37", lose: "#cf222e",
  },
};

const RANGE = 58, COOLDOWN = 1.0, SPEED = 165, DT = 0.04, SEGS = 9, GAP = 14;

export function bossFight(grid, {
  level = 2,
  seed = 1337,
  theme = "dark",
  title = "BOSS FIGHT",
  width = 896,
  onStats,
} = {}) {
  if (!Array.isArray(grid) || !grid.length || grid[0].length !== ROWS) {
    throw new Error("grid must be weeks × 7 array of levels 0–4 (see lib/contrib.mjs)");
  }
  const ending = ENDINGS[Math.min(Math.max(level, 1), ENDINGS.length) - 1];
  const th = { ...(BASE_THEMES[theme] ?? BASE_THEMES.dark), ...(ACCENTS[theme] ?? ACCENTS.dark) };
  const rnd = mulberry32(seed);
  const cols = grid.length;
  const GW = gridWidth(cols);

  const tailRoom = 40 + SEGS * GAP;
  const path = makePath([
    [-tailRoom, cellY(0)], [cellX(cols - 1), cellY(0)], [cellX(cols - 1), cellY(2)],
    [cellX(0), cellY(2)], [cellX(0), cellY(4)], [cellX(cols - 1), cellY(4)],
    [cellX(cols - 1), cellY(6)], [-tailRoom, cellY(6)],
  ]);
  const tExit = (path.total + tailRoom) / SPEED;

  const towers = pickTowers(grid, { minLevel: 2, min: 8, max: 40 });

  // Every hit that could land, in order — then the ending decides how many do.
  const potential = [];
  for (let t = 0; t < tExit; t += DT) {
    const [hx, hy] = path.at(t * SPEED);
    for (const tw of towers) {
      tw.cd -= DT;
      if (tw.cd > 0) continue;
      if (Math.hypot(hx - tw.x, hy - tw.y) > RANGE) continue;
      tw.cd = COOLDOWN;
      potential.push({ t, tw, hx, hy });
    }
  }
  const snakeWins = ending.frac > 1;
  const maxHP = snakeWins ? Math.ceil(potential.length * 1.35) : Math.max(1, Math.ceil(potential.length * ending.frac));
  const landed = snakeWins ? potential : potential.slice(0, maxHP);
  const deathT = snakeWins ? null : landed[landed.length - 1].t;
  const endT = snakeWins ? tExit : deathT;
  const D = Math.ceil(endT + 4.2);
  const doc = makeDoc(D);

  // Grid — the head eats level-1/2 cells on its rows as it passes (fortified
  // tower cells hold). If the snake dies first, cells past that point survive.
  const towerAt = new Set(towers.map((tw) => tw.c + ":" + tw.r));
  drawCells(doc, grid, th.pal, (c, r, lvl) => {
    if (lvl === 0 || r % 2 !== 0 || towerAt.has(c + ":" + r)) return null;
    let sAt = null;
    for (const g of path.segs) {
      if (Math.abs(g.y1 - cellY(r)) < 1 && Math.abs(g.y2 - cellY(r)) < 1) {
        const k = (cellX(c) - g.x1) / (g.x2 - g.x1);
        if (k >= 0 && k <= 1) sAt = g.s0 + k * g.len;
      }
    }
    if (sAt === null) return null;
    const t = sAt / SPEED;
    if (deathT !== null && t >= deathT) return null;
    return doc.anim([
      ["0", `fill:${th.pal[lvl]}`],
      [t - 0.01, `fill:${th.pal[lvl]}`],
      [t + 0.1, `fill:${th.pal[0]}`],
      ["100", `fill:${th.pal[0]}`],
    ]);
  });
  towerMarkers(doc, towers, th.ring, th.turret);

  // Snake segments trail the head; on death they pop in a ripple, on a win
  // they slither off the far end intact.
  for (let i = SEGS - 1; i >= 0; i--) {
    const off = (i * GAP) / SPEED;
    const tEnd = snakeWins ? off + (path.total + tailRoom + 10) / SPEED : deathT + i * 0.05;
    const frames = [
      ["0", "opacity:0"], [off, "opacity:0"], [off + 0.03, "opacity:1"],
      ...pathFrames(path, SPEED, off, off, tEnd),
      [tEnd, "opacity:1"],
    ];
    const [dx, dy] = path.at((tEnd - off) * SPEED);
    if (snakeWins) frames.push([tEnd + 0.01, "opacity:0"]);
    else frames.push([tEnd + 0.25, `opacity:0;transform:translate(${f(dx)}px,${f(dy)}px) scale(1.9)`]);
    frames.push(["100", "opacity:0"]);
    const isHead = i === 0;
    const size = isHead ? 13 : 11.5 - i * 0.35;
    const color = isHead ? th.head : th.snake;
    let inner = `<rect x="${f(-size / 2)}" y="${f(-size / 2)}" width="${f(size)}" height="${f(size)}" rx="3.6" fill="${color}"/>`;
    if (isHead) inner += `<circle cx="2.6" cy="-2.4" r="1.5" fill="${th.bg}"/><circle cx="2.6" cy="2.4" r="1.5" fill="${th.bg}"/>`;
    doc.raw(`<g style="${doc.anim(frames, "opacity:0")}">${inner}</g>`);
    if (!snakeWins && i < 4) burst(doc, dx, dy, tEnd + 0.1, color, rnd, 7, 18);
  }

  // Lasers, and a white flash that rides the head and blinks per hit.
  const flash = [["0", "opacity:0"]];
  for (const h of landed) {
    beam(doc, h.tw.x, h.tw.y, h.hx, h.hy, h.t, th.laser, 0.1);
    h.tw.fires.push(h.t);
    flash.push([h.t - 0.01, "opacity:0"], [h.t, "opacity:0.85"], [h.t + 0.07, "opacity:0"]);
  }
  flash.push(["100", "opacity:0"]);
  const ride = [
    ["0", "opacity:0"], [0.01, "opacity:1"],
    ...pathFrames(path, SPEED, 0, 0, endT),
    [endT, "opacity:1"], [endT + 0.01, "opacity:0"], ["100", "opacity:0"],
  ];
  doc.raw(`<g style="${doc.anim(ride, "opacity:0")}"><circle r="8" fill="#ffffff" style="${doc.anim(flash, "opacity:0")}"/></g>`);
  muzzles(doc, towers, th.muzzle);

  // Boss HP bar, top right.
  const BW = 200;
  const hpFrames = [["0", "transform:scaleX(1)"]];
  landed.forEach((h, i) => {
    hpFrames.push([h.t - 0.01, `transform:scaleX(${((maxHP - i) / maxHP).toFixed(4)})`]);
    hpFrames.push([h.t + 0.02, `transform:scaleX(${((maxHP - i - 1) / maxHP).toFixed(4)})`]);
  });
  hpFrames.push(["100", `transform:scaleX(${snakeWins ? ((maxHP - landed.length) / maxHP).toFixed(4) : 0})`]);
  doc.raw(`<g transform="translate(${GW - BW},-26)">` +
    `<text class="td-t" x="-8" y="8" font-size="8" fill="${th.head}" text-anchor="end" letter-spacing="1">BOSS · THE SNK</text>` +
    `<rect width="${BW}" height="8" rx="4" fill="${th.barBg}"/>` +
    `<rect width="${BW}" height="8" rx="4" fill="${th.bar}" style="transform-origin:left center;${doc.anim(hpFrames, "")}"/>` +
    `<rect width="${BW}" height="8" rx="4" fill="none" stroke="${th.barLine}"/></g>`);

  // Verdict stamp.
  const verdict = snakeWins ? "GRAPH CONSUMED" : "GRAPH DEFENDED";
  const verdictColor = snakeWins ? th.lose : th.win;
  doc.raw(`<text class="td-t" x="${GW / 2}" y="${(ROWS * PITCH) / 2 + 4}" font-size="16" fill="${verdictColor}" text-anchor="middle" letter-spacing="6" style="${doc.anim([
    ["0", "opacity:0"], [endT + 0.6, "opacity:0"], [endT + 0.9, "opacity:1"], [D - 0.5, "opacity:1"], [D - 0.1, "opacity:0"], ["100", "opacity:0"],
  ], "opacity:0")}">${verdict}</text>`);

  onStats?.({ towers: towers.length, bossHP: maxHP, hits: landed.length, ending: ending.name, duration: D });

  return defenseShell({
    doc, theme: th, cols, title, width,
    subtitle: "", // the HP bar owns the top-right corner

    ariaLabel: snakeWins
      ? `Boss fight over a GitHub contribution graph: a snake eats the commit cells while ${towers.length} towers land ${landed.length} hits — not enough; the graph is consumed`
      : `Boss fight over a GitHub contribution graph: ${towers.length} towers fire on a snake eating the commit cells and destroy it after ${landed.length} hits; the graph is defended`,
  });
}

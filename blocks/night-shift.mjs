// Night Shift — creeps follow a serpentine road carved through the graph
// (Monday row out, Wednesday back, Friday out). Towers within range of the
// road fire plasma bolts with real intercept leads: each bolt is aimed at
// where its target will be when the bolt lands, 0.22s after firing.
import {
  BASE_THEMES, ROWS, f, cellX, cellY, gridWidth, mulberry32,
  makeDoc, burst, hitFlash, drawCells, towerMarkers, muzzles,
  pickTowers, hpScale, makePath, pathFrames, defenseShell,
} from "../lib/engine.mjs";

export const LEVELS = [
  { name: "PATROL", waves: 2, perWave: 6, waveGap: 11, hp: [4, 6, 9], speed: [95, 120], cooldown: 1.35, mix: [0.55, 0.85] },
  { name: "SIEGE", waves: 2, perWave: 9, waveGap: 13, hp: [7, 11, 16], speed: [95, 120], cooldown: 1.7, mix: [0.5, 0.8] },
  { name: "OVERRUN", waves: 3, perWave: 9, waveGap: 12, hp: [9, 14, 20], speed: [100, 125], cooldown: 1.8, mix: [0.4, 0.7] },
];

const ACCENTS = {
  dark: {
    turret: "#39d353", ring: "#0d1117", muzzle: "#2ea04366",
    boltGlow: "#39d353", boltCore: "#aff5b4",
    road: ["#21262d", "#30363d"],
    creeps: ["#f778ba", "#d29922", "#ff7b72"],
  },
  light: {
    turret: "#0a3069", ring: "#ffffff", muzzle: "#dafbe1",
    boltGlow: "#1a7f37", boltCore: "#116329",
    road: ["#eaeef2", "#afb8c1"],
    creeps: ["#bf3989", "#9a6700", "#cf222e"],
  },
};

const RANGE = 56, FLY = 0.22, DT = 0.05;

export function nightShift(grid, {
  level = 2,
  seed = 1337,
  theme = "dark",
  title = "NIGHT SHIFT",
  width = 896,
  onStats,
} = {}) {
  if (!Array.isArray(grid) || !grid.length || grid[0].length !== ROWS) {
    throw new Error("grid must be weeks × 7 array of levels 0–4 (see lib/contrib.mjs)");
  }
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];
  const th = { ...(BASE_THEMES[theme] ?? BASE_THEMES.dark), ...(ACCENTS[theme] ?? ACCENTS.dark) };
  const rnd = mulberry32(seed);
  const cols = grid.length;
  const GW = gridWidth(cols);

  const path = makePath([
    [-20, cellY(1)], [cellX(cols - 2), cellY(1)], [cellX(cols - 2), cellY(3)],
    [cellX(1), cellY(3)], [cellX(1), cellY(5)], [GW + 20, cellY(5)],
  ]);

  const towers = pickTowers(grid, { min: 6, max: 24, keep: (x, y) => path.dists(x, y) <= RANGE + 4 });
  const scale = hpScale(towers.length);

  const enemies = [];
  for (let w = 0; w < cfg.waves; w++) for (let i = 0; i < cfg.perWave; i++) {
    const roll = rnd();
    const tier = roll < cfg.mix[0] ? 0 : roll < cfg.mix[1] ? 1 : 2;
    const hp = Math.max(1, Math.round(cfg.hp[tier] * scale));
    enemies.push({
      t0: 1 + w * cfg.waveGap + i * 0.6 + rnd() * 0.4,
      v: cfg.speed[0] + rnd() * (cfg.speed[1] - cfg.speed[0]),
      hp, pend: hp, tier, hits: [], death: null, exitT: null, alive: true,
    });
  }
  const lastT0 = Math.max(...enemies.map((e) => e.t0));
  const D = Math.ceil(lastT0 + (path.total + 30) / cfg.speed[0] + 1.5);
  const doc = makeDoc(D);

  const impacts = [];
  for (let t = 0; t < D - 1; t += DT) {
    for (const e of enemies) {
      if (!e.alive || t < e.t0) continue;
      e.s = (t - e.t0) * e.v;
      if (e.s > path.total && !e.exitT) { e.exitT = t; e.alive = false; }
    }
    for (const im of impacts) {
      if (im.done || t < im.tHit) continue;
      im.done = true;
      const e = im.e;
      if (e.alive) {
        e.hits.push(im.tHit);
        if (--e.hp <= 0) {
          e.alive = false;
          const [x, y] = path.at((im.tHit - e.t0) * e.v);
          e.death = { t: im.tHit, x, y };
        }
      }
    }
    for (const tw of towers) {
      tw.cd -= DT;
      if (tw.cd > 0) continue;
      let best = null;
      for (const e of enemies) {
        if (!e.alive || t < e.t0 || e.pend <= 0) continue;
        const [x, y] = path.at(e.s);
        if (Math.hypot(x - tw.x, y - tw.y) > RANGE) continue;
        if (!best || e.s > best.s) best = e;
      }
      if (best) {
        tw.cd = cfg.cooldown;
        tw.fires.push(t);
        best.pend--;
        impacts.push({ e: best, tHit: t + FLY, done: false });
        const [hx, hy] = path.at((t + FLY - best.t0) * best.v); // exact intercept
        const bolt = doc.anim([
          ["0", "opacity:0"],
          [t - 0.01, `opacity:0;transform:translate(${f(tw.x)}px,${f(tw.y)}px)`],
          [t, "opacity:1"],
          [t + FLY, `opacity:1;transform:translate(${f(hx)}px,${f(hy)}px)`],
          [t + FLY + 0.02, "opacity:0"],
          ["100", "opacity:0"],
        ], "opacity:0");
        doc.raw(`<g style="${bolt}"><circle r="3.4" fill="${th.boltGlow}" opacity="0.3"/><circle r="1.7" fill="${th.boltCore}"/></g>`);
      }
    }
  }
  const kills = enemies.filter((e) => e.death).length;

  // Bolts were emitted during the sim; lift them above road + grid.
  const boltEls = doc.lift();
  const d = `M -20 ${cellY(1)} H ${cellX(cols - 2)} V ${cellY(3)} H ${cellX(1)} V ${cellY(5)} H ${GW + 20}`;
  doc.raw(`<path d="${d}" fill="none" stroke="${th.road[0]}" stroke-width="13" stroke-linejoin="round"/>`);
  doc.raw(`<path d="${d}" fill="none" stroke="${th.road[1]}" stroke-width="1" stroke-dasharray="3 5" stroke-linejoin="round"/>`);
  drawCells(doc, grid, th.pal);
  towerMarkers(doc, towers, th.ring, th.turret);
  for (const tw of towers) doc.el("circle", { cx: tw.x, cy: tw.y, r: RANGE, fill: "none", stroke: th.boltGlow, "stroke-opacity": 0.07 });
  muzzles(doc, towers, th.muzzle);
  doc.els.push(...boltEls);

  for (const e of enemies) {
    const tEnd = e.death ? e.death.t : Math.min(e.exitT ?? (e.t0 + (path.total + 10) / e.v), D - 0.3);
    const frames = [
      ["0", "opacity:0"], [e.t0, "opacity:0"], [e.t0 + 0.05, "opacity:1"],
      ...pathFrames(path, e.v, e.t0, e.t0, tEnd),
      [tEnd - 0.01, "opacity:1"], [tEnd + 0.01, "opacity:0"], ["100", "opacity:0"],
    ];
    const s = [4.4, 5, 6][e.tier], color = th.creeps[e.tier];
    doc.raw(`<g style="${doc.anim(frames, "opacity:0")}">` +
      `<rect x="${-s}" y="${-s}" width="${2 * s}" height="${2 * s}" rx="1.5" fill="${color}" transform="rotate(45)"/>` +
      `<circle r="${f(s * 0.35)}" fill="${th.bg}"/>` +
      hitFlash(doc, e.hits, s + 1.6) + `</g>`);
    if (e.death) burst(doc, e.death.x, e.death.y, e.death.t, color, rnd, 7, 16);
  }

  onStats?.({ towers: towers.length, enemies: enemies.length, kills, leaked: enemies.length - kills, duration: D });

  return defenseShell({
    doc, theme: th, cols, title, width,
    subtitle: `LVL ${level} ${cfg.name} · ${towers.length} TOWERS · ${kills}/${enemies.length} DOWN`,
    ariaLabel: `Tower defense over a GitHub contribution graph: ${enemies.length} creeps follow a winding road through the graph while towers fire plasma bolts; ${kills} destroyed, ${enemies.length - kills} escape`,
  });
}

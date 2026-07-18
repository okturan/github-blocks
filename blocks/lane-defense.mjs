// Lane Defense — bug waves march straight down the weekday rows; towers on
// big commit days shoot lasers at whatever's in range. Pure function of
// (grid, opts): same grid + level + seed → the identical battle.
import {
  BASE_THEMES, PITCH, CELL, ROWS, f, cellY, gridWidth, mulberry32,
  makeDoc, beam, burst, hitFlash, drawCells, towerMarkers, muzzles,
  pickTowers, hpScale, defenseShell,
} from "../lib/engine.mjs";

export const LEVELS = [
  { name: "PATROL", waves: 3, perWave: 5, waveGap: 7, hp: [2, 3, 5], speed: [42, 60], cooldown: 1.55, mix: [0.55, 0.85] },
  { name: "SIEGE", waves: 4, perWave: 6, waveGap: 7.5, hp: [4, 6, 10], speed: [45, 63], cooldown: 1.8, mix: [0.45, 0.75] },
  { name: "OVERRUN", waves: 5, perWave: 7, waveGap: 8, hp: [5, 8, 13], speed: [48, 68], cooldown: 1.9, mix: [0.35, 0.65] },
];

const ACCENTS = {
  light: { turret: "#0a3069", ring: "#ffffff", laser: "#1a7f37", muzzle: "#dafbe1", bugs: ["#fa4549", "#e16f24", "#8250df"] },
  dark: { turret: "#f0883e", ring: "#0d1117", laser: "#39d353", muzzle: "#2ea04366", bugs: ["#f85149", "#d29922", "#a371f7"] },
};

const RANGE = 50, DT = 0.05;

export function laneDefense(grid, {
  level = 2,
  seed = 1337,
  theme = "dark",
  title = "COMMIT DEFENSE",
  width = 896,
  onStats,
} = {}) {
  if (!Array.isArray(grid) || !grid.length || grid[0].length !== ROWS) {
    throw new Error("grid must be weeks × 7 array of levels 0–4 (see lib/contrib.mjs)");
  }
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];
  const th = { ...(BASE_THEMES[theme] ?? BASE_THEMES.dark), ...(ACCENTS[theme] ?? ACCENTS.dark) };
  const rnd = mulberry32(seed);
  const GW = gridWidth(grid.length);

  const towers = pickTowers(grid);
  const scale = hpScale(towers.length);

  const enemies = [];
  for (let w = 0; w < cfg.waves; w++) for (let i = 0; i < cfg.perWave; i++) {
    const roll = rnd();
    const tier = roll < cfg.mix[0] ? 0 : roll < cfg.mix[1] ? 1 : 2;
    enemies.push({
      t0: 1 + w * cfg.waveGap + i * 0.55 + rnd() * 0.35,
      row: Math.floor(rnd() * ROWS),
      v: cfg.speed[0] + rnd() * (cfg.speed[1] - cfg.speed[0]),
      hp: Math.max(1, Math.round(cfg.hp[tier] * scale)),
      tier, hits: [], death: null, exitT: null, alive: true,
    });
  }
  const lastT0 = Math.max(...enemies.map((e) => e.t0));
  const D = Math.ceil(lastT0 + (GW + 46) / cfg.speed[0] + 1.3);
  const doc = makeDoc(D);

  for (let t = 0; t < D - 1; t += DT) {
    for (const e of enemies) {
      if (!e.alive || t < e.t0) continue;
      e.x = -16 + (t - e.t0) * e.v;
      e.y = cellY(e.row);
      if (e.x > GW + 14 && !e.exitT) { e.exitT = t; e.alive = false; }
    }
    for (const tw of towers) {
      tw.cd -= DT;
      if (tw.cd > 0) continue;
      let best = null;
      for (const e of enemies) {
        if (!e.alive || t < e.t0 || e.x === undefined) continue;
        if (Math.hypot(e.x - tw.x, e.y - tw.y) > RANGE) continue;
        if (!best || e.x > best.x) best = e;
      }
      if (best) {
        tw.cd = cfg.cooldown;
        tw.fires.push(t);
        beam(doc, tw.x, tw.y, best.x, best.y, t, th.laser);
        best.hits.push(t);
        if (--best.hp <= 0) { best.alive = false; best.death = { t, x: best.x, y: best.y }; }
      }
    }
  }
  const kills = enemies.filter((e) => e.death).length;

  // Beams were emitted during the sim; lift them above the grid cells.
  const beamEls = doc.lift();
  drawCells(doc, grid, th.pal);
  towerMarkers(doc, towers, th.ring, th.turret);
  muzzles(doc, towers, th.muzzle);
  doc.els.push(...beamEls);

  for (const e of enemies) {
    const tEnd = e.death ? e.death.t : Math.min(e.exitT ?? (e.t0 + (GW + 30) / e.v), D - 0.3);
    const xEnd = e.death ? e.death.x : -16 + (tEnd - e.t0) * e.v;
    const y = cellY(e.row), color = th.bugs[e.tier], r = [4, 4.6, 5.4][e.tier];
    const move = doc.anim([
      ["0", `opacity:0;transform:translate(-16px,${f(y)}px)`],
      [e.t0, `opacity:0;transform:translate(-16px,${f(y)}px)`],
      [e.t0 + 0.05, "opacity:1"],
      [tEnd, `opacity:1;transform:translate(${f(xEnd)}px,${f(y)}px)`],
      [tEnd + 0.01, "opacity:0"],
      ["100", "opacity:0"],
    ], "opacity:0");
    doc.raw(`<g style="${move}">` +
      `<ellipse rx="${r}" ry="${f(r * 0.78)}" fill="${color}"/>` +
      `<circle cx="${f(r * 0.85)}" cy="0" r="${f(r * 0.55)}" fill="${color}"/>` +
      `<circle cx="${f(r * 0.95)}" cy="-1" r="0.9" fill="#ffffff"/>` +
      hitFlash(doc, e.hits, r + 1.5) + `</g>`);
    if (e.death) burst(doc, e.death.x, e.death.y, e.death.t, color, rnd);
  }

  onStats?.({ towers: towers.length, enemies: enemies.length, kills, leaked: enemies.length - kills, duration: D });

  return defenseShell({
    doc, theme: th, cols: grid.length, title, width,
    subtitle: `LVL ${level} ${cfg.name} · ${towers.length} TOWERS · ${kills}/${enemies.length} DOWN`,
    ariaLabel: `Tower defense over a GitHub contribution graph: towers on big commit days shoot lasers at ${enemies.length} bug creeps marching along the weekday rows; ${kills} destroyed, ${enemies.length - kills} slip through`,
  });
}

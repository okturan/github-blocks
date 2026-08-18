// Lane Defense — bug waves march straight down the weekday rows; towers on
// big commit days shoot lasers at whatever's in range. Level-4 days are
// fortresses (double damage + splash). Hits slow their target. Pure function
// of (grid, opts): same grid + level + seed → the identical battle.
import {
  BASE_THEMES, PITCH, ROWS, f, cellY, gridWidth, mulberry32,
  makeDoc, beam, burst, ringPulse, hitFlash, drawCells, muzzles,
  pickTowers, hpScale, defenseShell,
} from "../lib/engine.mjs";

export const LEVELS = [
  { name: "PATROL", waves: 3, perWave: 5, waveGap: 7, hp: [2, 3, 6], speed: [42, 60], cooldown: 1.55, mix: [0.55, 0.85] },
  { name: "SIEGE", waves: 4, perWave: 6, waveGap: 7.5, hp: [6, 9, 15], speed: [46, 64], cooldown: 1.85, mix: [0.4, 0.7] },
  { name: "OVERRUN", waves: 5, perWave: 7, waveGap: 8, hp: [8, 12, 20], speed: [50, 70], cooldown: 2.0, mix: [0.3, 0.58] },
];

const ACCENTS = {
  light: {
    turret: "#0a3069", ring: "#ffffff", laser: "#1a7f37", muzzle: "#dafbe1",
    bugs: ["#fa4549", "#e16f24", "#8250df"],
    core: "#1a7f37", coreBg: "#d0d7de", splash: "#1a7f37",
    win: "#1a7f37", lose: "#cf222e",
  },
  dark: {
    turret: "#f0883e", ring: "#0d1117", laser: "#39d353", muzzle: "#2ea04366",
    bugs: ["#f85149", "#d29922", "#a371f7"],
    core: "#39d353", coreBg: "#21262d", splash: "#56d364",
    win: "#39d353", lose: "#f85149",
  },
};

const RANGE = 50, DT = 0.05, SLOW = 0.52, SLOW_DUR = 0.42, CORE_HP = 8;
const TIER_SPEED = [1.28, 1, 0.86];

function arm(tw) {
  const fortress = tw.lvl >= 4;
  return {
    ...tw,
    range: fortress ? 58 : tw.lvl >= 3 ? RANGE : 42,
    dmg: fortress ? 2 : 1,
    splash: fortress ? 22 : 0,
    cdMul: fortress ? 0.84 : tw.lvl >= 3 ? 1 : 1.18,
  };
}

function hurt(e, t, amount) {
  if (!e.alive) return false;
  e.hits.push(t);
  e.hp -= amount;
  e.hpAt.push([t, Math.max(0, e.hp)]);
  const was = t < e.slowUntil;
  e.slowUntil = t + SLOW_DUR;
  if (!was) e.motion.push([t, e.x]);
  if (e.hp <= 0) {
    e.alive = false;
    e.death = { t, x: e.x, y: e.y };
    return true;
  }
  return false;
}

function bugMark(tier, color) {
  if (tier === 0) {
    return `<ellipse rx="4.4" ry="2.5" fill="${color}"/>` +
      `<circle cx="3.4" cy="0" r="1.55" fill="${color}"/>` +
      `<circle cx="3.85" cy="-0.55" r="0.5" fill="#ffffff"/>`;
  }
  if (tier === 2) {
    return `<rect x="-5.4" y="-4.4" width="10.8" height="8.8" rx="2.1" fill="${color}"/>` +
      `<rect x="-3.5" y="-2.5" width="7" height="5" rx="1.1" fill="#ffffff" fill-opacity="0.18"/>` +
      `<circle cx="3.2" cy="-1.1" r="0.75" fill="#ffffff"/>`;
  }
  return `<ellipse rx="4.5" ry="3.5" fill="${color}"/>` +
    `<circle cx="3.7" cy="0" r="2.15" fill="${color}"/>` +
    `<circle cx="4.15" cy="-0.75" r="0.7" fill="#ffffff"/>` +
    `<path d="M-2.2 3.3 L-4.4 5.1 M0.4 3.5 L-0.6 5.2" fill="none" stroke="${color}" stroke-width="0.95" stroke-linecap="round"/>`;
}

function drawTurret(doc, tw, th, rangeRings) {
  const fortress = tw.lvl >= 4;
  const r = fortress ? 3.55 : tw.lvl >= 3 ? 3.15 : 2.75;
  const fill = fortress ? th.laser : th.turret;
  if (rangeRings && fortress) {
    doc.el("circle", { cx: tw.x, cy: tw.y, r: tw.range, fill: "none", stroke: th.laser, "stroke-opacity": 0.08 });
    doc.el("circle", { cx: tw.x, cy: tw.y, r: f(r + 2.3), fill: "none", stroke: th.laser, "stroke-width": 0.85, "stroke-opacity": 0.45 });
  }
  doc.el("circle", { cx: tw.x, cy: tw.y, r, fill: "none", stroke: th.ring, "stroke-width": fortress ? 1.45 : 1.2 });
  doc.el("circle", { cx: tw.x, cy: tw.y, r: fortress ? 1.75 : 1.4, fill });
  doc.el("rect", {
    x: f(tw.x), y: f(tw.y - (fortress ? 1.2 : 1.05)),
    width: fortress ? 5.6 : 4.3, height: fortress ? 2.4 : 2.1, rx: 0.55, fill,
  });
}

export function laneDefense(grid, {
  level = 2,
  seed = 1337,
  theme = "dark",
  title = "COMMIT DEFENSE",
  width = 896,
  rangeRings = true,
  onStats,
} = {}) {
  if (!Array.isArray(grid) || !grid.length || grid[0].length !== ROWS) {
    throw new Error("grid must be weeks × 7 array of levels 0–4 (see lib/contrib.mjs)");
  }
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1];
  const th = { ...(BASE_THEMES[theme] ?? BASE_THEMES.dark), ...(ACCENTS[theme] ?? ACCENTS.dark) };
  const rnd = mulberry32(seed);
  const GW = gridWidth(grid.length);

  const towers = pickTowers(grid).map(arm);
  const scale = hpScale(towers.length);

  const enemies = [];
  for (let w = 0; w < cfg.waves; w++) for (let i = 0; i < cfg.perWave; i++) {
    const roll = rnd();
    const tier = i === cfg.perWave - 1 ? 2 : roll < cfg.mix[0] ? 0 : roll < cfg.mix[1] ? 1 : 2;
    const v0 = cfg.speed[0] + rnd() * (cfg.speed[1] - cfg.speed[0]);
    const row = Math.floor(rnd() * ROWS);
    const t0 = 1 + w * cfg.waveGap + i * 0.55 + rnd() * 0.35;
    const hp = Math.max(1, Math.round(cfg.hp[tier] * scale));
    enemies.push({
      t0, row, v: v0 * TIER_SPEED[tier], hp, maxHp: hp, tier,
      hits: [], hpAt: [], death: null, exitT: null, alive: true,
      x: -16, y: cellY(row), slowUntil: 0, slowed: false, motion: [[t0, -16]],
    });
  }

  const minV = cfg.speed[0] * TIER_SPEED[2];
  const lastT0 = Math.max(...enemies.map((e) => e.t0));
  const D = Math.ceil(lastT0 + (GW + 50) / minV + 3.6);
  const doc = makeDoc(D);
  doc.css.push("@keyframes td-bob{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-1.15px)}}.td-b{animation:td-bob .42s ease-in-out infinite}.td-b2{animation:td-bob .7s ease-in-out infinite}");

  const leaks = [];
  for (let t = 0; t < D - 1.6; t += DT) {
    for (const e of enemies) {
      if (!e.alive || t < e.t0) continue;
      const slow = t < e.slowUntil;
      if (e.slowed && !slow) e.motion.push([t, e.x]);
      e.slowed = slow;
      e.x += e.v * DT * (slow ? SLOW : 1);
      if (e.x > GW + 14 && !e.exitT) {
        e.exitT = t;
        e.alive = false;
        e.motion.push([t, e.x]);
        leaks.push(t);
        ringPulse(doc, GW + 6, e.y, t, th.lose, 11, 0.32);
      }
    }
    for (const tw of towers) {
      tw.cd -= DT;
      if (tw.cd > 0) continue;
      let best = null;
      for (const e of enemies) {
        if (!e.alive || t < e.t0) continue;
        if (Math.hypot(e.x - tw.x, e.y - tw.y) > tw.range) continue;
        if (!best || e.x > best.x) best = e;
      }
      if (!best) continue;
      tw.cd = cfg.cooldown * tw.cdMul;
      tw.fires.push(t);
      beam(doc, tw.x, tw.y, best.x, best.y, t, th.laser, tw.splash ? 0.16 : 0.13, tw.splash ? 2.45 : 2);
      hurt(best, t, tw.dmg);
      if (tw.splash) {
        ringPulse(doc, best.x, best.y, t, th.splash, tw.splash, 0.26);
        for (const e of enemies) {
          if (e === best || !e.alive || t < e.t0) continue;
          if (Math.hypot(e.x - best.x, e.y - best.y) <= tw.splash) hurt(e, t, 1);
        }
      }
    }
  }
  const kills = enemies.filter((e) => e.death).length;
  // Only creeps that crossed the core count. Still-on-board leftovers are not leaks.
  const leaked = leaks.length;
  const verdict = leaked === 0 ? "CLEAN SWEEP" : leaked < CORE_HP ? "CORE HELD" : "CORE BREACHED";
  const held = verdict !== "CORE BREACHED";

  const fx = doc.lift();
  drawCells(doc, grid, th.pal);

  for (let r = 0; r < ROWS; r++) {
    const y = cellY(r);
    doc.raw(`<polygon points="-9,${f(y - 2.1)} -3.2,${f(y)} -9,${f(y + 2.1)}" fill="${th.dim}" fill-opacity="0.4"/>`);
  }

  const ch = ROWS * PITCH;
  const hpFrames = [["0", "transform:scaleY(1)"]];
  leaks.forEach((lt, i) => {
    hpFrames.push([lt - 0.01, `transform:scaleY(${Math.max(0, (CORE_HP - i) / CORE_HP).toFixed(4)})`]);
    hpFrames.push([lt + 0.06, `transform:scaleY(${Math.max(0, (CORE_HP - i - 1) / CORE_HP).toFixed(4)})`]);
  });
  const coreLeft = Math.max(0, (CORE_HP - leaks.length) / CORE_HP);
  hpFrames.push(["100", `transform:scaleY(${coreLeft.toFixed(4)})`]);
  const coreFlash = [["0", "opacity:0"]];
  for (const lt of leaks) coreFlash.push([lt - 0.01, "opacity:0"], [lt, "opacity:0.85"], [lt + 0.22, "opacity:0"]);
  coreFlash.push(["100", "opacity:0"]);
  doc.raw(`<g transform="translate(${f(GW + 4)},0)">` +
    `<rect width="6" height="${f(ch)}" rx="1.6" fill="${th.coreBg}"/>` +
    `<rect width="6" height="${f(ch)}" rx="1.6" fill="${held ? th.core : th.lose}" style="transform-origin:center bottom;${doc.anim(hpFrames, "")}"/>` +
    `<rect width="6" height="${f(ch)}" rx="1.6" fill="#ffffff" style="${doc.anim(coreFlash, "opacity:0")}"/>` +
    `</g>`);

  for (const tw of towers) drawTurret(doc, tw, th, rangeRings);
  muzzles(doc, towers, th.muzzle);
  doc.els.push(...fx);

  for (const e of enemies) {
    const tEnd = e.death ? e.death.t : Math.min(e.exitT ?? (e.t0 + (GW + 30) / e.v), D - 1.4);
    const xEnd = e.death ? e.death.x : (e.exitT ? e.x : -16 + (tEnd - e.t0) * e.v);
    if (!e.motion.length || e.motion[e.motion.length - 1][0] < tEnd - 0.02) e.motion.push([tEnd, xEnd]);
    const color = th.bugs[e.tier], r = [4, 4.6, 5.5][e.tier];
    const leak = Boolean(e.exitT);
    const frames = [
      ["0", `opacity:0;transform:translate(-16px,${f(e.y)}px)`],
      [e.t0, `opacity:0;transform:translate(-16px,${f(e.y)}px)`],
      [e.t0 + 0.05, "opacity:1"],
    ];
    for (const [mt, mx] of e.motion) {
      if (mt > e.t0 + 0.05 && mt < tEnd - 0.01) frames.push([mt, `opacity:1;transform:translate(${f(mx)}px,${f(e.y)}px)`]);
    }
    if (leak) {
      frames.push([tEnd - 0.08, `opacity:1;transform:translate(${f(xEnd)}px,${f(e.y)}px) scale(1)`]);
      frames.push([tEnd, `opacity:1;transform:translate(${f(xEnd)}px,${f(e.y)}px) scale(1.35)`]);
    } else {
      frames.push([tEnd, `opacity:1;transform:translate(${f(xEnd)}px,${f(e.y)}px)`]);
    }
    frames.push([tEnd + 0.02, "opacity:0"], ["100", "opacity:0"]);
    const bob = e.tier === 2 ? "td-b2" : "td-b";
    let inner = `<g class="${bob}">${bugMark(e.tier, color)}${hitFlash(doc, e.hits, r + 1.6)}`;
    if (e.tier === 2) {
      const bw = 9.5;
      const hpF = [["0", "transform:scaleX(1)"]];
      let prev = 1;
      for (const [ht, hp] of e.hpAt) {
        hpF.push([ht - 0.01, `transform:scaleX(${prev.toFixed(3)})`]);
        prev = hp / e.maxHp;
        hpF.push([ht + 0.03, `transform:scaleX(${Math.max(0, prev).toFixed(3)})`]);
      }
      hpF.push(["100", `transform:scaleX(${e.death ? 0 : Math.max(0, e.hp / e.maxHp).toFixed(3)})`]);
      inner += `<rect x="${f(-bw / 2)}" y="${f(-r - 4.4)}" width="${bw}" height="1.35" rx="0.65" fill="${th.coreBg}"/>` +
        `<rect x="${f(-bw / 2)}" y="${f(-r - 4.4)}" width="${bw}" height="1.35" rx="0.65" fill="${color}" style="transform-origin:left center;${doc.anim(hpF, "")}"/>`;
    }
    inner += "</g>";
    doc.raw(`<g style="${doc.anim(frames, "opacity:0")}">${inner}</g>`);
    if (e.death) burst(doc, e.death.x, e.death.y, e.death.t, color, rnd, e.tier === 2 ? 8 : 6, e.tier === 2 ? 17 : 14);
  }

  for (let w = 0; w < cfg.waves; w++) {
    const t = 1 + w * cfg.waveGap;
    doc.raw(`<text class="td-t" x="${f(GW / 2)}" y="${f(ch / 2 + 4)}" font-size="13" fill="${th.fg}" text-anchor="middle" letter-spacing="5" style="${doc.anim([
      ["0", "opacity:0"], [t - 0.15, "opacity:0"], [t + 0.2, "opacity:0.72"], [t + 1.35, "opacity:0"], ["100", "opacity:0"],
    ], "opacity:0")}">WAVE ${w + 1}</text>`);
  }

  const endT = Math.max(
    ...enemies.map((e) => (e.death ? e.death.t : e.exitT ?? 0)),
    1 + (cfg.waves - 1) * cfg.waveGap,
  );
  doc.raw(`<text class="td-t" x="${f(GW / 2)}" y="${f(ch / 2 + 4)}" font-size="16" fill="${held ? th.win : th.lose}" text-anchor="middle" letter-spacing="5" style="${doc.anim([
    ["0", "opacity:0"], [endT + 0.55, "opacity:0"], [endT + 0.9, "opacity:1"], [D - 0.55, "opacity:1"], [D - 0.12, "opacity:0"], ["100", "opacity:0"],
  ], "opacity:0")}">${verdict}</text>`);

  onStats?.({ towers: towers.length, enemies: enemies.length, kills, leaked, duration: D, verdict });

  return defenseShell({
    doc, theme: th, cols: grid.length, title, width,
    subtitle: `LVL ${level} ${cfg.name} · ${kills}/${enemies.length} DOWN · ${verdict}`,
    ariaLabel: `Tower defense over a GitHub contribution graph: towers on big commit days shoot lasers at ${enemies.length} bug creeps marching along the weekday rows; ${kills} destroyed, ${leaked} slip through; ${verdict.toLowerCase()}`,
  });
}

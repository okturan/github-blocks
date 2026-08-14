// Commit Life — Conway's Game of Life on a GitHub contribution graph.
// Days with commits (level > 0) start alive; empty days start dead. Classic
// B3/S23 on a bounded board so patterns can fall off the edges. Generations
// bake into CSS fill/scale keyframes; the SVG ships with no JavaScript.
// Deterministic given (grid, seed): seed only tints cells born on empty days.
import {
  BASE_THEMES, ROWS, mulberry32,
  makeDoc, drawCells, defenseShell,
} from "../lib/engine.mjs";

const STEP = 0.32, HOLD = 1.6, MAX_STEPS = 40;

const FATE_TEXT = {
  still: "STILL LIFE",
  extinct: "EXTINCT",
  oscillator: (period) => `PERIOD ${period}`,
  chaos: "CHAOS",
};

export function livingCount(alive) {
  let n = 0;
  for (const col of alive) for (let r = 0; r < ROWS; r++) if (col & (1 << r)) n++;
  return n;
}

export function parseLifeRule(rule) {
  const m = String(rule).match(/^B([0-8]*)\/S([0-8]*)$/i);
  if (!m) throw new Error(`unsupported Life rule: ${rule}`);
  return {
    birth: new Set([...m[1]].map(Number)),
    survive: new Set([...m[2]].map(Number)),
  };
}

export function stepLife(alive, birth, survive, wrapRows = false) {
  const cols = alive.length;
  const next = new Array(cols);
  for (let c = 0; c < cols; c++) {
    const L = c ? alive[c - 1] : 0, M = alive[c], R = c + 1 < cols ? alive[c + 1] : 0;
    let mask = 0;
    for (let r = 0; r < ROWS; r++) {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        let rr = r + dr;
        if (wrapRows) rr = (rr + ROWS) % ROWS;
        else if (rr < 0 || rr >= ROWS) continue;
        const bit = 1 << rr;
        if ((wrapRows ? rr !== r : dr !== 0) && (M & bit)) n++;
        if (L & bit) n++;
        if (R & bit) n++;
      }
      const live = M & (1 << r);
      if (live ? survive.has(n) : birth.has(n)) mask |= 1 << r;
    }
    next[c] = mask;
  }
  return next;
}

function simulate(grid, { birth, survive, wrapRows, maxSteps, replayOscillator }) {
  let alive = grid.map((col) => {
    let m = 0;
    for (let r = 0; r < ROWS; r++) if (col[r] > 0) m |= 1 << r;
    return m;
  });
  const seen = new Map();
  const hist = [];
  let fate = "chaos", period = 0;
  for (let g = 0; ; g++) {
    const key = alive.join(",");
    if (seen.has(key)) {
      period = g - seen.get(key);
      fate = livingCount(alive) === 0 ? "extinct" : period === 1 ? "still" : "oscillator";
      if (replayOscillator && fate === "oscillator") {
        const cycle = hist.slice(seen.get(key));
        hist.push(...cycle, ...cycle);
      }
      break;
    }
    seen.set(key, g);
    hist.push(alive);
    if (livingCount(alive) === 0) { fate = "extinct"; period = 1; break; }
    if (g >= maxSteps) break;
    alive = stepLife(alive, birth, survive, wrapRows);
  }
  return { hist, fate, period };
}

function seriesFor(hist, tint) {
  const cols = hist[0].length;
  const series = Array.from({ length: cols }, () => Array.from({ length: ROWS }, () => []));
  for (const mask of hist) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < ROWS; r++) {
      series[c][r].push(mask[c] & (1 << r) ? tint[c][r] : 0);
    }
  }
  return series;
}

export function cellFrames(lvls, pal, flash, step = STEP) {
  let pops = false;
  for (let g = 1; g < lvls.length; g++) if (lvls[g - 1] === 0 && lvls[g] > 0) pops = true;
  const st = (lvl, sc, fill) => pops
    ? `fill:${fill || pal[lvl]};transform:scale(${sc})`
    : `fill:${fill || pal[lvl]}`;
  const frames = [["0", st(lvls[0], 1)]];
  for (let g = 1; g < lvls.length; g++) {
    if (lvls[g] === lvls[g - 1]) continue;
    const t = g * step, prev = lvls[g - 1], next = lvls[g];
    frames.push([t - 0.01, st(prev, 1)]);
    if (prev === 0 && next > 0) {
      frames.push([t, st(next, 0.42)]);
      frames.push([t + 0.11, st(next, 1.16, flash)]);
      frames.push([t + 0.22, st(next, 1)]);
    } else {
      frames.push([t + 0.18, st(next, 1)]);
    }
  }
  frames.push(["100", st(lvls[lvls.length - 1], 1)]);
  return frames;
}

function timingFor(animGens, step, hold) {
  if (animGens <= 0) return { step, hold, duration: Math.max(8, Math.ceil(hold)) };
  let s = step, h = hold;
  let duration = Math.ceil(animGens * s + h);
  if (duration < 8) {
    s = (8 - h) / animGens;
    duration = 8;
  }
  if (duration > 20) {
    s = (20 - h) / animGens;
    duration = 20;
  }
  return { step: s, hold: h, duration };
}

export function commitLife(grid, {
  seed = 1337,
  theme = "dark",
  title = "COMMIT LIFE",
  width = 896,
  onStats,
  rule = "B3/S23",
  wrapRows = false,
  maxSteps = MAX_STEPS,
  step = STEP,
  hold = HOLD,
  replayOscillator = false,
  fitDuration = false,
  note = "",
} = {}) {
  if (!Array.isArray(grid) || !grid.length || grid[0].length !== ROWS) {
    throw new Error("grid must be weeks × 7 array of levels 0–4 (see lib/contrib.mjs)");
  }
  const { birth, survive } = parseLifeRule(rule);
  const th = BASE_THEMES[theme] ?? BASE_THEMES.dark;
  const rnd = mulberry32(seed);
  const cols = grid.length;
  const tint = grid.map((col) => col.map((v) => v > 0 ? v : 2 + Math.floor(rnd() * 3)));
  const { hist, fate, period } = simulate(grid, { birth, survive, wrapRows, maxSteps, replayOscillator });
  const series = seriesFor(hist, tint);
  const animGens = hist.length - 1;
  const gens = fate === "oscillator" && replayOscillator ? animGens - period * 2 : animGens;
  const startLiving = livingCount(hist[0]);
  const living = livingCount(hist[hist.length - 1]);
  const timed = fitDuration ? timingFor(animGens, step, hold) : { step, hold, duration: Math.ceil(animGens * step + hold) };
  const doc = makeDoc(timed.duration);
  const flash = th.pal[theme === "light" ? 1 : 4];
  drawCells(doc, grid, th.pal, (c, r) => {
    const lvls = series[c][r];
    if (lvls.every((v) => v === lvls[0])) return null;
    return doc.anim(cellFrames(lvls, th.pal, flash, timed.step), "transform-origin:center");
  });

  const fateText = fate === "oscillator" ? FATE_TEXT.oscillator(period) : FATE_TEXT[fate];
  const wrapNote = wrapRows ? " · WEEKDAY WRAP" : "";
  onStats?.({ gens, living, startLiving, fate, period, duration: timed.duration });

  return defenseShell({
    doc, theme: th, cols, title, width,
    subtitle: `${note ? `${note} · ` : ""}GEN 0→${gens} · ${living} LIVE · ${fateText}${wrapNote}`,
    ariaLabel: `${title} on a GitHub contribution graph: ${startLiving} commit days start alive, ${gens} generations later ${living} cells remain (${fateText.toLowerCase()})`,
  });
}

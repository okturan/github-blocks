// GitHub contribution-grid loading for blocks that render over the graph.
// The grid is weeks × 7 weekdays of intensity levels 0–4, matching what
// github.com/users/<user>/contributions renders (no auth required).

export function parseContributionGrid(html) {
  const weeks = [];
  for (const tag of html.matchAll(/<td\b[^>]*\bdata-date="[^"]*"[^>]*>/g)) {
    const td = tag[0];
    const id = td.match(/id="contribution-day-component-(\d+)-(\d+)"/);
    const level = td.match(/data-level="(\d)"/);
    if (!id || !level) continue;
    const day = +id[1], week = +id[2];
    (weeks[week] ??= Array(7).fill(0))[day] = +level[1];
  }
  if (!weeks.length) throw new Error("no contribution cells found — GitHub markup may have changed");
  return weeks.map((w) => w ?? Array(7).fill(0));
}

export async function fetchContributionGrid(user) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`);
  if (!res.ok) throw new Error(`GET contributions for ${user}: HTTP ${res.status}`);
  return parseContributionGrid(await res.text());
}

// Deterministic fake grid for examples/tests — weekday-weighted so it looks
// like a real year of commits.
export function sampleContributionGrid(seed = 1, weeks = 53) {
  let a = seed >>> 0;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const workday = d >= 1 && d <= 5;
    const busy = Math.sin(w / 5) * 0.25 + (workday ? 0.45 : 0.18);
    const r = rnd();
    if (r > busy) return 0;
    if (r > busy * 0.55) return 1;
    if (r > busy * 0.3) return 2;
    return r > busy * 0.12 ? 3 : 4;
  }));
}

import assert from "node:assert/strict";
import test from "node:test";

import { bossFight } from "../blocks/boss-fight.mjs";
import { cinematicStrip } from "../blocks/cinematic-strip.mjs";
import { classicCards } from "../blocks/classic-cards.mjs";
import { laneDefense } from "../blocks/lane-defense.mjs";
import { mediaList } from "../blocks/media-list.mjs";
import { nightShift } from "../blocks/night-shift.mjs";
import { posterCards } from "../blocks/poster-cards.mjs";
import { sampleContributionGrid } from "../lib/contrib.mjs";
import { safeHref, safeId, xml } from "../lib/helpers.mjs";

const items = [
  { title: "Shinsekai yori", year: 2012, episodes: 25, score: 84, genres: ["Drama", "Mystery"], url: "https://myanimelist.net/anime/13125", color: "#1f3a5f" },
  { title: "Mononoke", year: 2007, episodes: 12, score: 82, genres: ["Horror"], url: "https://myanimelist.net/anime/2246", color: "#7a4a1f" },
  { title: "DAN DA DAN", year: 2024, episodes: 12, score: 84, genres: ["Action"], url: "https://myanimelist.net/anime/57334", color: "#5f1f4a" },
];

test("XML helpers escape markup and reject active or malformed links", () => {
  assert.equal(xml(`<tag a="b">&`), "&lt;tag a=&quot;b&quot;&gt;&amp;");
  assert.equal(safeHref("https://example.com/a?x=1&y=2"), "https://example.com/a?x=1&amp;y=2");
  assert.equal(safeHref("javascript:alert(1)"), "#");
  assert.equal(safeHref("data:text/html;base64,PHNjcmlwdD4="), "#");
  assert.match(safeHref("data:image/png;base64,AAAA", { image: true }), /^data:image\/png/);
  assert.equal(safeId(`bad id"><script>`), "bad_id___script_");
});

test("media renderers preserve their documented dimensions and item links", () => {
  const cases = [
    [cinematicStrip, 896, 190],
    [posterCards, 896, 446],
    [mediaList, 896, 340],
    [classicCards, 878, 220],
  ];
  for (const [render, width, height] of cases) {
    const svg = render(items);
    assert.match(svg, new RegExp(`<svg[^>]+width="${width}"[^>]+height="${height}"`));
    assert.equal((svg.match(/<a href="https:\/\/myanimelist\.net\//g) ?? []).length, 3);
    for (const item of items) assert.match(svg, new RegExp(item.title.replaceAll(" ", "\\s")));
  }
});

test("media renderers neutralize link, cover, id, and text injection", () => {
  const hostile = [{
    title: `<script>alert("title")</script>`,
    year: `<script>year</script>`,
    episodes: `1</text><script>episode</script>`,
    genres: [`<script>genre</script>`],
    url: "javascript:alert(1)",
    cover: "data:text/html;base64,PHNjcmlwdD4=",
    color: "#30363d",
  }];
  for (const render of [cinematicStrip, posterCards, mediaList, classicCards]) {
    const svg = render(hostile, { idPrefix: `bad\"><script>` });
    assert.doesNotMatch(svg, /<script|javascript:|data:text\/html/i);
    assert.match(svg, /<a href="#">/);
    assert.match(svg, /&lt;script&gt;/);
    assert.match(svg, /id="bad___script_-clip-0"/);
  }
});

test("defense renderers are deterministic and expose reduced-motion CSS", () => {
  const grid = sampleContributionGrid(7);
  for (const render of [laneDefense, nightShift, bossFight]) {
    const first = render(grid, { level: 2, seed: 7 });
    assert.equal(first, render(grid, { level: 2, seed: 7 }));
    assert.match(first, /@media \(prefers-reduced-motion:reduce\)\{\*\{animation-play-state:paused!important\}\}/);
    assert.doesNotMatch(first, /<script\b|javascript:/i);
  }
});

test("lane and road difficulty levels retain their reference outcomes", () => {
  const grid = sampleContributionGrid(7);
  const expected = {
    lane: [
      { towers: 22, enemies: 15, kills: 15, leaked: 0, duration: 39 },
      { towers: 22, enemies: 24, kills: 17, leaked: 7, duration: 47 },
      { towers: 22, enemies: 35, kills: 16, leaked: 19, duration: 56 },
    ],
    night: [
      { towers: 22, enemies: 12, kills: 12, leaked: 0, duration: 43 },
      { towers: 22, enemies: 18, kills: 17, leaked: 1, duration: 46 },
      { towers: 22, enemies: 27, kills: 10, leaked: 17, duration: 56 },
    ],
  };

  for (const [name, render] of [["lane", laneDefense], ["night", nightShift]]) {
    for (const level of [1, 2, 3]) {
      let stats;
      render(grid, { level, seed: 7, onStats: (value) => { stats = value; } });
      assert.deepEqual(stats, expected[name][level - 1]);
    }
  }
});

test("boss levels retain rout, last-stand, and consumed outcomes", () => {
  const grid = sampleContributionGrid(7);
  const expected = [
    { towers: 37, bossHP: 60, hits: 60, ending: "ROUT", duration: 16 },
    { towers: 37, bossHP: 94, hits: 94, ending: "LAST STAND", duration: 21 },
    { towers: 37, bossHP: 148, hits: 109, ending: "CONSUMED", duration: 27 },
  ];
  for (const level of [1, 2, 3]) {
    let stats;
    const svg = bossFight(grid, { level, seed: 7, onStats: (value) => { stats = value; } });
    assert.deepEqual(stats, expected[level - 1]);
    assert.match(svg, level === 3 ? /GRAPH CONSUMED/ : /GRAPH DEFENDED/);
  }
});

test("defense renderers reject empty or malformed contribution grids", () => {
  for (const render of [laneDefense, nightShift, bossFight]) {
    assert.throws(() => render([]), /grid must be weeks/);
    assert.throws(() => render([[0, 1]]), /grid must be weeks/);
  }
});

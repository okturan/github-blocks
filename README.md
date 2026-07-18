# github-blocks

Custom SVG modules for GitHub profile READMEs. Each block is a pure function:
data in, a self-contained SVG string out. Generate the SVG in CI, commit it to
an output branch, embed it in the README with a plain `<img>`.

**Configurator: <https://okturan.github.io/github-blocks/>** — tune a
tower-defense battle over your own contribution graph in the browser, then
copy a ready-made workflow that keeps it updating daily. The site renders
previews with the exact modules in this repo; nothing is hosted server-side.

Started with the anime section of [okturan/okturan](https://github.com/okturan/okturan);
more blocks will land here as they get built.

## Blocks

| Block | Size (3 items) | Look |
|---|---|---|
| `cinematic-strip` | 896×190 | Cover art as card backdrop under a gradient; title + year overlaid. |
| `poster-cards` | 896×446 | Full-bleed posters with title, meta + score, genre chips. |
| `media-list` | 896×340 | One panel, numbered rows; meta and score right-aligned. |
| `classic-cards` | 860×220 | The original okturan layout: dark panel, small cover, title + meta. |
| `lane-defense` | 896×169 | Animated tower defense over your contribution graph: big commit days are towers, bug waves march the weekday lanes. Pre-simulated, baked to CSS keyframes — no JS. |
| `night-shift` | 896×169 | Creeps follow a serpentine road through the graph; towers near the road fire plasma bolts with real intercept leads. |
| `boss-fight` | 896×169 | The snk snake returns as a boss and eats commit cells while every level-2+ day fires on it. Three endings: ROUT, LAST STAND, CONSUMED (the snake wins). |

All 896-wide blocks fill GitHub's desktop README column (max ~896px) and scale
down proportionally on narrower screens.

## Usage

```js
import { cinematicStrip } from "./blocks/cinematic-strip.mjs";

const svg = cinematicStrip([
  {
    title: "Mononoke",
    year: 2007,
    episodes: 12,        // used by poster-cards / media-list / classic-cards
    score: 82,           // 0–100 (AniList averageScore); optional
    genres: ["Horror", "Mystery", "Supernatural"],
    cover: "data:image/jpeg;base64,...", // data URI — GitHub's camo proxy blocks external fetches inside SVGs
    url: "https://anilist.co/anime/2246/Mononoke/",
    color: "#58a6ff",    // placeholder fill when cover is missing
  },
  // ...
]);
writeFileSync("dist/profile-anime.svg", svg);
```

`lane-defense` takes a contribution grid instead of items:

```js
import { laneDefense } from "./blocks/lane-defense.mjs";
import { fetchContributionGrid } from "./lib/contrib.mjs";

const grid = await fetchContributionGrid("okturan"); // weeks × 7, levels 0–4

// Deterministic: same grid + level + seed → identical battle.
// A committed SVG can't randomize per page load (camo caches it, no JS runs
// in <img>), so rotate in CI instead — pick a new battle each cron run:
const day = Math.floor(Date.now() / 86400000);
const svg = laneDefense(grid, {
  level: 1 + (day % 3),        // 1 PATROL · 2 SIEGE · 3 OVERRUN
  seed: day,                   // fresh wave composition every run
  theme: "dark",               // or "light"
});
writeFileSync("dist/lane-defense.svg", svg);
```

Difficulty is auto-balanced to the grid: level-3+ days garrison the graph
(sparse profiles promote level-2 days, dense ones are thinned), and enemy HP
scales with tower count, so PATROL is a clean sweep, SIEGE leaks a few, and
OVERRUN ends badly on any profile.

Render every block with sample data:

```sh
node examples/render-all.mjs   # writes examples/out/*.svg
```

### Use the defense blocks without writing code

The [configurator](https://okturan.github.io/github-blocks/) generates a
workflow that checks out this repo at a pinned commit and runs
`action/generate.mjs` on GitHub's runners — no vendoring, no hosting. Config
is all env vars: `BLOCK` (`lane-defense` / `night-shift` / `boss-fight`),
`PROFILE_USER`, `LD_LEVEL` (1–3 or `rotate`; boss-fight reads them as endings),
`LD_SEED` (int or `daily`), `LD_THEMES`, `LD_TITLE`, `LD_OUT`.

## Repo layout

- `blocks/` — the renderers (pure ESM, no dependencies; run in Node and browsers)
- `lib/` — shared helpers, the defense-sim engine, contribution-grid fetching/parsing
- `action/` — CI entry points for consumers' workflows
- `site/` — the configurator, deployed to GitHub Pages by `.github/workflows/pages.yml`
- `examples/` — `node examples/render-all.mjs` renders every block with sample data

## Notes

- Covers must be embedded as data URIs; fetch them at generation time
  (see `loadAnime()` in okturan/okturan's `generate-profile-cards.mjs`).
- Consumers vendor the renderer they use — CI for a profile repo only checks
  out that repo, so keep the generator self-contained and treat this repo as
  the canonical source to copy from.
- Palette matches GitHub dark (`#0d1117` / `#161b22` / `#30363d`), so blocks
  blend into dark mode and read as deliberate dark cards in light mode.

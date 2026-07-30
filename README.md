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

## See them render

These are committed outputs from the actual renderers, not mockups. Click any
battle to open the configurator and generate the same kind of block for your
own contribution graph.

<p>
  <a href="https://okturan.github.io/github-blocks/"><img width="896" alt="Lane Defense animating a tower-defense battle over a GitHub contribution graph" src="./examples/out/lane-defense.svg"></a>
</p>
<p>
  <a href="https://okturan.github.io/github-blocks/"><img width="896" alt="Night Shift routing enemies through a contribution graph while nearby towers fire" src="./examples/out/night-shift.svg"></a>
</p>
<p>
  <a href="https://okturan.github.io/github-blocks/"><img width="896" alt="Boss Fight pitting contribution cells against an animated snake boss" src="./examples/out/boss-fight.svg"></a>
</p>
<p>
  <a href="./examples/out/cinematic-strip.svg"><img width="896" alt="Cinematic Strip rendering three media covers as a wide profile card" src="./examples/out/cinematic-strip.svg"></a>
</p>
<p>
  <a href="./examples/out/coding-habits.svg"><img width="896" alt="Coding Habits summarizing a recent public commit sample by day and time" src="./examples/out/coding-habits.svg"></a>
</p>

## Blocks

| Block | Size (3 items) | Look |
|---|---|---|
| `cinematic-strip` | 896×190 | Cover art as card backdrop under a gradient; title + year overlaid. |
| `poster-cards` | 896×446 | Full-bleed posters with title, meta + score, genre chips. |
| `media-list` | 896×340 | One panel, numbered rows; meta and score right-aligned. |
| `classic-cards` | 878×220 | The original okturan layout: dark panel, small cover, title + meta. |
| `coding-habits` | 896×300 | Scheduled analysis of the latest X indexed public, default-branch, non-merge commits. No LLM required. |
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

The committed gallery examples load three small local JPEGs and inline them as
data URIs. This is why the covers survive GitHub's image proxy instead of
falling back to colored initials.

### Generate coding habits on a schedule

The coding-habits block is “agentic” in the practical sense: a scheduled action
checks a configurable number of recent commits, recomputes the evidence, and
publishes a fresh SVG. Its day, time-window, active-date, median, and weekday
chart calculations are deterministic, so the free path needs no LLM, API key,
or inference service.

```yaml
name: Update coding habits

on:
  schedule:
    - cron: "23 1 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout the renderer
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          repository: okturan/github-blocks
          ref: main # pin this to a commit SHA for reproducible consumers

      - name: Analyze recent public commits
        env:
          GITHUB_TOKEN: ${{ github.token }}
          PROFILE_USER: "okturan"
          HABITS_LIMIT: "500" # 1–1000
          HABITS_TIMEZONE: "Europe/Istanbul"
        run: node action/generate-coding-habits.mjs

      - name: Publish to the profile repository's output branch
        run: |
          cd dist
          git init -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Update coding habits"
          git push --force "https://x-access-token:${{ github.token }}@github.com/${{ github.repository }}.git" output
```

Embed the two generated themes from the `output` branch:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/USER/USER/output/coding-habits.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/USER/USER/output/coding-habits-light.svg">
  <img alt="My recent public coding habits" src="https://raw.githubusercontent.com/USER/USER/output/coding-habits.svg">
</picture>
```

The generator uses GitHub's indexed commit search for `author:USER
merge:false is:public`, filters merges defensively, and caps the sample at GitHub
Search's first 1,000 results. `HABITS_WINDOW` changes the time bucket
(default `3` hours), while `HABITS_TITLE`, `HABITS_THEMES`, and `HABITS_OUT`
control presentation and output.

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

The verification workflow runs dependency-free Node behavior tests for GitHub
contribution and recent-commit parsing, time-zone-aware habits analysis, XML
and active-link safety, media-layout contracts, deterministic defense outcomes,
and reduced-motion output. It then rerenders all nine examples and fails if the committed SVGs drift, if the README gallery
points at missing output, or if an output introduces executable script content.

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

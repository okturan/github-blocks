# github-blocks

Custom SVG modules for GitHub profile READMEs. Each block is a pure function:
data in, a self-contained SVG string out. Generate the SVG in CI, commit it to
an output branch, embed it in the README with a plain `<img>`.

**Configurator: <https://okturan.github.io/github-blocks/>** lets you preview
every block and copy the code needed to add one to a profile. Graph games
(tower defense and Commit Life) and activity blocks include a scheduled
workflow. Anime blocks include a Node script. The site uses the same
renderers as this repository. The DOWNLOAD tab can save the current graph
block as SVG. Chrome and Edge can also export one silent H.264 loop.

Started with the anime section of [okturan/okturan](https://github.com/okturan/okturan);
more blocks will land here as they get built.

## See them render

These are committed outputs from the actual renderers, not mockups. Click any
graph block to open the configurator and generate the same kind of block for your
own contribution graph.

<p>
  <a href="https://okturan.github.io/github-blocks/#lane-defense"><img width="896" alt="Lane Defense: fortress days splash, bug waves march the weekday lanes, leaks hit a core" src="./examples/out/lane-defense.svg"></a>
</p>
<p>
  <a href="https://okturan.github.io/github-blocks/#night-shift"><img width="896" alt="Night Shift routing enemies through a contribution graph while nearby towers fire" src="./examples/out/night-shift.svg"></a>
</p>
<p>
  <a href="https://okturan.github.io/github-blocks/#boss-fight"><img width="896" alt="Boss Fight pitting contribution cells against an animated snake boss" src="./examples/out/boss-fight.svg"></a>
</p>
<p>
  <a href="https://okturan.github.io/github-blocks/#commit-life"><img width="896" alt="Commit Life running Conway's Game of Life on a GitHub contribution graph" src="./examples/out/commit-life.svg"></a>
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
| `lane-defense` | 896×169 | Animated tower defense over your contribution graph: big commit days are towers, the brightest are fortresses with splash, bug waves march the weekday lanes, and leaks hit a core on the right. The renderer converts the simulation to CSS keyframes. The SVG contains no JavaScript. |
| `night-shift` | 896×169 | Creeps follow a serpentine road through the graph; towers near the road fire plasma bolts with real intercept leads. |
| `boss-fight` | 896×169 | The snk snake returns as a boss and eats commit cells while every level-2+ day fires on it. Three endings: ROUT, LAST STAND, CONSUMED (the snake wins). |
| `commit-life` | 896×169 | Conway's Game of Life on your contribution graph. Commit days start alive, empty days start dead. Generations bake into CSS keyframes. The SVG contains no JavaScript. |

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
    cover: "data:image/jpeg;base64,...", // data URI; GitHub blocks external fetches inside SVGs
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

The coding-habits block runs on a schedule. It checks a configurable number of
recent public commits, groups their dates by weekday and time, and publishes a
fresh SVG. The calculation is deterministic and does not need an LLM or paid
API.

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
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          mkdir output
          cd output
          git init
          git remote add origin "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
          if git ls-remote --exit-code --heads origin output >/dev/null 2>&1; then
            git fetch --depth=1 origin output
            git checkout -b output FETCH_HEAD
          else
            git checkout -b output
          fi
          cp ../dist/coding-habits*.svg .
          git add coding-habits.svg coding-habits-light.svg
          git diff --cached --quiet && exit 0
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "Update coding habits"
          git push origin output
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
// in <img>), so rotate in CI instead. Pick a new battle each cron run:
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
scales with the garrison's firepower rather than its headcount, so a graph with
no fortress days is not written off. PATROL is a clean sweep, SIEGE leaks a few,
and OVERRUN comes down to the last wave. Level-4 days are fortresses (longer
range, double damage, splash). Hits slow their target. Leaks strike a core on
the right sized to the wave it faces (5 at PATROL, 8 at SIEGE, 12 at OVERRUN),
so the meter drains across the whole battle instead of bottoming out mid-loop.

`commit-life` uses the same grid. Commit days start alive; empty days start dead.
Classic B3/S23 runs on a bounded board, then every generation bakes into CSS.
`seed` only tints cells born on days that were empty.

```js
import { commitLife } from "./blocks/commit-life.mjs";
import { fetchContributionGrid } from "./lib/contrib.mjs";

const grid = await fetchContributionGrid("okturan");
const day = Math.floor(Date.now() / 86400000);
const svg = commitLife(grid, {
  seed: day,          // born-cell tint; the Life pattern comes from the graph
  theme: "dark",      // or "light"
});
writeFileSync("dist/commit-life.svg", svg);
```

Embed the two generated themes the same way as the other graph blocks:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/USER/USER/output/commit-life.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/USER/USER/output/commit-life-light.svg">
  <img alt="Conway's Game of Life on my GitHub contribution graph" src="https://raw.githubusercontent.com/USER/USER/output/commit-life.svg">
</picture>
```

Render every block with sample data:

```sh
node examples/render-all.mjs   # writes examples/out/*.svg
```

The verification workflow runs dependency-free Node behavior tests for GitHub
contribution and recent-commit parsing, time-zone-aware habits analysis, XML
and active-link safety, media-layout contracts, deterministic defense and Life
outcomes, and reduced-motion output. It then rerenders all eleven examples and
fails if the committed SVGs drift, if the README gallery points at missing
output, or if an output introduces executable script content.

### Use the graph blocks without writing code

The [configurator](https://okturan.github.io/github-blocks/) generates a
workflow that checks out this repo at a pinned commit and runs
`action/generate.mjs` on GitHub's runners. No vendoring or hosting is needed. Config
is all env vars: `BLOCK` (`lane-defense` / `night-shift` / `boss-fight` / `commit-life`),
`PROFILE_USER`, `LD_LEVEL` (1–3 or `rotate`; boss-fight reads them as endings;
commit-life ignores level), `LD_SEED` (int or `daily`; for commit-life, seed only
tints cells born on empty days), `LD_THEMES`, `LD_TITLE`, `LD_RANGE_RINGS`
(`on` or `off`; hides fortress and tower range circles), `LD_OUT`.

## Repo layout

- `blocks/`: renderers written as dependency-free ESM for Node and browsers
- `lib/`: shared helpers, the defense and Life simulation, and GitHub data fetching
- `action/`: CI entry points for profile workflows
- `site/`: the configurator deployed by `.github/workflows/pages.yml`
- `examples/`: committed sample output from `node examples/render-all.mjs`

## Notes

- Covers must be embedded as data URIs; fetch them at generation time
  (see `loadAnime()` in okturan/okturan's `generate-profile-cards.mjs`).
- Consumers vendor the renderer they use. CI for a profile repo only checks
  out that repo, so keep the generator self-contained and treat this repo as
  the canonical source to copy from.
- Palette matches GitHub dark (`#0d1117` / `#161b22` / `#30363d`), so blocks
  blend into dark mode and read as deliberate dark cards in light mode.

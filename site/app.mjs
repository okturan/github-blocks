// Configurator logic. The same modules that run in GitHub Actions render the
// previews here, client-side.
import { laneDefense } from "./blocks/lane-defense.mjs";
import { nightShift } from "./blocks/night-shift.mjs";
import { bossFight } from "./blocks/boss-fight.mjs";
import { commitLife } from "./blocks/commit-life.mjs";
import { sampleContributionGrid } from "./lib/contrib.mjs";
import { cinematicStrip } from "./blocks/cinematic-strip.mjs";
import { posterCards } from "./blocks/poster-cards.mjs";
import { mediaList } from "./blocks/media-list.mjs";
import { classicCards } from "./blocks/classic-cards.mjs";
import { codingHabits } from "./blocks/coding-habits.mjs";
import { analyzeCodingHabits } from "./lib/habits.mjs";
import { fetchRecentPublicCommits } from "./lib/github-commits.mjs";
import { canEncodeMp4, exportSvgLoopToMp4 } from "./export-mp4.mjs";

const $ = (id) => document.getElementById(id);
const DAY = Math.floor(Date.now() / 86_400_000);
const HERO_COPY = {
  defense: {
    title: `YOUR COMMIT GRAPH<br>FIGHTS <span class="alt">BACK</span>`,
    lede: "Turn a real contribution graph into an animated battle. Choose a game, set the difficulty, and copy a workflow that rebuilds the SVG each day.",
    pageTitle: "Tower defense | github-blocks",
  },
  life: {
    title: `YOUR COMMITS<br>KEEP <span class="alt">LIVING</span>`,
    lede: "Days you committed are live cells. Empty days are dead. Conway's Game of Life runs on the graph, then every generation bakes into CSS. The SVG has no JavaScript.",
    pageTitle: "Commit life | github-blocks",
  },
  habits: {
    title: `SEE WHEN YOUR<br>COMMITS <span class="alt">LAND</span>`,
    lede: "Check up to 1,000 recent public commits. The report groups them by weekday and local time, then gives you a daily GitHub Actions workflow.",
    pageTitle: "Coding habits | github-blocks",
  },
  media: {
    title: `BUILD AN ANIME<br>SHELF FOR <span class="alt">GITHUB</span>`,
    lede: "Search AniList, choose up to six titles, and render them as an SVG for your profile. Covers are embedded in the file so they survive GitHub's image proxy.",
    pageTitle: "Anime cards | github-blocks",
  },
};

const REGISTRY = {
  "lane-defense": {
    fn: laneDefense,
    workflowName: "Commit defense",
    defaultTitle: "COMMIT DEFENSE",
    levelNames: ["PATROL", "SIEGE", "OVERRUN"],
    levelWord: "Difficulty",
    rotateHint: (name) => `Cycles PATROL → SIEGE → OVERRUN each day (today: ${name}).`,
    fixedHint: (name) => `Fixed at ${name} on every regeneration.`,
    alt: "Tower defense preview: bug waves march the weekday rows while fortress days splash and a core on the right takes leaks",
    howName: "How Lane Defense plays",
    how: "Bugs spawn in waves and march the weekday rows. Red bugs are scouts, orange bugs are soldiers, and purple bugs are tanks with a health bar. Each wave ends with a tank. The brightest commit days are fortresses: longer range, double damage, and splash. Hits slow whatever they catch. Leaks strike the core on the right, which is sized to the wave it faces, so the meter drains across the whole battle. PATROL is a clean sweep, SIEGE holds the core with a few leaks, and OVERRUN comes down to the last wave.",
    hasRangeRings: true,
  },
  "night-shift": {
    fn: nightShift,
    workflowName: "Night shift",
    defaultTitle: "NIGHT SHIFT",
    levelNames: ["PATROL", "SIEGE", "OVERRUN"],
    levelWord: "Difficulty",
    rotateHint: (name) => `Cycles PATROL → SIEGE → OVERRUN each day (today: ${name}).`,
    fixedHint: (name) => `Fixed at ${name} on every regeneration.`,
    alt: "Tower defense preview: creeps follow a winding road through the graph while towers fire plasma bolts",
    howName: "How Night Shift plays",
    how: "Creeps follow a road across Monday, back through Wednesday, and out through Friday. The first creep absorbs fire while the pack advances. Towers near the road aim 0.22 seconds ahead, so each bolt lands where its target will be.",
    hasRangeRings: true,
  },
  "boss-fight": {
    fn: bossFight,
    workflowName: "Boss fight",
    defaultTitle: "BOSS FIGHT",
    levelNames: ["ROUT", "LAST STAND", "CONSUMED"],
    levelWord: "Ending",
    rotateHint: (name) => `Cycles the ending each day (today: ${name}). On CONSUMED, the snake wins.`,
    fixedHint: (name) => name === "CONSUMED" ? "The towers lose. The graph gets eaten, every run." : `The snake goes down at ${name === "ROUT" ? "about half" : "86%"} of its run, every time.`,
    alt: "Boss fight preview: a snake eats commit cells while every fortified day fires lasers at it",
    howName: "How Boss Fight plays",
    how: "The snake moves through the graph at a constant speed and eats unfortified cells. Days at level 2 or higher hold their ground and fire when the head is in range. The selected ending sets the boss health. ROUT ends near the halfway point, LAST STAND reaches 86 percent, and CONSUMED lets the snake eat the graph.",
  },
  "commit-life": {
    fn: commitLife,
    workflowName: "Commit life",
    defaultTitle: "COMMIT LIFE",
    noLevel: true,
    seedLabel: "Brightness seed",
    titleHint: "The subtitle shows generations, living cells, and how the board ends.",
    dailySeedHint: "The cron tints newly born cells each day. The Life pattern comes from the graph.",
    fixedSeedHint: (seed) => `Locked to seed ${seed}. Same born-cell greens until you change it.`,
    alt: "Conway's Game of Life running on a GitHub contribution graph: commit days live, empty days die",
    embedAlt: "Conway's Game of Life animated over my GitHub contribution graph",
    howName: "How Commit Life plays",
    how: "Each day with a commit is a live cell. Empty days are dead. The board uses Conway's classic B3/S23 rules on a bounded grid, so patterns can fall off the edges like a graph fading. Born cells pop in; dying cells fade to empty. Generations bake into CSS keyframes. The SVG that ships contains no JavaScript.",
    shipVerb: "reruns Life",
    howBake: "The sim runs once, at generation time. Every birth and every death becomes a CSS keyframe. The SVG that ships contains no code, only choreography.",
    howDet: "Same grid, same seed: the identical Life run, in both themes. The pattern comes from the graph. The seed only tints cells born on empty days.",
    howExtraName: "Classic B3/S23",
    howExtra: "A dead cell with three live neighbors is born. A live cell with two or three neighbors survives. The board does not wrap, so gliders and other patterns can walk off the sides.",
    cronNote: "daily; refreshes the graph",
    workflowStep: "Run today's Life",
    workflowCommit: "Update commit-life",
  },
};

const state = {
  block: "lane-defense",
  user: "okturan",
  grid: sampleContributionGrid(7),
  gridIsLive: false,
  level: "rotate", // 1 | 2 | 3 | "rotate"
  seedMode: "daily", // "daily" | "fixed"
  seed: DAY,
  theme: "dark",
  rangeRings: true,
  title: "COMMIT DEFENSE",
  titleDirty: false,
  stats: null,
  renderSha: "main",
};

// ---------------------------------------------------------------- grid loading

function toGrid(contributions) {
  // One entry per day, Sunday-aligned, oldest first. This matches
  // github.com's own graph. Chunk into weeks × 7 and pad the tail.
  const weeks = [];
  for (let i = 0; i < contributions.length; i += 7) {
    const week = contributions.slice(i, i + 7).map((d) => d.level);
    while (week.length < 7) week.push(0);
    weeks.push(week);
  }
  return weeks;
}

async function loadGrid(user) {
  const note = $("gridnote");
  note.classList.remove("error");
  note.textContent = `Fetching ${user}'s contribution graph…`;
  try {
    const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(user)}?y=last`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.contributions?.length) throw new Error("empty response");
    state.grid = toGrid(data.contributions);
    state.gridIsLive = true;
    state.user = user;
    note.textContent = `Live graph loaded. ${data.total?.lastYear ?? "?"} contributions in the last year.`;
  } catch (err) {
    state.gridIsLive = false;
    note.classList.add("error");
    note.textContent = `Couldn't reach the contributions API (${err.message}). Previews use a sample grid until it's back; the workflow always uses your real graph.`;
  }
  render();
}

// ------------------------------------------------------------------- rendering

let previewUrl = null;
const rendered = { dark: "", light: "" };

function effectiveLevel() { return state.level === "rotate" ? 1 + (DAY % 3) : state.level; }
function effectiveSeed() { return state.seedMode === "daily" ? DAY : state.seed; }
function reg() { return REGISTRY[state.block]; }

function render() {
  const opts = {
    level: effectiveLevel(),
    seed: effectiveSeed(),
    title: state.title || reg().defaultTitle,
    rangeRings: state.rangeRings,
  };
  for (const theme of ["dark", "light"]) {
    rendered[theme] = reg().fn(state.grid, { ...opts, theme, onStats: (s) => { if (theme === state.theme) state.stats = s; } });
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(new Blob([rendered[state.theme]], { type: "image/svg+xml" }));
  const img = $("preview");
  img.src = previewUrl;
  img.alt = reg().alt;

  const s = state.stats;
  const src = state.gridIsLive ? `@${state.user}` : "SAMPLE GRID";
  if (s.fate) {
    const fateText = s.fate === "still" ? "STILL LIFE"
      : s.fate === "extinct" ? "EXTINCT"
      : s.fate === "oscillator" ? `PERIOD ${s.period}`
      : "CHAOS";
    $("stats").innerHTML = `
    <span>GRID <b>${src}</b></span>
    <span>GENS <b>0→${s.gens}</b></span>
    <span>LIVE <b>${s.living}/${s.startLiving}</b></span>
    <span>FATE <b>${fateText}</b></span>
    <span>SEED <b>${effectiveSeed()}</b></span>
    <span>LOOP <b>${s.duration}S</b></span>`;
  } else {
    const name = reg().levelNames[effectiveLevel() - 1];
    const battle = s.ending
      ? `<span>ENDING <b>${s.ending}</b></span><span>BOSS HP <b>${s.bossHP}</b></span><span>HITS LANDED <b>${s.hits}</b></span>`
      : `<span>WAVE <b>${s.enemies}</b></span><span>KILLS <b>${s.kills}</b></span><span class="warn">LEAKED <b>${s.leaked}</b></span>${s.verdict ? `<span>VERDICT <b>${s.verdict}</b></span>` : ""}`;
    $("stats").innerHTML = `
    <span>GRID <b>${src}</b></span>
    <span>${reg().levelWord.toUpperCase()} <b>${effectiveLevel()} ${name}</b></span>
    <span>SEED <b>${effectiveSeed()}</b></span>
    <span>TOWERS <b>${s.towers}</b></span>
    ${battle}
    <span>LOOP <b>${s.duration}S</b></span>`;
    $("levelnote").textContent = state.level === "rotate" ? reg().rotateHint(name) : reg().fixedHint(name);
  }

  $("seednote").textContent = state.seedMode === "daily"
    ? (reg().dailySeedHint || "The cron bakes a new battle every day.")
    : (reg().fixedSeedHint ? reg().fixedSeedHint(state.seed) : `Locked to seed ${state.seed}. The same battle until you change it.`);

  renderSnippets();
}

function syncBlockUI() {
  const r = reg();
  $("control-level").hidden = !!r.noLevel;
  $("control-range").hidden = !r.hasRangeRings;
  $("how-balance").hidden = !!r.noLevel && !r.howExtra;
  $("seed-label").textContent = r.seedLabel || "Battle seed";
  $("title-hint").textContent = r.titleHint || "Battle stats get appended after the title.";
  $("ship-verb").textContent = r.shipVerb || "rebuilds the battle";
  $("how-bake").textContent = r.howBake || "The sim runs once, at generation time. Every laser flash and every death becomes a CSS keyframe. The SVG that ships contains no code, only choreography.";
  $("how-det").textContent = r.howDet || "Same grid, same level, same seed: the identical battle, in both themes. Rotation comes from the cron changing the seed each day, not from dice at view time.";
  $("how-extra-name").textContent = r.howExtraName || "Balanced to your graph";
  $("how-extra").textContent = r.howExtra || "Days at contribution level 3 or 4 become towers. A sparse graph promotes level-2 days until there are at least eight; a dense one gets thinned, and enemy HP scales with the tower count. Level 1 is winnable everywhere. Level 3 is not.";
  if (!r.noLevel) {
    const segButtons = $("levelseg").querySelectorAll("button[data-level]");
    segButtons.forEach((b) => {
      if (b.dataset.level !== "rotate") b.textContent = `${b.dataset.level} ${r.levelNames[+b.dataset.level - 1]}`;
    });
    document.querySelector("#lvl-label").textContent = r.levelWord;
  }
  $("how-name").textContent = r.howName;
  $("how-text").textContent = r.how;
  if (!state.titleDirty) {
    state.title = r.defaultTitle;
    $("title").value = r.defaultTitle;
  }
}

// -------------------------------------------------------------------- exports

function yamlQuote(s) { return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`; }

function renderSnippets() {
  const user = state.user;
  const level = state.level === "rotate" ? "rotate" : String(state.level);
  const seed = state.seedMode === "daily" ? "daily" : String(state.seed);
  const block = state.block;
  const r = reg();
  $("wfpath").textContent = `.github/workflows/${block}.yml`;
  const envLines = [
    `          BLOCK: ${yamlQuote(block)}`,
    `          PROFILE_USER: ${yamlQuote(user)}`,
  ];
  if (!r.noLevel) {
    envLines.push(`          LD_LEVEL: ${yamlQuote(level)} # 1 | 2 | 3 | rotate`);
  }
  envLines.push(`          LD_SEED: ${yamlQuote(seed)} # ${r.noLevel ? "daily = new born-cell tints every run" : "daily = new battle every run"}`);
  envLines.push(`          LD_TITLE: ${yamlQuote(state.title || r.defaultTitle)}`);
  if (r.hasRangeRings) {
    envLines.push(`          LD_RANGE_RINGS: ${yamlQuote(state.rangeRings ? "on" : "off")} # on | off`);
  }
  const cronNote = r.cronNote || "daily; rotates the battle";
  const stepName = r.workflowStep || "Simulate today's battle";
  const commitMsg = r.workflowCommit || `Update ${block} battle`;
  $("yaml").textContent = `name: ${r.workflowName}

on:
  schedule:
    - cron: "15 0 * * *" # ${cronNote}
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout the renderer (okturan/github-blocks)
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          repository: okturan/github-blocks
          ref: ${state.renderSha}

      - name: ${stepName}
        env:
${envLines.join("\n")}
        run: node action/generate.mjs

      - name: Publish to output branch
        run: |
          cd dist
          git init -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "${commitMsg}"
          git push --force "https://x-access-token:\${{ github.token }}@github.com/\${{ github.repository }}.git" output`;

  const raw = (f) => `https://raw.githubusercontent.com/${user}/${user}/output/${f}`;
  $("embed").textContent = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${raw(`${block}.svg`)}">
  <source media="(prefers-color-scheme: light)" srcset="${raw(`${block}-light.svg`)}">
  <img alt="${reg().embedAlt || "Tower defense battle animated over my GitHub contribution graph"}" src="${raw(`${block}.svg`)}">
</picture>`;
}

async function pinRendererSha() {
  try {
    const res = await fetch("https://api.github.com/repos/okturan/github-blocks/commits/main", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const sha = (await res.json()).sha;
    if (/^[a-f0-9]{40}$/.test(sha)) {
      state.renderSha = sha;
      renderSnippets();
      renderHabitsSnippets();
    }
  } catch { /* keep "main" */ }
}

function download(theme) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rendered[theme]], { type: "image/svg+xml" }));
  a.download = theme === "dark" ? `${state.block}.svg` : `${state.block}-light.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const MP4_NOTE_READY = "Chrome and Edge can encode one full loop of this preview as a silent H.264 file. The file matches the current theme, title, seed, and range rings.";
const MP4_NOTE_UNSUPPORTED = "This browser cannot encode H.264. Open this page in Chrome or Edge.";
let mp4Busy = false;

function setMp4IdleState() {
  const button = $("dl-mp4");
  const note = $("mp4-note");
  if (!button || !note) return;
  button.textContent = "EXPORT MP4";
  if (!canEncodeMp4()) {
    button.disabled = true;
    note.textContent = MP4_NOTE_UNSUPPORTED;
    return;
  }
  button.disabled = mp4Busy;
  if (!mp4Busy) note.textContent = MP4_NOTE_READY;
}

async function exportMp4() {
  const button = $("dl-mp4");
  const note = $("mp4-note");
  if (mp4Busy) return;
  if (!canEncodeMp4()) {
    note.textContent = MP4_NOTE_UNSUPPORTED;
    button.disabled = true;
    return;
  }
  const duration = state.stats?.duration;
  const svgText = rendered[state.theme];
  if (!svgText || !Number.isFinite(duration) || duration <= 0) {
    note.classList.add("error");
    note.textContent = "This preview has no timed loop to export.";
    return;
  }

  mp4Busy = true;
  button.disabled = true;
  note.classList.remove("error");
  note.textContent = "Encoding the loop.";
  try {
    const filename = state.theme === "light" ? `${state.block}-light.mp4` : `${state.block}.mp4`;
    button.setAttribute("aria-busy", "true");
    const buffer = await exportSvgLoopToMp4({
      svgText,
      theme: state.theme,
      durationSec: duration,
      onProgress: (done, total) => {
        note.textContent = `Encoding frame ${done} / ${total}`;
        button.textContent = `FRAME ${done}/${total}`;
      },
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buffer], { type: "video/mp4" }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    note.textContent = `Saved ${filename}.`;
  } catch (error) {
    note.classList.add("error");
    note.textContent = error instanceof Error ? error.message : "MP4 export failed.";
  } finally {
    mp4Busy = false;
    button.textContent = "EXPORT MP4";
    button.removeAttribute("aria-busy");
    button.disabled = !canEncodeMp4();
  }
}

// -------------------------------------------------------------- coding habits

function sampleCommits() {
  const now = new Date();
  return Array.from({ length: 120 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (index % 42));
    date.setUTCHours(8 + ((index * 7) % 12), (index * 13) % 60, 0, 0);
    return { date: date.toISOString() };
  });
}

const habits = {
  user: "okturan",
  limit: 500,
  timeZone: "UTC",
  windowHours: 3,
  theme: "dark",
  title: "RECENT PUBLIC CODING HABITS",
  commits: sampleCommits(),
  live: false,
};
const renderedHabits = { dark: "", light: "" };
let habitsPreviewUrl = null;

function renderHabitsSnippets() {
  if (!$("habits-yaml")) return;
  $("habits-yaml").textContent = `name: Update coding habits

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
          ref: ${state.renderSha}
          path: renderer

      - name: Generate the report
        env:
          GITHUB_TOKEN: \${{ github.token }}
          PROFILE_USER: ${yamlQuote(habits.user)}
          HABITS_LIMIT: ${yamlQuote(habits.limit)}
          HABITS_TIMEZONE: ${yamlQuote(habits.timeZone)}
          HABITS_WINDOW: ${yamlQuote(habits.windowHours)}
          HABITS_TITLE: ${yamlQuote(habits.title || "RECENT PUBLIC CODING HABITS")}
          HABITS_OUT: \${{ github.workspace }}/generated
        run: node renderer/action/generate-coding-habits.mjs

      - name: Publish generated files
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          mkdir output
          cd output
          git init
          git remote add origin "https://x-access-token:\${GH_TOKEN}@github.com/\${GITHUB_REPOSITORY}.git"
          if git ls-remote --exit-code --heads origin output >/dev/null 2>&1; then
            git fetch --depth=1 origin output
            git checkout -b output FETCH_HEAD
          else
            git checkout -b output
          fi
          cp ../generated/coding-habits*.svg .
          git add coding-habits.svg coding-habits-light.svg
          git diff --cached --quiet && exit 0
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "Update coding habits"
          git push origin output`;

  const raw = (file) => `https://raw.githubusercontent.com/${habits.user}/${habits.user}/output/${file}`;
  $("habits-embed").textContent = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${raw("coding-habits.svg")}">
  <source media="(prefers-color-scheme: light)" srcset="${raw("coding-habits-light.svg")}">
  <img alt="My recent public coding habits" src="${raw("coding-habits.svg")}">
</picture>`;
}

function renderHabits() {
  let summary;
  const note = $("habits-note");
  note.classList.remove("error");
  try {
    summary = analyzeCodingHabits(habits.commits, {
      timeZone: habits.timeZone,
      windowHours: habits.windowHours,
    });
  } catch (error) {
    note.classList.add("error");
    note.textContent = `Cannot render this timezone (${error.message}).`;
    return;
  }

  for (const theme of ["dark", "light"]) {
    renderedHabits[theme] = codingHabits(summary, {
      theme,
      title: habits.title || "RECENT PUBLIC CODING HABITS",
    });
  }
  if (habitsPreviewUrl) URL.revokeObjectURL(habitsPreviewUrl);
  habitsPreviewUrl = URL.createObjectURL(new Blob([renderedHabits[habits.theme]], { type: "image/svg+xml" }));
  $("habits-preview").src = habitsPreviewUrl;
  $("habits-stats").innerHTML = `
    <span>SOURCE <b>${habits.live ? `@${habits.user}` : "SAMPLE DATES"}</b></span>
    <span>COMMITS <b>${summary.sampleSize}</b></span>
    <span>ACTIVE DATES <b>${summary.activeDates}</b></span>
    <span>BUSIEST DAY <b>${summary.mostActiveDay.toUpperCase()}</b></span>
    <span>WINDOW <b>${summary.commonWindow}</b></span>`;
  renderHabitsSnippets();
}

async function loadHabits() {
  const note = $("habits-note");
  const button = $("habits-load");
  const user = $("habits-user").value.trim();
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(user)) {
    note.classList.add("error");
    note.textContent = "That does not look like a GitHub username.";
    return;
  }

  habits.user = user;
  habits.limit = Number($("habits-limit").value);
  habits.timeZone = $("habits-timezone").value.trim() || "UTC";
  habits.windowHours = Number($("habits-window").value);
  habits.title = $("habits-title").value;
  button.disabled = true;
  note.classList.remove("error");
  note.textContent = `Searching GitHub for up to ${habits.limit} recent public commits by ${user}.`;
  try {
    const commits = await fetchRecentPublicCommits(user, { limit: habits.limit });
    if (!commits.length) throw new Error("GitHub returned no indexed public non-merge commits");
    habits.commits = commits;
    habits.live = true;
    renderHabits();
    note.textContent = `Loaded ${commits.length} indexed public non-merge commits for ${user}.`;
  } catch (error) {
    note.classList.add("error");
    note.textContent = `Live preview failed: ${error.message}. The generated workflow uses a token and has a higher rate limit.`;
  } finally {
    button.disabled = false;
  }
}

// ---------------------------------------------------------------- media cards

const MEDIA_LAYOUTS = {
  "cinematic-strip": { fn: cinematicStrip, importName: "cinematicStrip" },
  "poster-cards": { fn: posterCards, importName: "posterCards" },
  "media-list": { fn: mediaList, importName: "mediaList" },
  "classic-cards": { fn: classicCards, importName: "classicCards" },
};
const media = { layout: "cinematic-strip", items: [] };
const MEDIA_FIELDS = "id idMal title{romaji english} startDate{year} episodes averageScore genres coverImage{large color} siteUrl";

async function anilist(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  return (await res.json()).data;
}

function mapMedia(m) {
  return {
    id: m.id,
    title: m.title.romaji || m.title.english,
    year: m.startDate?.year ?? "",
    episodes: m.episodes ?? "?",
    score: m.averageScore ?? undefined,
    genres: (m.genres ?? []).slice(0, 3),
    url: m.idMal ? `https://myanimelist.net/anime/${m.idMal}` : m.siteUrl,
    color: m.coverImage?.color || "#30363d",
    coverUrl: m.coverImage?.large || "",
    cover: null, // data URI, filled in by inlineCover
  };
}

async function inlineCover(item) {
  if (!item.coverUrl) return;
  try {
    // cache: "reload" skips the HTTP cache. A plain <img> load of the same
    // URL caches a response without CORS headers (the CDN varies on Origin),
    // and reading that entry here would fail the CORS check.
    const blob = await (await fetch(item.coverUrl, { mode: "cors", cache: "reload" })).blob();
    item.cover = await new Promise((ok, err) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = err;
      r.readAsDataURL(blob);
    });
  } catch { /* placeholder initials until the CDN cooperates */ }
}

let mediaUrl = null;
function renderMedia() {
  const layout = MEDIA_LAYOUTS[media.layout];
  const img = $("media-preview");
  if (media.items.length) {
    const svg = layout.fn(media.items);
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.src = mediaUrl;
    img.hidden = false;
  } else {
    img.hidden = true;
  }

  const picked = $("picked");
  picked.innerHTML = "";
  if (!media.items.length) {
    picked.innerHTML = `<li class="empty">Nothing selected. Search on the left.</li>`;
  }
  for (const item of media.items) {
    const li = document.createElement("li");
    const thumb = document.createElement("img");
    thumb.crossOrigin = "anonymous"; // keep the CDN cache entry CORS-clean
    thumb.src = item.cover || item.coverUrl;
    thumb.alt = "";
    const t = document.createElement("span");
    t.className = "ptitle";
    t.textContent = item.title;
    const y = document.createElement("span");
    y.className = "pyear";
    y.textContent = item.year;
    const rm = document.createElement("button");
    rm.textContent = "✕";
    rm.setAttribute("aria-label", `Remove ${item.title}`);
    rm.addEventListener("click", () => {
      media.items = media.items.filter((i) => i.id !== item.id);
      renderMedia();
    });
    li.append(thumb, t, y, rm);
    picked.append(li);
  }

  const itemLines = media.items.map((i) => {
    const fields = [
      `title: ${JSON.stringify(i.title)}`,
      `year: ${JSON.stringify(i.year)}`,
      `episodes: ${JSON.stringify(i.episodes)}`,
      i.score !== undefined ? `score: ${i.score}` : null,
      `genres: ${JSON.stringify(i.genres)}`,
      `url: ${JSON.stringify(i.url)}`,
      `color: ${JSON.stringify(i.color)}`,
      `cover: await toDataUri(${JSON.stringify(i.coverUrl)})`,
    ].filter(Boolean);
    return `  {\n    ${fields.join(",\n    ")},\n  },`;
  }).join("\n");
  // ".mjs" is split so the deploy-time cache-busting sed (which versions every
  // local module reference) leaves this user-facing snippet alone.
  const EXT = ".m" + "js";
  $("media-code").textContent = `// node >= 18, from a checkout of okturan/github-blocks
import { writeFileSync } from "node:fs";
import { ${layout.importName} } from "./blocks/${media.layout}${EXT}";

const toDataUri = async (url) => {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return \`data:image/jpeg;base64,\${buf.toString("base64")}\`;
};

const items = [
${itemLines || "  // add items in the configurator"}
];

writeFileSync("${media.layout}.svg", ${layout.importName}(items));`;
}

async function addMedia(raw) {
  if (media.items.length >= 6 || media.items.some((i) => i.id === raw.id)) return;
  const item = mapMedia(raw);
  media.items.push(item);
  renderMedia();
  await inlineCover(item);
  renderMedia();
}

function closeResults() {
  $("anime-results").hidden = true;
  $("anime-q").setAttribute("aria-expanded", "false");
}

let searchTimer, searchSeq = 0;
$("anime-q").addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = $("anime-q").value.trim();
  if (q.length < 2) { closeResults(); return; }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    try {
      const data = await anilist(
        `query ($q: String) { Page(perPage: 7) { media(search: $q, type: ANIME) { ${MEDIA_FIELDS} } } }`,
        { q },
      );
      if (seq !== searchSeq) return; // a newer search finished first
      const host = $("anime-results");
      host.innerHTML = "";
      for (const m of data.Page.media) {
        const btn = document.createElement("button");
        btn.setAttribute("role", "option");
        const thumb = document.createElement("img");
        thumb.crossOrigin = "anonymous";
        thumb.src = m.coverImage?.large || "";
        thumb.alt = "";
        thumb.loading = "lazy";
        const t = document.createElement("span");
        t.className = "rtitle";
        t.textContent = m.title.romaji || m.title.english;
        const meta = document.createElement("span");
        meta.className = "rmeta";
        meta.textContent = [m.startDate?.year, m.averageScore ? `★ ${(m.averageScore / 10).toFixed(1)}` : null].filter(Boolean).join(" · ");
        btn.append(thumb, t, meta);
        btn.addEventListener("click", () => {
          addMedia(m);
          $("anime-q").value = "";
          closeResults();
        });
        host.append(btn);
      }
      host.hidden = !data.Page.media.length;
      $("anime-q").setAttribute("aria-expanded", String(!host.hidden));
    } catch (err) {
      $("media-note").textContent = `Search failed (${err.message}). AniList allows 90 requests a minute. Wait a moment and try again.`;
    }
  }, 350);
});
$("anime-q").addEventListener("keydown", (e) => { if (e.key === "Escape") closeResults(); });
document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) closeResults(); });

// Start with the shelf from okturan/okturan so the section isn't empty.
async function bootMedia() {
  renderMedia();
  try {
    const ids = [13125, 2246, 171018];
    const data = await anilist(
      `query ($ids: [Int]) { Page(perPage: 10) { media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } } }`,
      { ids },
    );
    const byId = new Map(data.Page.media.map((m) => [m.id, m]));
    for (const id of ids) if (byId.has(id)) await addMedia(byId.get(id));
  } catch { /* section stays empty with the search prompt */ }
}

// ---------------------------------------------------------------------- wiring

// Side panel: one list for every block. The matching view opens on the stage.
function updateHero(kind) {
  const copy = HERO_COPY[kind];
  $("hero-title").innerHTML = copy.title;
  $("hero-lede").textContent = copy.lede;
  document.title = copy.pageTitle;
}

function selectBlock(kind, id) {
  for (const b of $("side").querySelectorAll(".sideitem")) {
    b.setAttribute("aria-pressed", b.dataset.id === id);
  }
  $("view-defense").hidden = kind !== "defense" && kind !== "life";
  $("view-habits").hidden = kind !== "habits";
  $("view-media").hidden = kind !== "media";
  updateHero(kind);
  if (kind === "defense" || kind === "life") {
    state.block = id;
    syncBlockUI();
    render();
  } else if (kind === "habits") {
    renderHabits();
  } else {
    media.layout = id;
    renderMedia();
  }
}
$("side").addEventListener("click", (e) => {
  const btn = e.target.closest(".sideitem[data-id]");
  if (!btn) return;
  selectBlock(btn.dataset.kind, btn.dataset.id);
});

$("load").addEventListener("click", () => {
  const user = $("user").value.trim();
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(user)) {
    $("gridnote").classList.add("error");
    $("gridnote").textContent = "That doesn't look like a GitHub username.";
    return;
  }
  state.user = user;
  loadGrid(user);
});
$("user").addEventListener("keydown", (e) => { if (e.key === "Enter") $("load").click(); });

$("levelseg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-level]");
  if (!btn) return;
  state.level = btn.dataset.level === "rotate" ? "rotate" : +btn.dataset.level;
  for (const b of $("levelseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b === btn);
  render();
});

$("seed-daily").addEventListener("click", () => {
  state.seedMode = "daily";
  $("seed-daily").setAttribute("aria-pressed", "true");
  $("seed-reroll").setAttribute("aria-pressed", "false");
  render();
});
$("seed-reroll").addEventListener("click", () => {
  state.seedMode = "fixed";
  state.seed = Math.floor(Math.random() * 1_000_000);
  $("seed-daily").setAttribute("aria-pressed", "false");
  $("seed-reroll").setAttribute("aria-pressed", "true");
  render();
});

$("rangeseg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-range]");
  if (!btn) return;
  state.rangeRings = btn.dataset.range !== "off";
  for (const b of $("rangeseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b === btn);
  render();
});

$("themeseg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-theme]");
  if (!btn) return;
  state.theme = btn.dataset.theme;
  for (const b of $("themeseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b === btn);
  render();
});

let titleTimer;
$("title").addEventListener("input", () => {
  clearTimeout(titleTimer);
  titleTimer = setTimeout(() => {
    state.title = $("title").value;
    state.titleDirty = $("title").value.trim() !== "" && $("title").value !== reg().defaultTitle;
    render();
  }, 250);
});

$("habits-load").addEventListener("click", loadHabits);
$("habits-user").addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadHabits();
});
$("habits-themeseg").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-theme]");
  if (!button) return;
  habits.theme = button.dataset.theme;
  for (const item of $("habits-themeseg").querySelectorAll("button")) {
    item.setAttribute("aria-pressed", item === button);
  }
  renderHabits();
});
for (const id of ["habits-limit", "habits-timezone", "habits-window", "habits-title"]) {
  $(id).addEventListener("change", () => {
    habits.limit = Number($("habits-limit").value);
    habits.timeZone = $("habits-timezone").value.trim() || "UTC";
    habits.windowHours = Number($("habits-window").value);
    habits.title = $("habits-title").value;
    renderHabits();
  });
}

// Output tabs.
const tabs = ["workflow", "embed", "download", "how"];
for (const t of tabs) {
  $(`tab-${t}`).addEventListener("click", () => {
    for (const o of tabs) {
      $(`tab-${o}`).setAttribute("aria-selected", o === t);
      $(`panel-${o}`).hidden = o !== t;
    }
  });
}

for (const btn of document.querySelectorAll("button.copy")) {
  btn.addEventListener("click", async () => {
    await navigator.clipboard.writeText($(btn.dataset.copy).textContent);
    const was = btn.textContent;
    btn.textContent = "COPIED ✓";
    setTimeout(() => { btn.textContent = was; }, 1400);
  });
}

$("dl-dark").addEventListener("click", () => download("dark"));
$("dl-light").addEventListener("click", () => download("light"));
$("dl-mp4").addEventListener("click", () => exportMp4());
setMp4IdleState();

// ----------------------------------------------------------------------- boot

// Deep links such as #night-shift and #coding-habits select a block on load.
const hashItem = document.querySelector(`.sideitem[data-id="${CSS.escape(location.hash.slice(1))}"]`);
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (browserTimeZone) {
  habits.timeZone = browserTimeZone;
  $("habits-timezone").value = browserTimeZone;
}
syncBlockUI();
updateHero("defense");
render();
renderHabits();
bootMedia();
pinRendererSha();
loadGrid("okturan");
if (hashItem) selectBlock(hashItem.dataset.kind, hashItem.dataset.id);

// Configurator logic. The same modules that run in GitHub Actions render the
// previews here, client-side.
import { laneDefense } from "./blocks/lane-defense.mjs";
import { nightShift } from "./blocks/night-shift.mjs";
import { bossFight } from "./blocks/boss-fight.mjs";
import { sampleContributionGrid } from "./lib/contrib.mjs";
import { cinematicStrip } from "./blocks/cinematic-strip.mjs";
import { posterCards } from "./blocks/poster-cards.mjs";
import { mediaList } from "./blocks/media-list.mjs";
import { classicCards } from "./blocks/classic-cards.mjs";

const $ = (id) => document.getElementById(id);
const DAY = Math.floor(Date.now() / 86_400_000);

const REGISTRY = {
  "lane-defense": {
    fn: laneDefense,
    workflowName: "Commit defense",
    defaultTitle: "COMMIT DEFENSE",
    levelNames: ["PATROL", "SIEGE", "OVERRUN"],
    levelWord: "Difficulty",
    rotateHint: (name) => `Cycles PATROL → SIEGE → OVERRUN each day (today: ${name}).`,
    fixedHint: (name) => `Fixed at ${name} on every regeneration.`,
    alt: "Tower defense preview: bug waves march the weekday rows while towers on big commit days fire lasers",
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
  title: "COMMIT DEFENSE",
  titleDirty: false,
  stats: null,
  renderSha: "main",
};

// ---------------------------------------------------------------- grid loading

function toGrid(contributions) {
  // One entry per day, Sunday-aligned, oldest first — the same layout as
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
    note.textContent = `Live graph loaded — ${data.total?.lastYear ?? "?"} contributions in the last year.`;
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
  const opts = { level: effectiveLevel(), seed: effectiveSeed(), title: state.title || reg().defaultTitle };
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
  const name = reg().levelNames[effectiveLevel() - 1];
  const battle = s.ending
    ? `<span>ENDING <b>${s.ending}</b></span><span>BOSS HP <b>${s.bossHP}</b></span><span>HITS LANDED <b>${s.hits}</b></span>`
    : `<span>WAVE <b>${s.enemies}</b></span><span>KILLS <b>${s.kills}</b></span><span class="warn">LEAKED <b>${s.leaked}</b></span>`;
  $("stats").innerHTML = `
    <span>GRID <b>${src}</b></span>
    <span>${reg().levelWord.toUpperCase()} <b>${effectiveLevel()} ${name}</b></span>
    <span>SEED <b>${effectiveSeed()}</b></span>
    <span>TOWERS <b>${s.towers}</b></span>
    ${battle}
    <span>LOOP <b>${s.duration}S</b></span>`;

  $("levelnote").textContent = state.level === "rotate" ? reg().rotateHint(name) : reg().fixedHint(name);
  $("seednote").textContent = state.seedMode === "daily"
    ? "The cron bakes a new battle every day."
    : `Locked to seed ${state.seed}. The same battle until you change it.`;

  renderSnippets();
}

function syncBlockUI() {
  const r = reg();
  for (const b of $("modules").querySelectorAll(".module")) {
    b.setAttribute("aria-pressed", b.dataset.block === state.block);
  }
  const segButtons = $("levelseg").querySelectorAll("button[data-level]");
  segButtons.forEach((b) => {
    if (b.dataset.level !== "rotate") b.textContent = `${b.dataset.level} ${r.levelNames[+b.dataset.level - 1]}`;
  });
  document.querySelector("#lvl-label").textContent = r.levelWord;
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
  $("wfpath").textContent = `.github/workflows/${block}.yml`;
  $("yaml").textContent = `name: ${reg().workflowName}

on:
  schedule:
    - cron: "15 0 * * *" # daily — rotates the battle
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

      - name: Simulate today's battle
        env:
          BLOCK: ${yamlQuote(block)}
          PROFILE_USER: ${yamlQuote(user)}
          LD_LEVEL: ${yamlQuote(level)} # 1 | 2 | 3 | rotate
          LD_SEED: ${yamlQuote(seed)} # daily = new battle every run
          LD_TITLE: ${yamlQuote(state.title || reg().defaultTitle)}
        run: node action/generate.mjs

      - name: Publish to output branch
        run: |
          cd dist
          git init -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Update ${block} battle"
          git push --force "https://x-access-token:\${{ github.token }}@github.com/\${{ github.repository }}.git" output`;

  const raw = (f) => `https://raw.githubusercontent.com/${user}/${user}/output/${f}`;
  $("embed").textContent = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${raw(`${block}.svg`)}">
  <source media="(prefers-color-scheme: light)" srcset="${raw(`${block}-light.svg`)}">
  <img alt="Tower defense battle animated over my GitHub contribution graph" src="${raw(`${block}.svg`)}">
</picture>`;
}

async function pinRendererSha() {
  try {
    const res = await fetch("https://api.github.com/repos/okturan/github-blocks/commits/main", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const sha = (await res.json()).sha;
    if (/^[a-f0-9]{40}$/.test(sha)) { state.renderSha = sha; renderSnippets(); }
  } catch { /* keep "main" */ }
}

function download(theme) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rendered[theme]], { type: "image/svg+xml" }));
  a.download = theme === "dark" ? `${state.block}.svg` : `${state.block}-light.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// -------------------------------------------------------------------- gallery

function galleryItems() {
  return [
    { title: "Shinsekai yori", year: 2012, episodes: 25, score: 84, genres: ["Drama", "Mystery", "Psychological"], url: "#", color: "#1f3a5f" },
    { title: "Mononoke", year: 2007, episodes: 12, score: 82, genres: ["Horror", "Mystery", "Supernatural"], url: "#", color: "#7a4a1f" },
    { title: "DAN DA DAN", year: 2024, episodes: 12, score: 84, genres: ["Action", "Comedy", "Supernatural"], url: "#", color: "#5f1f4a" },
  ];
}

function buildGallery() {
  const blocks = [
    ["cinematic-strip", "cover art as the card backdrop, title overlaid", cinematicStrip],
    ["poster-cards", "full-bleed posters with score and genre chips", posterCards],
    ["media-list", "one panel, numbered rows", mediaList],
    ["classic-cards", "the original okturan layout", classicCards],
  ];
  const host = $("gallery");
  for (const [name, blurb, fn] of blocks) {
    const svg = fn(galleryItems());
    const fig = document.createElement("figure");
    const frame = document.createElement("div");
    frame.className = "frame";
    const img = document.createElement("img");
    img.alt = `${name} block rendered with sample data`;
    img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    frame.append(img);
    const cap = document.createElement("figcaption");
    cap.innerHTML = `<b>${name}</b> — ${blurb}`;
    fig.append(frame, cap);
    host.append(fig);
  }
}

// ---------------------------------------------------------------------- wiring

$("modules").addEventListener("click", (e) => {
  const btn = e.target.closest(".module[data-block]");
  if (!btn || btn.dataset.block === state.block) return;
  state.block = btn.dataset.block;
  syncBlockUI();
  render();
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

// Output tabs.
const tabs = ["workflow", "embed", "download"];
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

// ----------------------------------------------------------------------- boot

syncBlockUI();
render();
buildGallery();
pinRendererSha();
loadGrid("okturan");

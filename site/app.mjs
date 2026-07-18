// Configurator for the lane-defense block. The exact same modules that run in
// GitHub Actions render the previews here, client-side.
import { laneDefense, LEVELS } from "./blocks/lane-defense.mjs";
import { sampleContributionGrid } from "./lib/contrib.mjs";
import { cinematicStrip } from "./blocks/cinematic-strip.mjs";
import { posterCards } from "./blocks/poster-cards.mjs";
import { mediaList } from "./blocks/media-list.mjs";
import { classicCards } from "./blocks/classic-cards.mjs";

const $ = (id) => document.getElementById(id);
const DAY = Math.floor(Date.now() / 86_400_000);

const state = {
  user: "okturan",
  grid: sampleContributionGrid(7),
  gridIsLive: false,
  level: "rotate", // 1 | 2 | 3 | "rotate"
  seedMode: "daily", // "daily" | "fixed"
  seed: DAY,
  theme: "dark",
  title: "COMMIT DEFENSE",
  stats: null,
  renderSha: "main",
};

// ---------------------------------------------------------------- grid loading

function toGrid(contributions) {
  // API returns one entry per day, Sunday-aligned, oldest first — same layout
  // as github.com's own graph. Chunk into weeks × 7, pad the tail.
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
    note.textContent = `Couldn't fetch that graph (${err.message}). Showing sample data — the workflow will still use your real graph.`;
  }
  render();
}

// ------------------------------------------------------------------- rendering

let previewUrl = null;
const rendered = { dark: "", light: "" };

function effectiveLevel() { return state.level === "rotate" ? 1 + (DAY % 3) : state.level; }
function effectiveSeed() { return state.seedMode === "daily" ? DAY : state.seed; }

function render() {
  const opts = { level: effectiveLevel(), seed: effectiveSeed(), title: state.title || "COMMIT DEFENSE" };
  for (const theme of ["dark", "light"]) {
    rendered[theme] = laneDefense(state.grid, { ...opts, theme, onStats: (s) => { if (theme === state.theme) state.stats = s; } });
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(new Blob([rendered[state.theme]], { type: "image/svg+xml" }));
  $("preview").src = previewUrl;

  const s = state.stats;
  const src = state.gridIsLive ? `@${state.user}` : "SAMPLE GRID";
  $("stats").innerHTML = `
    <span>GRID <b>${src}</b></span>
    <span>LVL <b>${effectiveLevel()} ${LEVELS[effectiveLevel() - 1].name}</b></span>
    <span>SEED <b>${effectiveSeed()}</b></span>
    <span>TOWERS <b>${s.towers}</b></span>
    <span>WAVE <b>${s.enemies}</b></span>
    <span>KILLS <b>${s.kills}</b></span>
    <span class="warn">LEAKED <b>${s.leaked}</b></span>
    <span>LOOP <b>${s.duration}S</b></span>`;

  $("levelnote").textContent = state.level === "rotate"
    ? `Cycles PATROL → SIEGE → OVERRUN each day (today: ${LEVELS[effectiveLevel() - 1].name}).`
    : `Fixed at ${LEVELS[effectiveLevel() - 1].name} every regeneration.`;
  $("seednote").textContent = state.seedMode === "daily"
    ? "The cron bakes a brand-new battle every day."
    : `Locked to seed ${state.seed} — same battle until you change it.`;

  renderSnippets();
}

// -------------------------------------------------------------------- exports

function yamlQuote(s) { return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`; }

function renderSnippets() {
  const user = state.user;
  const level = state.level === "rotate" ? "rotate" : String(state.level);
  const seed = state.seedMode === "daily" ? "daily" : String(state.seed);
  $("wfpath").textContent = ".github/workflows/lane-defense.yml";
  $("yaml").textContent = `name: Lane defense

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
          PROFILE_USER: ${yamlQuote(user)}
          LD_LEVEL: ${yamlQuote(level)} # 1 PATROL · 2 SIEGE · 3 OVERRUN · rotate
          LD_SEED: ${yamlQuote(seed)} # daily = fresh battle every run
          LD_TITLE: ${yamlQuote(state.title || "COMMIT DEFENSE")}
        run: node action/generate-lane-defense.mjs

      - name: Publish to output branch
        run: |
          cd dist
          git init -b output
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "Update lane defense battle"
          git push --force "https://x-access-token:\${{ github.token }}@github.com/\${{ github.repository }}.git" output`;

  const raw = (f) => `https://raw.githubusercontent.com/${user}/${user}/output/${f}`;
  $("embed").textContent = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="${raw("lane-defense.svg")}">
  <source media="(prefers-color-scheme: light)" srcset="${raw("lane-defense-light.svg")}">
  <img alt="Tower defense battle animated over my GitHub contribution graph" src="${raw("lane-defense.svg")}">
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
  a.download = theme === "dark" ? "lane-defense.svg" : "lane-defense-light.svg";
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
    ["cinematic-strip", "cover art backdrop, title overlaid", cinematicStrip],
    ["poster-cards", "full-bleed posters, score + genre chips", posterCards],
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
  titleTimer = setTimeout(() => { state.title = $("title").value; render(); }, 250);
});

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

render();
buildGallery();
pinRendererSha();
loadGrid("okturan");

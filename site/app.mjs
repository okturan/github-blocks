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
    const blob = await (await fetch(item.coverUrl, { mode: "cors" })).blob();
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
    picked.innerHTML = `<li class="empty">Nothing yet — search on the left.</li>`;
  }
  for (const item of media.items) {
    const li = document.createElement("li");
    const thumb = document.createElement("img");
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
  $("media-code").textContent = `// node >= 18, from a checkout of okturan/github-blocks
import { writeFileSync } from "node:fs";
import { ${layout.importName} } from "./blocks/${media.layout}.mjs";

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
      $("media-note").textContent = `Search failed (${err.message}). AniList rate-limits at 90 requests a minute — wait a moment.`;
    }
  }, 350);
});
$("anime-q").addEventListener("keydown", (e) => { if (e.key === "Escape") closeResults(); });
document.addEventListener("click", (e) => { if (!e.target.closest(".search-wrap")) closeResults(); });

$("layoutseg").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-layout]");
  if (!btn) return;
  media.layout = btn.dataset.layout;
  for (const b of $("layoutseg").querySelectorAll("button")) b.setAttribute("aria-pressed", b === btn);
  renderMedia();
});

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
bootMedia();
pinRendererSha();
loadGrid("okturan");

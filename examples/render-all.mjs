#!/usr/bin/env node
// Renders every block with sample data (placeholder covers) into examples/out/.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cinematicStrip } from "../blocks/cinematic-strip.mjs";
import { posterCards } from "../blocks/poster-cards.mjs";
import { mediaList } from "../blocks/media-list.mjs";
import { classicCards } from "../blocks/classic-cards.mjs";
import { laneDefense } from "../blocks/lane-defense.mjs";
import { sampleContributionGrid } from "../lib/contrib.mjs";

const items = [
  { title: "Shinsekai yori", year: 2012, episodes: 25, score: 84, genres: ["Drama", "Mystery", "Psychological"], url: "https://anilist.co/anime/13125/Shinsekai-yori/", color: "#1f3a5f" },
  { title: "Mononoke", year: 2007, episodes: 12, score: 82, genres: ["Horror", "Mystery", "Supernatural"], url: "https://anilist.co/anime/2246/Mononoke/", color: "#7a4a1f" },
  { title: "DAN DA DAN", year: 2024, episodes: 12, score: 84, genres: ["Action", "Comedy", "Supernatural"], url: "https://anilist.co/anime/171018/DAN-DA-DAN/", color: "#5f1f4a" },
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });

const grid = sampleContributionGrid(7);
const blocks = {
  "cinematic-strip": cinematicStrip(items),
  "poster-cards": posterCards(items),
  "media-list": mediaList(items),
  "classic-cards": classicCards(items),
  "lane-defense": laneDefense(grid, { level: 2, seed: 7 }),
  "lane-defense-light": laneDefense(grid, { level: 1, seed: 11, theme: "light" }),
};

for (const [name, svg] of Object.entries(blocks)) {
  writeFileSync(join(outDir, `${name}.svg`), svg);
  console.log(`${name}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
}

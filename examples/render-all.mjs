#!/usr/bin/env node
// Renders every block with deterministic sample data into examples/out/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cinematicStrip } from "../blocks/cinematic-strip.mjs";
import { posterCards } from "../blocks/poster-cards.mjs";
import { mediaList } from "../blocks/media-list.mjs";
import { classicCards } from "../blocks/classic-cards.mjs";
import { laneDefense } from "../blocks/lane-defense.mjs";
import { nightShift } from "../blocks/night-shift.mjs";
import { bossFight } from "../blocks/boss-fight.mjs";
import { commitLife } from "../blocks/commit-life.mjs";
import { sampleContributionGrid } from "../lib/contrib.mjs";
import { analyzeCodingHabits } from "../lib/habits.mjs";
import { codingHabits } from "../blocks/coding-habits.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const coverData = (name) =>
  `data:image/jpeg;base64,${readFileSync(join(root, "assets", "anime-covers", name)).toString("base64")}`;

const items = [
  { title: "Shinsekai yori", year: 2012, episodes: 25, score: 84, genres: ["Drama", "Mystery", "Psychological"], url: "https://anilist.co/anime/13125/Shinsekai-yori/", color: "#1f3a5f", cover: coverData("shinsekai-yori.jpg") },
  { title: "Mononoke", year: 2007, episodes: 12, score: 82, genres: ["Horror", "Mystery", "Supernatural"], url: "https://anilist.co/anime/2246/Mononoke/", color: "#7a4a1f", cover: coverData("mononoke.jpg") },
  { title: "DAN DA DAN", year: 2024, episodes: 12, score: 84, genres: ["Action", "Comedy", "Supernatural"], url: "https://anilist.co/anime/171018/DAN-DA-DAN/", color: "#5f1f4a", cover: coverData("dan-da-dan.jpg") },
];

const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });

const grid = sampleContributionGrid(7);
const habitsSample = Array.from({ length: 42 }, (_, i) => {
  const day = 27 - Math.floor(i / 3);
  const hour = i % 5 < 3 ? 15 + (i % 3) : 9 + (i % 4);
  return { date: `2026-07-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:20:00+03:00` };
});
const blocks = {
  "cinematic-strip": cinematicStrip(items),
  "poster-cards": posterCards(items),
  "media-list": mediaList(items),
  "classic-cards": classicCards(items),
  "lane-defense": laneDefense(grid, { level: 2, seed: 7 }),
  "lane-defense-light": laneDefense(grid, { level: 1, seed: 11, theme: "light" }),
  "night-shift": nightShift(grid, { level: 2, seed: 7 }),
  "boss-fight": bossFight(grid, { level: 2, seed: 7 }),
  "commit-life": commitLife(grid, { seed: 7 }),
  "commit-life-light": commitLife(grid, { seed: 7, theme: "light" }),
  "coding-habits": codingHabits(analyzeCodingHabits(habitsSample, { timeZone: "Europe/Istanbul" })),
};

for (const [name, svg] of Object.entries(blocks)) {
  writeFileSync(join(outDir, `${name}.svg`), svg);
  console.log(`${name}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
}

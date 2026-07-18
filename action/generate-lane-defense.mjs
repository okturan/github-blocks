#!/usr/bin/env node
// CI entry point for lane-defense. Meant to run from a checkout of this repo
// (see the workflow the configurator generates): reads config from env, fetches
// the user's live contribution grid, writes dist/lane-defense.svg (+ -light).
//
//   PROFILE_USER  required — GitHub username whose graph fights back
//   LD_LEVEL      1 | 2 | 3 | rotate   (default rotate: cycles daily)
//   LD_SEED       integer | daily      (default daily: fresh battle every day)
//   LD_THEMES     comma list of dark,light (default both)
//   LD_TITLE      header text          (default COMMIT DEFENSE)
//   LD_OUT        output directory     (default dist)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { laneDefense, LEVELS } from "../blocks/lane-defense.mjs";
import { fetchContributionGrid } from "../lib/contrib.mjs";

const user = process.env.PROFILE_USER;
if (!user) {
  console.error("PROFILE_USER is required");
  process.exit(1);
}

const day = Math.floor(Date.now() / 86_400_000);
const levelEnv = process.env.LD_LEVEL || "rotate";
const level = levelEnv === "rotate" ? 1 + (day % 3) : Math.min(Math.max(+levelEnv || 2, 1), 3);
const seedEnv = process.env.LD_SEED || "daily";
const seed = seedEnv === "daily" ? day : (+seedEnv >>> 0);
const themes = (process.env.LD_THEMES || "dark,light").split(",").map((t) => t.trim()).filter(Boolean);
const title = process.env.LD_TITLE || "COMMIT DEFENSE";
const outDir = process.env.LD_OUT || "dist";

const grid = await fetchContributionGrid(user);
mkdirSync(outDir, { recursive: true });
for (const theme of themes) {
  const file = theme === "dark" ? "lane-defense.svg" : `lane-defense-${theme}.svg`;
  const svg = laneDefense(grid, {
    level, seed, theme, title,
    onStats: (s) => console.log(`${file}: ${user} lvl ${level} ${LEVELS[level - 1].name} seed ${seed} —`, JSON.stringify(s)),
  });
  writeFileSync(join(outDir, file), svg);
}

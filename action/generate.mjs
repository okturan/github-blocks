#!/usr/bin/env node
// CI entry point for the defense blocks. Runs from a checkout of this repo
// (the configurator generates a workflow that does exactly that). Config is
// env vars; output is <block>.svg (dark) and <block>-light.svg in LD_OUT.
//
//   BLOCK         lane-defense | night-shift | boss-fight  (default lane-defense)
//   PROFILE_USER  required — whose graph fights
//   LD_LEVEL      1 | 2 | 3 | rotate   (default rotate: cycles daily;
//                 for boss-fight the levels are endings: rout/last stand/consumed)
//   LD_SEED       integer | daily      (default daily)
//   LD_THEMES     comma list of dark,light (default both)
//   LD_TITLE      header text          (default per block)
//   LD_OUT        output directory     (default dist)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { laneDefense } from "../blocks/lane-defense.mjs";
import { nightShift } from "../blocks/night-shift.mjs";
import { bossFight } from "../blocks/boss-fight.mjs";
import { fetchContributionGrid } from "../lib/contrib.mjs";

const BLOCKS = {
  "lane-defense": { fn: laneDefense, title: "COMMIT DEFENSE" },
  "night-shift": { fn: nightShift, title: "NIGHT SHIFT" },
  "boss-fight": { fn: bossFight, title: "BOSS FIGHT" },
};

const blockName = process.env.BLOCK || "lane-defense";
const block = BLOCKS[blockName];
if (!block) {
  console.error(`BLOCK must be one of: ${Object.keys(BLOCKS).join(", ")}`);
  process.exit(1);
}
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
const title = process.env.LD_TITLE || block.title;
const outDir = process.env.LD_OUT || "dist";

const grid = await fetchContributionGrid(user);
mkdirSync(outDir, { recursive: true });
for (const theme of themes) {
  const file = theme === "dark" ? `${blockName}.svg` : `${blockName}-${theme}.svg`;
  const svg = block.fn(grid, {
    level, seed, theme, title,
    onStats: (s) => console.log(`${file}: ${user} lvl ${level} seed ${seed} —`, JSON.stringify(s)),
  });
  writeFileSync(join(outDir, file), svg);
}

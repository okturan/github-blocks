#!/usr/bin/env node
// Scheduled generator for the coding-habits block.
//
//   PROFILE_USER       required — GitHub account to analyze
//   HABITS_LIMIT       1–1000 recent commits (default 500)
//   HABITS_TIMEZONE    IANA time zone (default UTC)
//   HABITS_WINDOW      hour bucket size, 1–12 (default 3)
//   HABITS_THEMES      comma list of dark,light (default both)
//   HABITS_TITLE       header text
//   HABITS_OUT         output directory (default dist)
//   GITHUB_TOKEN       optional; strongly recommended in Actions
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { codingHabits } from "../blocks/coding-habits.mjs";
import { fetchRecentPublicCommits } from "../lib/github-commits.mjs";
import { analyzeCodingHabits } from "../lib/habits.mjs";

const user = process.env.PROFILE_USER;
if (!user) {
  console.error("PROFILE_USER is required");
  process.exit(1);
}

const limit = Math.min(1000, Math.max(1, Math.trunc(Number(process.env.HABITS_LIMIT) || 500)));
const timeZone = process.env.HABITS_TIMEZONE || "UTC";
const windowHours = Math.min(12, Math.max(1, Math.trunc(Number(process.env.HABITS_WINDOW) || 3)));
const themes = (process.env.HABITS_THEMES || "dark,light").split(",").map((theme) => theme.trim()).filter(Boolean);
const title = process.env.HABITS_TITLE || "RECENT PUBLIC CODING HABITS";
const outDir = process.env.HABITS_OUT || "dist";
for (const theme of themes) {
  if (!["dark", "light"].includes(theme)) throw new Error(`Unsupported HABITS_THEMES entry: ${theme}`);
}

const commits = await fetchRecentPublicCommits(user, {
  limit,
  token: process.env.GITHUB_TOKEN,
});
if (!commits.length) throw new Error(`No indexed public non-merge commits found for ${user}`);

const summary = analyzeCodingHabits(commits, { timeZone, windowHours });
mkdirSync(outDir, { recursive: true });
for (const theme of themes) {
  const file = theme === "dark" ? "coding-habits.svg" : `coding-habits-${theme}.svg`;
  writeFileSync(join(outDir, file), codingHabits(summary, { theme, title }));
  console.log(`${file}: analyzed ${summary.sampleSize} commits for ${user} in ${timeZone}`);
}

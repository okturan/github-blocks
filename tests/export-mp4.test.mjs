import assert from "node:assert/strict";
import test from "node:test";

import { laneDefense } from "../blocks/lane-defense.mjs";
import { sampleContributionGrid } from "../lib/contrib.mjs";
import {
  MP4_FPS,
  MP4_MIN_ASPECT,
  MP4_WIDTH,
  alignEven,
  buildExportPlan,
  exportCanvasSize,
  frameCount,
  frameTimestampUs,
  mp4FileName,
  parseSvgSize,
  stripReducedMotion,
  themeBackground,
  cssTransformForSvg,
} from "../lib/mp4-export.mjs";

test("mp4 export canvas stays even, tight, and at least 2.39:1", () => {
  const size = exportCanvasSize(896, 169);
  assert.equal(size.width, MP4_WIDTH);
  assert.equal(size.width % 16, 0);
  assert.equal(size.height % 16, 0);
  assert.ok(size.height < 500, "banner export must not pad to 1080p");
  assert.ok(size.width / size.height >= MP4_MIN_ASPECT);
  assert.ok(size.contentWidth <= size.width);
  assert.ok(size.contentHeight <= size.height);
  assert.equal(alignEven(397.4), 398);
  assert.equal(alignEven(398), 398);
});

test("taller SVGs pillarbox instead of growing past 2.39:1", () => {
  const size = exportCanvasSize(896, 600);
  assert.equal(size.width, 1920);
  assert.equal(size.height % 2, 0);
  assert.ok(size.width / size.height >= MP4_MIN_ASPECT - 1e-9);
  assert.ok(size.offsetX > size.offsetY, "side bars, not a tall letterbox");
});

test("frame count, timestamps, names, and theme fill are deterministic", () => {
  assert.equal(frameCount(52, 30), 1560);
  assert.equal(frameCount(9, MP4_FPS), 270);
  assert.equal(frameTimestampUs(0, 30), 0);
  assert.equal(frameTimestampUs(30, 30), 1_000_000);
  assert.equal(mp4FileName("lane-defense"), "lane-defense.mp4");
  assert.equal(mp4FileName("lane-defense", "light"), "lane-defense-light.mp4");
  assert.equal(cssTransformForSvg("none"), "none");
  assert.equal(
    cssTransformForSvg("matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 12, 34, 0, 1)"),
    "matrix(1, 0, 0, 1, 12, 34)",
  );
  assert.equal(themeBackground("dark"), "#0d1117");
  assert.equal(themeBackground("light"), "#ffffff");
  assert.throws(() => frameCount(0), /positive number/);
});

test("export plan reads SVG size, loop length, and drops reduced-motion pause", () => {
  const svg = laneDefense(sampleContributionGrid(7), { level: 2, seed: 7 });
  const { width, height } = parseSvgSize(svg);
  assert.equal(width, 896);
  assert.equal(height, 169);
  assert.match(svg, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(stripReducedMotion(svg), /prefers-reduced-motion:reduce/);

  const plan = buildExportPlan({ svgText: svg, durationSec: 52, theme: "dark" });
  assert.equal(plan.frames, 1560);
  assert.equal(plan.fps, 30);
  assert.equal(plan.width, 1920);
  assert.equal(plan.background, "#0d1117");
  assert.doesNotMatch(plan.svgText, /animation-play-state:paused!important/);
});

// Pure helpers for the configurator's client-side MP4 export.
// The browser encoder lives in site/export-mp4.mjs so Node tests never load WebCodecs.

export const MP4_FPS = 30;
export const MP4_WIDTH = 1920;
export const MP4_PAD_X = 32;
export const MP4_PAD_Y = 24;
export const MP4_MIN_ASPECT = 2.39;

export const THEME_BACKGROUND = {
  dark: "#0d1117",
  light: "#ffffff",
};

const REDUCED_MOTION = /@media \(prefers-reduced-motion:reduce\)\{\*\{animation-play-state:paused!important\}\}/g;

export function alignEven(n) {
  const value = Math.max(2, Math.round(Number(n)));
  return value + (value % 2);
}

export function alignUp(n, multiple) {
  const size = Math.max(2, multiple);
  return Math.ceil(Math.max(size, Number(n)) / size) * size;
}

export function alignDown(n, multiple) {
  const size = Math.max(2, multiple);
  return Math.max(size, Math.floor(Number(n) / size) * size);
}

export function themeBackground(theme) {
  return THEME_BACKGROUND[theme] || THEME_BACKGROUND.dark;
}

export function stripReducedMotion(svgText) {
  return String(svgText).replace(REDUCED_MOTION, "");
}

export function parseSvgSize(svgText) {
  const tag = String(svgText).match(/<svg\b[^>]*>/);
  if (!tag) throw new Error("SVG has no root element.");
  const width = Number(tag[0].match(/\bwidth="([0-9.]+)"/)?.[1]);
  const height = Number(tag[0].match(/\bheight="([0-9.]+)"/)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("SVG is missing width or height.");
  }
  return { width, height };
}

export function frameCount(durationSec, fps = MP4_FPS) {
  const duration = Number(durationSec);
  const rate = Number(fps);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Loop duration must be a positive number.");
  }
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Frame rate must be a positive number.");
  }
  return Math.max(1, Math.round(duration * rate));
}

export function frameTimestampUs(index, fps = MP4_FPS) {
  return Math.round((index * 1e6) / fps);
}

export function mp4FileName(block, theme) {
  const id = String(block || "block").replace(/[^a-zA-Z0-9_-]/g, "") || "block";
  return theme === "light" ? `${id}-light.mp4` : `${id}.mp4`;
}

export function cssTransformForSvg(value) {
  if (!value || value === "none") return "none";
  if (value.startsWith("matrix(")) return value;
  const match = String(value).match(/^matrix3d\(([^)]+)\)$/);
  if (!match) return value;
  const n = match[1].split(",").map(Number);
  if (n.length !== 16 || n.some((part) => !Number.isFinite(part))) return value;
  return `matrix(${n[0]}, ${n[1]}, ${n[4]}, ${n[5]}, ${n[12]}, ${n[13]})`;
}

// Fit the SVG on a 1920-wide canvas with modest padding. Keep both sides even
// so H.264 4:2:0 stays valid. If the result would be taller than 2.39:1, cap
// the height and center the SVG (side bars, not a 1080p letterbox).
export function exportCanvasSize(svgWidth, svgHeight, options = {}) {
  const srcW = Number(svgWidth);
  const srcH = Number(svgHeight);
  if (!Number.isFinite(srcW) || !Number.isFinite(srcH) || srcW <= 0 || srcH <= 0) {
    throw new Error("SVG size must be positive.");
  }

  const targetWidth = options.targetWidth ?? MP4_WIDTH;
  const padX = options.padX ?? MP4_PAD_X;
  const padY = options.padY ?? MP4_PAD_Y;
  const minAspect = options.minAspect ?? MP4_MIN_ASPECT;

  const width = alignUp(targetWidth, 16);
  const maxHeight = alignDown(width / minAspect, 2);
  const innerW = Math.max(2, width - padX * 2);
  const scaledH = (srcH / srcW) * innerW;
  let height = alignUp(scaledH + padY * 2, 16);
  if (height > maxHeight) height = alignDown(maxHeight, 16);

  const boxW = Math.max(2, width - padX * 2);
  const boxH = Math.max(2, height - padY * 2);
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const contentWidth = srcW * scale;
  const contentHeight = srcH * scale;
  return {
    width,
    height,
    contentWidth,
    contentHeight,
    offsetX: (width - contentWidth) / 2,
    offsetY: (height - contentHeight) / 2,
    scale,
  };
}

export function buildExportPlan({ svgText, durationSec, theme, fps = MP4_FPS } = {}) {
  const { width: svgWidth, height: svgHeight } = parseSvgSize(svgText);
  const canvas = exportCanvasSize(svgWidth, svgHeight);
  return {
    fps,
    frames: frameCount(durationSec, fps),
    durationSec: Number(durationSec),
    background: themeBackground(theme),
    svgWidth,
    svgHeight,
    svgText: stripReducedMotion(svgText),
    ...canvas,
  };
}

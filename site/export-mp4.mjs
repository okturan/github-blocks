// Browser-only: seek CSS/Web Animations on an in-DOM SVG, rasterize each
// frame, and mux a silent H.264 MP4 with WebCodecs.
import {
  MP4_FPS,
  buildExportPlan,
  cssTransformForSvg,
  frameTimestampUs,
} from "./lib/mp4-export.mjs";
import { ArrayBufferTarget, Muxer } from "./vendor/mp4-muxer.mjs";

const AVC_CODECS = ["avc1.4d0028", "avc1.420028", "avc1.640028", "avc1.4d001f"];
const STYLE_PROPS = ["opacity", "transformOrigin", "visibility", "transformBox"];

export function canEncodeMp4() {
  return typeof VideoEncoder === "function" && typeof VideoFrame === "function";
}

function bitrateFor(width, height, fps) {
  return Math.min(8_000_000, Math.max(1_500_000, Math.round(width * height * fps * 0.15)));
}

async function pickEncoderConfig(width, height, fps) {
  const base = { width, height, bitrate: bitrateFor(width, height, fps), framerate: fps };
  for (const codec of AVC_CODECS) {
    const config = { ...base, codec };
    try {
      if (typeof VideoEncoder.isConfigSupported !== "function") return config;
      const result = await VideoEncoder.isConfigSupported(config);
      if (result?.supported) return { ...config, ...(result.config || {}) };
    } catch { /* try the next codec string */ }
  }
  return null;
}

function mountSvg(svgText) {
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = parsed.documentElement;
  if (!root || root.localName !== "svg" || parsed.querySelector("parsererror")) {
    throw new Error("SVG parse failed.");
  }
  const host = document.createElement("div");
  host.id = "mp4-export-host";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;margin:0;padding:0;pointer-events:none;";
  const svg = document.importNode(root, true);
  host.appendChild(svg);
  document.body.appendChild(host);
  return { host, svg };
}

function collectAnimations(svg) {
  const list = typeof svg.getAnimations === "function"
    ? svg.getAnimations({ subtree: true })
    : document.getAnimations().filter((animation) => svg.contains(animation.effect?.target));
  return list.filter((animation) => animation.playState !== "idle");
}

function seekAll(animations, timeMs) {
  for (const animation of animations) {
    try {
      animation.pause();
      animation.currentTime = timeMs;
    } catch { /* skip a dead animation */ }
  }
}

function cloneForBake(liveSvg) {
  const clone = liveSvg.cloneNode(true);
  const freeze = document.createElementNS("http://www.w3.org/2000/svg", "style");
  freeze.textContent = "*{animation:none!important}";
  clone.appendChild(freeze);
  const liveEls = liveSvg.querySelectorAll("*");
  const cloneEls = clone.querySelectorAll("*");
  const cloneOf = new Map();
  const limit = Math.min(liveEls.length, cloneEls.length);
  for (let i = 0; i < limit; i++) cloneOf.set(liveEls[i], cloneEls[i]);
  return { clone, cloneOf };
}

function bakeAnimatedStyles(animations, cloneOf) {
  const seen = new Set();
  for (const animation of animations) {
    const live = animation.effect?.target;
    if (!live || seen.has(live)) continue;
    seen.add(live);
    const dest = cloneOf.get(live);
    if (!dest) continue;
    const computed = getComputedStyle(live);
    for (const prop of STYLE_PROPS) dest.style[prop] = computed[prop];
    dest.style.transform = cssTransformForSvg(computed.transform);
  }
}

function serializeSvg(svg) {
  let xml = new XMLSerializer().serializeToString(svg);
  if (!/\sxmlns=/.test(xml)) {
    xml = xml.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return xml;
}

async function rasterizeSvgXml(xml) {
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "sync";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterize this SVG frame."));
    };
    image.src = url;
  });
  if (typeof image.decode === "function") await image.decode().catch(() => {});
  return { image, release: () => URL.revokeObjectURL(url) };
}

async function waitForEncoder(encoder, getError) {
  while (encoder.encodeQueueSize > 4) {
    const error = getError?.();
    if (error) throw error;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      encoder.ondequeue = finish;
      setTimeout(finish, 40);
    });
  }
}

function yieldToUi() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function exportSvgLoopToMp4({
  svgText,
  theme,
  durationSec,
  fps = MP4_FPS,
  onProgress,
} = {}) {
  if (!canEncodeMp4()) {
    throw new Error("This browser cannot encode H.264. Open this page in Chrome or Edge.");
  }

  const plan = buildExportPlan({ svgText, durationSec, theme, fps });
  const config = await pickEncoderConfig(plan.width, plan.height, plan.fps);
  if (!config) {
    throw new Error("This browser cannot encode H.264. Open this page in Chrome or Edge.");
  }

  const { host, svg } = mountSvg(plan.svgText);
  svg.setAttribute("width", String(plan.svgWidth));
  svg.setAttribute("height", String(plan.svgHeight));

  let encoder;
  try {
    await yieldToUi();
    await yieldToUi();

    const animations = collectAnimations(svg);
    for (const animation of animations) animation.pause();

    const { clone, cloneOf } = cloneForBake(svg);
    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("Could not create a 2D canvas.");

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: config.width,
        height: config.height,
        frameRate: plan.fps,
      },
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    let encodeError = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => { encodeError = error; },
    });
    encoder.configure(config);

    const drawPadX = (config.width - plan.contentWidth) / 2;
    const drawPadY = (config.height - plan.contentHeight) / 2;
    const keyEvery = Math.max(1, Math.round(plan.fps));

    for (let i = 0; i < plan.frames; i++) {
      if (encodeError) throw encodeError;
      seekAll(animations, (i / plan.fps) * 1000);
      bakeAnimatedStyles(animations, cloneOf);
      const raster = await rasterizeSvgXml(serializeSvg(clone));
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = plan.background;
        ctx.fillRect(0, 0, config.width, config.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(raster.image, drawPadX, drawPadY, plan.contentWidth, plan.contentHeight);
      } finally {
        raster.release();
      }

      const frame = new VideoFrame(canvas, {
        timestamp: frameTimestampUs(i, plan.fps),
        duration: Math.round(1e6 / plan.fps),
      });
      try {
        await waitForEncoder(encoder, () => encodeError);
        encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
      } finally {
        frame.close();
      }

      if (i % 2 === 0) {
        onProgress?.(i + 1, plan.frames);
        await yieldToUi();
      }
    }

    onProgress?.(plan.frames, plan.frames);
    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;
    muxer.finalize();
    const buffer = muxer.target.buffer;
    if (!buffer) throw new Error("MP4 export failed.");
    return buffer;
  } finally {
    host.remove();
    if (encoder && encoder.state !== "closed") encoder.close();
  }
}

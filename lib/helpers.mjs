// Shared helpers for github-blocks SVG renderers.

export const palette = {
  bg: "#0d1117",
  panel: "#161b22",
  panel2: "#111827",
  line: "#30363d",
  sep: "#21262d",
  text: "#e6edf3",
  muted: "#8b949e",
  blue: "#58a6ff",
};

export const fontFamily = `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

export function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// SVG links are active content even when the document itself contains no
// <script>. Keep renderer-provided links to ordinary web URLs, and only allow
// image data URIs for embedded cover art.
export function safeHref(value, { image = false } = {}) {
  const href = String(value ?? "").trim();
  if (image && /^data:image\/(?:gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(href)) {
    return xml(href);
  }
  try {
    const url = new URL(href);
    if (url.protocol === "https:" || url.protocol === "http:") return xml(href);
  } catch { /* invalid or relative URLs become inert */ }
  return "#";
}

export function safeId(value) {
  const id = String(value ?? "id").replace(/[^A-Za-z0-9_.:-]/g, "_");
  return /^[A-Za-z_]/.test(id) ? id : `id-${id}`;
}

export function svgShell({ width, height, viewBox, ariaLabel, defs = "", extraStyle = "", body }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"${viewBox ? ` viewBox="${viewBox}"` : ""} role="img" aria-label="${xml(ariaLabel)}">
  <style>
    text { font-family: ${fontFamily}; }
    a { cursor: pointer; }
    ${extraStyle}
  </style>
  ${defs}
  ${body}
</svg>
`;
}

// Cover image cropped to fill a rect; expects a data URI (GitHub's camo proxy
// blocks external fetches from inside SVGs) but any href works locally.
export function coverImage(href, x, y, w, h, clipId) {
  return `<image href="${safeHref(href, { image: true })}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${safeId(clipId)})"/>`;
}

export function placeholderCover(x, y, w, h, color, title, fontSize = 24) {
  const initials = String(title).split(/\s+/).slice(0, 3).map((part) => part[0]).join("").toUpperCase();
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${xml(color || palette.panel2)}"/>
    <text x="${x + w / 2}" y="${y + h / 2 + fontSize / 3}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="${palette.text}">${xml(initials)}</text>
  `;
}

export function cover(item, x, y, w, h, clipId, placeholderFontSize) {
  return item.cover
    ? coverImage(item.cover, x, y, w, h, clipId)
    : placeholderCover(x, y, w, h, item.color, item.title, placeholderFontSize);
}

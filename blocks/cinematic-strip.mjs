// Cinematic strip — landscape cards with the cover art as backdrop under a
// bottom gradient; title + year overlaid. 896 x 190 for three items.
import { palette, svgShell, xml, safeHref, safeId, cover } from "../lib/helpers.mjs";

export function cinematicStrip(items, { width = 896, height = 190, gap = 19, idPrefix = "strip" } = {}) {
  const cardW = (width - gap * (items.length - 1)) / items.length;
  const cards = items.map((item, i) => {
    const x = Math.round(i * (cardW + gap));
    const clipId = safeId(`${idPrefix}-clip-${i}`);
    return `
    <a href="${safeHref(item.url)}">
      <clipPath id="${clipId}"><rect x="${x}" y="0" width="${cardW}" height="${height}" rx="14"/></clipPath>
      ${cover(item, x, 0, cardW, height, clipId, 34)}
      <rect x="${x}" y="0" width="${cardW}" height="${height}" rx="14" fill="url(#${safeId(`${idPrefix}-fade`)})" clip-path="url(#${clipId})"/>
      <text x="${x + 18}" y="${height - 24}" font-size="18" font-weight="800" fill="#ffffff">${xml(item.title)}<tspan dx="9" font-size="12.5" font-weight="500" fill="${palette.text}" opacity="0.75">${xml(item.year)}</tspan></text>
      <rect x="${x + 0.5}" y="0.5" width="${cardW - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="#f0f6fc" stroke-opacity="0.14"/>
    </a>`;
  }).join("\n");
  const defs = `<defs>
    <linearGradient id="${safeId(`${idPrefix}-fade`)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.bg}" stop-opacity="0.06"/>
      <stop offset="0.5" stop-color="${palette.bg}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${palette.bg}" stop-opacity="0.95"/>
    </linearGradient>
  </defs>`;
  const labels = items.map(({ title }) => title).join(", ");
  return svgShell({ width, height, ariaLabel: labels, defs, body: cards });
}

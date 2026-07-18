// Poster cards — vertical cards with full-bleed cover art on top; title,
// year / episodes / score, and genre chips below. 896 x 446 for three items.
import { palette, svgShell, xml, safeHref, safeId, cover } from "../lib/helpers.mjs";

export function posterCards(items, { width = 896, height = 446, posterHeight = 336, gap = 19, idPrefix = "poster" } = {}) {
  const cardW = (width - gap * (items.length - 1)) / items.length;
  const cards = items.map((item, i) => {
    const x = Math.round(i * (cardW + gap));
    const clipId = safeId(`${idPrefix}-clip-${i}`);
    let chipX = x + 18;
    const chips = (item.genres ?? []).map((genre) => {
      const w = Math.round(genre.length * 5.8 + 18);
      const chip = `
      <rect x="${chipX}" y="406" width="${w}" height="22" rx="11" fill="${palette.panel2}" stroke="${palette.line}"/>
      <text x="${chipX + w / 2}" y="421" text-anchor="middle" font-size="11" fill="${palette.muted}">${xml(genre)}</text>`;
      chipX += w + 8;
      return chip;
    }).join("");
    const meta = [`${item.year} · ${item.episodes} episodes`, item.score ? `★ ${(item.score / 10).toFixed(1)}` : null]
      .filter(Boolean).join(" · ");
    return `
    <a href="${safeHref(item.url)}">
      <clipPath id="${clipId}"><rect x="${x}" y="0" width="${cardW}" height="${height}" rx="14"/></clipPath>
      <rect x="${x}" y="0" width="${cardW}" height="${height}" rx="14" fill="${palette.panel}"/>
      ${cover(item, x, 0, cardW, posterHeight, clipId, 34)}
      <path d="M${x} ${posterHeight}H${x + cardW}" stroke="${palette.line}" opacity="0.7"/>
      <text x="${x + 18}" y="${posterHeight + 32}" font-size="17" font-weight="700" fill="${palette.text}">${xml(item.title)}</text>
      <text x="${x + 18}" y="${posterHeight + 55}" font-size="12.5" fill="${palette.muted}">${xml(meta)}</text>
      ${chips}
      <rect x="${x + 0.5}" y="0.5" width="${cardW - 1}" height="${height - 1}" rx="13.5" fill="none" stroke="${palette.line}"/>
    </a>`;
  }).join("\n");
  const labels = items.map(({ title }) => title).join(", ");
  return svgShell({ width, height, ariaLabel: labels, body: cards });
}

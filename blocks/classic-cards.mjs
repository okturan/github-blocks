// Classic cards — the original okturan/okturan layout: one dark panel with a
// horizontal card per item (small cover left, title + meta right). 860 x 220 for three items.
import { palette, svgShell, xml, cover } from "../lib/helpers.mjs";

export function classicCards(items, { cardWidth = 258, gap = 18, margin = 34, idPrefix = "classic" } = {}) {
  const width = margin * 2 + items.length * cardWidth + (items.length - 1) * gap;
  const height = 220;
  const cards = items.map((item, i) => {
    const x = margin + i * (cardWidth + gap);
    const y = 32;
    const clipId = `${idPrefix}-clip-${i}`;
    return `
    <a href="${xml(item.url)}">
      <rect x="${x}" y="${y}" width="${cardWidth}" height="154" rx="14" fill="${palette.panel}" stroke="${palette.line}"/>
      <clipPath id="${clipId}"><rect x="${x + 16}" y="${y + 18}" width="82" height="116" rx="10"/></clipPath>
      ${cover(item, x + 16, y + 18, 82, 116, clipId)}
      <text x="${x + 112}" y="${y + 44}" font-size="19" font-weight="700" fill="${palette.text}">${xml(item.title)}</text>
      <text x="${x + 112}" y="${y + 93}" font-size="12" fill="${palette.muted}">${item.year} / ${item.episodes} episodes</text>
    </a>`;
  }).join("\n");
  const labels = items.map(({ title }) => title).join(", ");
  const body = `<rect width="${width}" height="${height}" rx="18" fill="${palette.bg}"/>
  ${cards}`;
  return svgShell({ width, height, ariaLabel: labels, body });
}

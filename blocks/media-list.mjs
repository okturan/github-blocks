// Media list — one full-width panel with a numbered row per item: thumbnail,
// title + genres, year / episodes and score right-aligned. 896 x 340 for three items.
import { palette, svgShell, xml, cover } from "../lib/helpers.mjs";

export function mediaList(items, { width = 896, rowHeight = 100, idPrefix = "list" } = {}) {
  const height = 40 + items.length * rowHeight;
  const rows = items.map((item, i) => {
    const y = 20 + i * rowHeight;
    const clipId = `${idPrefix}-clip-${i}`;
    const sep = i > 0 ? `<path d="M20 ${y}H${width - 20}" stroke="${palette.sep}"/>` : "";
    return `
    ${sep}
    <a href="${xml(item.url)}">
      <text x="30" y="${y + 55}" font-size="13" font-weight="600" fill="#444c56">0${i + 1}</text>
      <clipPath id="${clipId}"><rect x="68" y="${y + 9}" width="59" height="82" rx="8"/></clipPath>
      ${cover(item, 68, y + 9, 59, 82, clipId, 18)}
      <text x="148" y="${y + 44}" font-size="17.5" font-weight="700" fill="${palette.text}">${xml(item.title)}</text>
      <text x="148" y="${y + 68}" font-size="12.5" fill="${palette.muted}">${xml((item.genres ?? []).join(" · "))}</text>
      <text x="${width - 36}" y="${y + 44}" text-anchor="end" font-size="13" fill="${palette.muted}">${item.year} · ${item.episodes} episodes</text>
      ${item.score ? `<text x="${width - 36}" y="${y + 68}" text-anchor="end" font-size="13.5" font-weight="700" fill="${palette.blue}">★ ${(item.score / 10).toFixed(1)}</text>` : ""}
    </a>`;
  }).join("\n");
  const labels = items.map(({ title }) => title).join(", ");
  const body = `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${palette.bg}" stroke="${palette.line}"/>
  ${rows}`;
  return svgShell({ width, height, ariaLabel: labels, body });
}

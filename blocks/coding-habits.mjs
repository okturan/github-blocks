import { palette, svgShell, xml } from "../lib/helpers.mjs";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function codingHabits(summary, {
  width = 896,
  height = 300,
  theme = "dark",
  title = "RECENT PUBLIC CODING HABITS",
} = {}) {
  const dark = theme !== "light";
  const colors = dark
    ? { bg: palette.bg, panel: palette.panel, line: palette.line, text: palette.text, muted: palette.muted, accent: "#58a6ff", bar: "#39d353" }
    : { bg: "#ffffff", panel: "#f6f8fa", line: "#d0d7de", text: "#1f2328", muted: "#656d76", accent: "#0969da", bar: "#1a7f37" };
  const counts = DAYS.map((day) => summary.weekdayCounts?.[
    ({ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" })[day]
  ] ?? 0);
  const max = Math.max(1, ...counts);
  const bars = counts.map((count, i) => {
    const x = 552 + i * 43;
    const barHeight = Math.max(3, Math.round((count / max) * 78));
    return `<rect x="${x}" y="${236 - barHeight}" width="24" height="${barHeight}" rx="4" fill="${colors.bar}" opacity="${count === max ? 1 : 0.48}"/>
      <text x="${x + 12}" y="258" text-anchor="middle" font-size="10.5" fill="${colors.muted}">${DAYS[i]}</text>`;
  }).join("\n");
  const medianText = Number.isInteger(summary.medianPerActiveDate)
    ? summary.medianPerActiveDate
    : summary.medianPerActiveDate.toFixed(1);
  const subtitle = `${summary.sampleSize} recent indexed public default-branch non-merge commits · ${summary.dateRange} · ${summary.timeZone}`;
  const body = `
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="16" fill="${colors.bg}" stroke="${colors.line}"/>
    <text x="28" y="48" font-size="27" font-weight="800" fill="${colors.text}" letter-spacing="-0.4">${xml(title)}</text>
    <text x="28" y="78" font-size="13.5" fill="${colors.accent}">${xml(subtitle)}</text>
    <path d="M28 98H868" stroke="${colors.line}"/>
    <text x="28" y="132" font-size="15.5" fill="${colors.muted}">Most commits land on <tspan fill="${colors.text}" font-weight="700">${xml(summary.mostActiveDay)}</tspan> (${xml(summary.mostActiveDayCount)} of ${xml(summary.sampleSize)})</text>
    <text x="28" y="166" font-size="15.5" fill="${colors.muted}">Most common commit window: <tspan fill="${colors.text}" font-weight="700">${xml(summary.commonWindow)}</tspan> (${xml(summary.commonWindowCount)} of ${xml(summary.sampleSize)})</text>
    <text x="28" y="200" font-size="15.5" fill="${colors.muted}"><tspan fill="${colors.text}" font-weight="700">${xml(summary.activeDates)}</tspan> active dates represented in this sample</text>
    <text x="28" y="234" font-size="15.5" fill="${colors.muted}">Median activity: <tspan fill="${colors.text}" font-weight="700">${xml(medianText)} commits</tspan> per active date</text>
    <text x="552" y="126" font-size="10.5" font-weight="700" letter-spacing="1.2" fill="${colors.muted}">COMMITS BY WEEKDAY</text>
    ${bars}
  `;
  return svgShell({
    width,
    height,
    ariaLabel: `${title}. ${subtitle}`,
    body,
  }).replace(/[ \t]+$/gm, "");
}

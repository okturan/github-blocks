const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatter(timeZone, options) {
  return new Intl.DateTimeFormat("en-US", { timeZone, ...options });
}

function dateParts(date, timeZone) {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatRange(first, last, timeZone) {
  const firstYear = formatter(timeZone, { year: "numeric" }).format(first);
  const lastYear = formatter(timeZone, { year: "numeric" }).format(last);
  const start = formatter(timeZone, {
    month: "short",
    day: "numeric",
    ...(firstYear === lastYear ? {} : { year: "numeric" }),
  }).format(first);
  const end = formatter(timeZone, { month: "short", day: "numeric", year: "numeric" }).format(last);
  return `${start} – ${end}`;
}

export function analyzeCodingHabits(commits, { timeZone = "UTC", windowHours = 3 } = {}) {
  // Throws a useful RangeError up front for invalid IANA time-zone names.
  formatter(timeZone, { year: "numeric" }).format(new Date(0));
  const hours = Math.min(12, Math.max(1, Math.trunc(windowHours) || 3));
  const dates = commits
    .map((commit) => new Date(commit.date ?? commit.commit?.committer?.date ?? commit.commit?.author?.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  const weekdayCounts = Object.fromEntries(WEEKDAYS.map((day) => [day, 0]));
  const dateCounts = new Map();
  const windowCounts = new Map();
  for (const date of dates) {
    const parts = dateParts(date, timeZone);
    weekdayCounts[parts.weekday] += 1;
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
    const start = Math.floor(Number(parts.hour) / hours) * hours;
    windowCounts.set(start, (windowCounts.get(start) ?? 0) + 1);
  }

  const mostActiveDay = WEEKDAYS.reduce((best, day) =>
    weekdayCounts[day] > weekdayCounts[best] ? day : best, WEEKDAYS[0]);
  const commonWindowStart = [...windowCounts.entries()]
    .sort(([aHour, aCount], [bHour, bCount]) => bCount - aCount || aHour - bHour)[0]?.[0] ?? 0;
  const commonWindowCount = windowCounts.get(commonWindowStart) ?? 0;
  const commonWindowEnd = (commonWindowStart + hours - 1) % 24;

  return {
    sampleSize: dates.length,
    timeZone,
    dateRange: dates.length ? formatRange(dates[0], dates.at(-1), timeZone) : "No indexed commits",
    weekdayCounts,
    mostActiveDay,
    mostActiveDayCount: weekdayCounts[mostActiveDay],
    commonWindow: `${String(commonWindowStart).padStart(2, "0")}:00–${String(commonWindowEnd).padStart(2, "0")}:59`,
    commonWindowCount,
    activeDates: dateCounts.size,
    medianPerActiveDate: median([...dateCounts.values()]),
  };
}

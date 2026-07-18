import assert from "node:assert/strict";
import test from "node:test";

import { parseContributionGrid, sampleContributionGrid } from "../lib/contrib.mjs";

test("parseContributionGrid reconstructs weeks and pads missing days", () => {
  const html = `
    <table>
      <td id="contribution-day-component-2-1" data-date="2026-01-06" data-level="4"></td>
      <td data-level="3" data-date="2026-01-01" id="contribution-day-component-0-0"></td>
      <td id="contribution-day-component-6-0" data-date="2026-01-07" data-level="1"></td>
    </table>`;

  assert.deepEqual(parseContributionGrid(html), [
    [3, 0, 0, 0, 0, 0, 1],
    [0, 0, 4, 0, 0, 0, 0],
  ]);
});

test("parseContributionGrid fails closed when GitHub cells are absent", () => {
  assert.throws(() => parseContributionGrid("<table></table>"), /no contribution cells found/);
});

test("sample grids are deterministic, bounded weeks by seven days, and levels 0-4", () => {
  const first = sampleContributionGrid(7, 5);
  assert.deepEqual(first, sampleContributionGrid(7, 5));
  assert.notDeepEqual(first, sampleContributionGrid(8, 5));
  assert.equal(first.length, 5);
  for (const week of first) {
    assert.equal(week.length, 7);
    for (const level of week) assert.ok(Number.isInteger(level) && level >= 0 && level <= 4);
  }
});

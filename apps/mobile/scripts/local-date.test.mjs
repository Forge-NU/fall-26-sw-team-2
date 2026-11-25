import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addDays,
  formatDate,
  formatDateRange,
  formatMonth,
  formatWeekdayDate,
  isDateWithin,
  monthGrid,
  parseIsoDate,
  toIsoDate,
  tripDayNumber,
} from '../src/utils/local-date.ts';

test('round-trips local dates', () => {
  assert.equal(toIsoDate(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toIsoDate(parseIsoDate('2026-10-03')), '2026-10-03');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('formats dates the same way everywhere', () => {
  assert.equal(formatDate('2026-10-03'), 'Oct 3, 2026');
  assert.equal(formatWeekdayDate('2026-10-03'), 'Sat, Oct 3');
  assert.equal(formatDateRange('2026-10-03', '2026-10-03'), 'Oct 3, 2026');
  assert.equal(formatMonth(2026, 10), 'October 2026');
});

test('checks ranges and day numbers', () => {
  assert.equal(isDateWithin('2026-10-03', '2026-10-03', '2026-10-06'), true);
  assert.equal(isDateWithin('2026-10-07', '2026-10-03', '2026-10-06'), false);
  assert.equal(tripDayNumber('2026-10-03', '2026-10-05'), 3);
});

test('builds Monday-first month grids', () => {
  // October 2026 starts on a Thursday
  const weeks = monthGrid(2026, 10);
  assert.deepEqual(weeks[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.equal(weeks.at(-1).at(-1), null);
  assert.equal(weeks.flat().filter(Boolean).length, 31);
  assert.ok(weeks.every((week) => week.length === 7));
});

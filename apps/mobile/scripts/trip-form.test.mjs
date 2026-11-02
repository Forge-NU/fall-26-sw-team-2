import test from 'node:test';
import assert from 'node:assert/strict';
import {
  charCount,
  toCreateTripRequest,
  toUpdateTripRequest,
  validateTripForm,
} from '../src/lib/trip-form.ts';
import { formatDateRange, tripDayCount, tripDays } from '../src/utils/trip-dates.ts';

const valid = {
  title: 'Lisbon weekend',
  destination: 'Lisbon, Portugal',
  description: '',
  startDate: '2026-10-03',
  endDate: '2026-10-06',
};

test('a filled-in trip has no errors, and a trip with no posts is fine', () => {
  assert.deepEqual(validateTripForm(valid), {});
  assert.deepEqual(validateTripForm(valid, []), {});
});

test('missing title and destination are flagged, including whitespace-only', () => {
  const errors = validateTripForm({ ...valid, title: '   ', destination: '' });
  assert.ok(errors.title);
  assert.ok(errors.destination);
});

test('end date before start date blocks saving; same day is allowed', () => {
  assert.ok(validateTripForm({ ...valid, endDate: '2026-10-02' }).endDate);
  assert.deepEqual(validateTripForm({ ...valid, endDate: valid.startDate }), {});
});

test('both dates are required', () => {
  const errors = validateTripForm({ ...valid, startDate: null, endDate: null });
  assert.ok(errors.startDate);
  assert.ok(errors.endDate);
});

test("new dates can't leave posts outside the trip", () => {
  const errors = validateTripForm({ ...valid, endDate: '2026-10-04' }, ['2026-10-03', '2026-10-05', '2026-10-06']);
  assert.match(errors.endDate, /^2 posts are outside/);
});

test('limits count code points like Postgres, so ❤️ is 2', () => {
  assert.equal(charCount('❤️'), 2);
  assert.ok(validateTripForm({ ...valid, title: '❤️'.repeat(51) }).title);
  assert.equal(validateTripForm({ ...valid, title: '❤️'.repeat(50) }).title, undefined);
});

test('create trims text and leaves out an empty description', () => {
  assert.deepEqual(toCreateTripRequest({ ...valid, title: '  Lisbon weekend ', description: '  ' }), {
    title: 'Lisbon weekend',
    destination: 'Lisbon, Portugal',
    startDate: '2026-10-03',
    endDate: '2026-10-06',
  });
});

test('update only sends changed fields, and clearing the description sends null', () => {
  const initial = { ...valid, description: 'Tarts and trams' };
  assert.deepEqual(toUpdateTripRequest(initial, initial), {});
  assert.deepEqual(toUpdateTripRequest(initial, { ...initial, description: '', endDate: '2026-10-07' }), {
    description: null,
    endDate: '2026-10-07',
  });
});

test('trip day helpers count inclusively, across months and DST', () => {
  assert.equal(tripDayCount('2026-10-03', '2026-10-03'), 1);
  assert.equal(tripDayCount('2026-10-30', '2026-11-02'), 4);
  assert.deepEqual(tripDays('2026-03-07', '2026-03-09'), ['2026-03-07', '2026-03-08', '2026-03-09']);
  assert.equal(formatDateRange('2026-10-03', '2026-10-06'), 'Oct 3 – 6, 2026');
  assert.equal(formatDateRange('2026-09-29', '2026-10-02'), 'Sep 29 – Oct 2, 2026');
  assert.equal(formatDateRange('2026-12-30', '2027-01-02'), 'Dec 30, 2026 – Jan 2, 2027');
});

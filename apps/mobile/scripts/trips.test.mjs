import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveTrip, pickSuggestedTrip, validateQuickTrip } from '../src/lib/trips.ts';

const today = '2026-10-05';

const values = {
  title: 'Lisbon weekend',
  destination: 'Lisbon, Portugal',
  description: '',
  startDate: '2026-10-03',
  endDate: '2026-10-06',
};

const trip = (overrides) => ({
  id: 'trip-1',
  status: 'draft',
  startDate: '2026-10-03',
  endDate: '2026-10-06',
  ...overrides,
});

test('quick trip: dates that include today have no errors, including a one-day trip', () => {
  assert.deepEqual(validateQuickTrip(values, today), {});
  assert.deepEqual(validateQuickTrip({ ...values, startDate: today, endDate: today }, today), {});
});

test("quick trip: dates that don't include today are flagged on the end date", () => {
  const future = validateQuickTrip({ ...values, startDate: '2026-11-01', endDate: '2026-11-03' }, today);
  assert.deepEqual(Object.keys(future), ['endDate']);
  assert.match(future.endDate, /include today/);

  const past = validateQuickTrip({ ...values, startDate: '2026-09-01', endDate: '2026-09-03' }, today);
  assert.match(past.endDate, /include today/);
});

test('quick trip: an end date before the start shows only that error, not the today one', () => {
  const errors = validateQuickTrip({ ...values, startDate: '2026-10-06', endDate: '2026-10-03' }, today);
  assert.doesNotMatch(errors.endDate, /include today/);
});

test('quick trip: missing fields come from the trip form rules', () => {
  const errors = validateQuickTrip(
    { ...values, title: '  ', destination: '', startDate: null, endDate: null },
    today,
  );
  assert.ok(errors.title);
  assert.ok(errors.destination);
  assert.ok(errors.startDate);
  assert.ok(errors.endDate);
  assert.doesNotMatch(errors.endDate, /include today/);
});

test('a trip is active when it is a draft and today is within its dates', () => {
  assert.equal(isActiveTrip(trip(), today), true);
  assert.equal(isActiveTrip(trip({ startDate: today, endDate: today }), today), true);
  assert.equal(isActiveTrip(trip({ status: 'published' }), today), false);
  assert.equal(isActiveTrip(trip({ startDate: '2026-10-06' }), today), false);
  assert.equal(isActiveTrip(trip({ endDate: '2026-10-04' }), today), false);
});

test('the suggested trip is the active one that started most recently', () => {
  const older = trip({ id: 'older', startDate: '2026-10-01' });
  const newer = trip({ id: 'newer', startDate: '2026-10-04' });
  const published = trip({ id: 'published', status: 'published', startDate: today });
  const upcoming = trip({ id: 'upcoming', startDate: '2026-10-10', endDate: '2026-10-12' });

  assert.equal(pickSuggestedTrip([older, published, newer, upcoming], today)?.id, 'newer');
  assert.equal(pickSuggestedTrip([published, upcoming], today), null);
  assert.equal(pickSuggestedTrip([], today), null);
});

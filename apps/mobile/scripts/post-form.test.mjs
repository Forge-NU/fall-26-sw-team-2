import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultVisitedOn, suggestTrip, validatePostForm } from '../src/lib/post-form.ts';

const trip = (overrides) => ({
  id: 'trip-1',
  title: 'Lisbon weekend',
  destination: 'Lisbon, Portugal',
  startDate: '2026-10-03',
  endDate: '2026-10-06',
  status: 'draft',
  ...overrides,
});

const location = { kind: 'custom', name: "Tia Rosa's kitchen" };

test('post day defaults to today inside the trip, otherwise the start date', () => {
  assert.equal(defaultVisitedOn(trip(), '2026-10-05'), '2026-10-05');
  assert.equal(defaultVisitedOn(trip(), '2026-10-20'), '2026-10-03');
  assert.equal(defaultVisitedOn(trip(), '2026-09-01'), '2026-10-03');
});

test('a day picked on the trip page wins, but only if it is inside the trip', () => {
  assert.equal(defaultVisitedOn(trip(), '2026-10-05', '2026-10-04'), '2026-10-04');
  assert.equal(defaultVisitedOn(trip(), '2026-10-05', '2026-11-01'), '2026-10-05');
});

test('suggested trip: active first, then a draft, then anything', () => {
  const past = trip({ id: 'past', startDate: '2026-01-01', endDate: '2026-01-03', status: 'published' });
  const future = trip({ id: 'future', startDate: '2026-12-01', endDate: '2026-12-03' });
  const active = trip({ id: 'active' });
  assert.equal(suggestTrip([past, future, active], '2026-10-04')?.id, 'active');
  assert.equal(suggestTrip([past, future], '2026-10-04')?.id, 'future');
  assert.equal(suggestTrip([past], '2026-10-04')?.id, 'past');
  assert.equal(suggestTrip([], '2026-10-04'), null);
});

test('a post needs a trip, a photo and a location; caption is optional', () => {
  assert.deepEqual(validatePostForm({ trip: trip(), photoCount: 1, location, caption: '' }), {});
  const errors = validatePostForm({ trip: null, photoCount: 0, location: null, caption: '' });
  assert.ok(errors.trip);
  assert.ok(errors.photos);
  assert.ok(errors.location);
});

test('photo and caption limits match DOC-1', () => {
  assert.ok(validatePostForm({ trip: trip(), photoCount: 31, location, caption: '' }).photos);
  assert.deepEqual(validatePostForm({ trip: trip(), photoCount: 30, location, caption: 'a'.repeat(2200) }), {});
  assert.ok(validatePostForm({ trip: trip(), photoCount: 1, location, caption: 'a'.repeat(2201) }).caption);
  // ❤️ is 2 code points, like Postgres counts it
  assert.ok(validatePostForm({ trip: trip(), photoCount: 1, location, caption: '❤️'.repeat(1101) }).caption);
});

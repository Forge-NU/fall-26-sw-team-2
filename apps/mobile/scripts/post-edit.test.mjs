import test from 'node:test';
import assert from 'node:assert/strict';
import { canRate, postEditValues, toUpdatePostRequest, validatePostEdit } from '../src/lib/post-edit.ts';

const pena = { id: 'loc-pena', name: 'Pena Palace', rating: { average: 4.5, count: 2 } };
const belem = { id: 'loc-belem', name: 'Pastéis de Belém', rating: null };

const post = (overrides) => ({
  id: 'post-1',
  caption: 'Fog lifted right as we got to the top.',
  location: pena,
  customLocationName: null,
  rating: 4,
  ...overrides,
});

test('the form starts from the post', () => {
  assert.deepEqual(postEditValues(post()), {
    caption: 'Fog lifted right as we got to the top.',
    location: { kind: 'mapbox', location: pena },
    rating: 4,
  });
  assert.deepEqual(postEditValues(post({ location: null, customLocationName: "Tia's", rating: null, caption: null })), {
    caption: '',
    location: { kind: 'custom', name: "Tia's" },
    rating: null,
  });
});

test('nothing changed sends nothing', () => {
  assert.deepEqual(toUpdatePostRequest(post(), postEditValues(post())), {});
  // Whitespace around the caption isn't a change
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), caption: '  Fog lifted right as we got to the top. ' }), {});
});

test('an emptied caption is cleared with null', () => {
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), caption: '   ' }), { caption: null });
});

test('a new place sends its locationId and keeps the rating', () => {
  const values = { ...postEditValues(post()), location: { kind: 'mapbox', location: belem } };
  assert.deepEqual(toUpdatePostRequest(post(), values), { locationId: 'loc-belem' });
});

test('the rating can be changed or cleared', () => {
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), rating: 5 }), { rating: 5 });
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), rating: null }), { rating: null });
});

test('switching to a custom name sends no rating, since the API clears it', () => {
  const values = { ...postEditValues(post()), location: { kind: 'custom', name: ' Back garden ' } };
  assert.equal(canRate(values.location), false);
  assert.deepEqual(toUpdatePostRequest(post(), values), { customLocationName: 'Back garden' });
});

test('renaming a custom location sends the new name, the same name sends nothing', () => {
  const custom = post({ location: null, customLocationName: "Tia's", rating: null });
  assert.deepEqual(
    toUpdatePostRequest(custom, { ...postEditValues(custom), location: { kind: 'custom', name: "Tia Rosa's" } }),
    { customLocationName: "Tia Rosa's" },
  );
  assert.deepEqual(toUpdatePostRequest(custom, { ...postEditValues(custom), rating: 3 }), {});
});

test('moving from a custom name to a place can add a rating', () => {
  const custom = post({ location: null, customLocationName: "Tia's", rating: null });
  const values = { ...postEditValues(custom), location: { kind: 'mapbox', location: pena }, rating: 5 };
  assert.deepEqual(toUpdatePostRequest(custom, values), { locationId: 'loc-pena', rating: 5 });
});

test('a location is required and the caption has a limit', () => {
  assert.deepEqual(validatePostEdit({ caption: '', location: null, rating: null }), { location: 'Add a location.' });
  const errors = validatePostEdit({ caption: 'a'.repeat(2201), location: { kind: 'custom', name: 'x' }, rating: null });
  assert.ok(errors.caption);
});

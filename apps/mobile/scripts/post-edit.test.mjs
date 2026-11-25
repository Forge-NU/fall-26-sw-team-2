import test from 'node:test';
import assert from 'node:assert/strict';
import { postEditValues, postLocation, toUpdatePostRequest, validatePostEdit, withLocation } from '../src/lib/post-edit.ts';
import { canRateLocation } from '../src/lib/picked-location.ts';

const pena = { id: 'loc-pena', provider: 'mapbox', name: 'Pena Palace', rating: { average: 4.5, count: 2 } };
const belem = { id: 'loc-belem', provider: 'mapbox', name: 'Pastéis de Belém', rating: null };
// A dropped pin (#94 LOC-2) is a locations row with the custom provider
const pin = { id: 'loc-pin', provider: 'custom', name: 'Back garden', rating: null };

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

test('a new place sends its locationId', () => {
  const values = { ...postEditValues(post()), location: { kind: 'mapbox', location: belem } };
  assert.deepEqual(toUpdatePostRequest(post(), values), { locationId: 'loc-belem' });
});

test('the rating can be changed or cleared', () => {
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), rating: 5 }), { rating: 5 });
  assert.deepEqual(toUpdatePostRequest(post(), { ...postEditValues(post()), rating: null }), { rating: null });
});

test('switching to a custom name sends no rating, since the API clears it', () => {
  const values = { ...postEditValues(post()), location: { kind: 'custom', name: ' Back garden ' } };
  assert.equal(canRateLocation(values.location), false);
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

test('a dropped pin opens as a pin, and can be rated', () => {
  assert.deepEqual(postLocation(post({ location: pin })), { kind: 'pin', location: pin });
  const values = { ...postEditValues(post()), location: { kind: 'pin', location: pin }, rating: 3 };
  assert.equal(canRateLocation(values.location), true);
  assert.deepEqual(toUpdatePostRequest(post(), values), { locationId: 'loc-pin', rating: 3 });
});

test('removing the location sends both fields as null and no rating', () => {
  const values = { ...postEditValues(post()), location: null };
  assert.deepEqual(toUpdatePostRequest(post(), values), { locationId: null, customLocationName: null });
  const custom = post({ location: null, customLocationName: "Tia's", rating: null });
  assert.deepEqual(toUpdatePostRequest(custom, { ...postEditValues(custom), location: null }), {
    locationId: null,
    customLocationName: null,
  });
});

test('a post with no location can still be edited', () => {
  const none = post({ location: null, customLocationName: null, rating: null });
  const values = { ...postEditValues(none), caption: 'Just the view.' };
  assert.equal(values.location, null);
  assert.deepEqual(validatePostEdit(values), {});
  assert.deepEqual(toUpdatePostRequest(none, values), { caption: 'Just the view.' });
  // A rating can't come along without a place
  assert.deepEqual(toUpdatePostRequest(none, { ...values, rating: 4 }), { caption: 'Just the view.' });
});

test('the caption and a custom name have limits', () => {
  const errors = validatePostEdit({ caption: 'a'.repeat(2201), location: null, rating: null });
  assert.ok(errors.caption);
  assert.equal(errors.location, undefined);
  const long = validatePostEdit({ caption: '', location: { kind: 'custom', name: 'x'.repeat(101) }, rating: null });
  assert.ok(long.location);
});

test('picking a different place starts unrated, like the composer', () => {
  const values = postEditValues(post());
  // The same place keeps the rating
  assert.equal(withLocation(values, { kind: 'mapbox', location: pena }).rating, 4);
  // A different place, a pin, a custom name or no location clears it
  assert.equal(withLocation(values, { kind: 'mapbox', location: belem }).rating, null);
  assert.equal(withLocation(values, { kind: 'pin', location: pin }).rating, null);
  assert.equal(withLocation(values, { kind: 'custom', name: 'Back garden' }).rating, null);
  assert.equal(withLocation(values, null).rating, null);
  // And saving the new place clears the stored rating too
  assert.deepEqual(toUpdatePostRequest(post(), withLocation(values, { kind: 'mapbox', location: belem })), {
    locationId: 'loc-belem',
    rating: null,
  });
});

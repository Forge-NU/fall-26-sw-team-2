import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRating,
  isSameRatablePlace,
  ratingLabel,
  ratingValueText,
  starFills,
  stepRating,
  tapRating,
} from '../src/lib/rating.ts';

const fills = (value) => starFills(value).join(' ');

test('stars fill to the nearest half', () => {
  assert.equal(fills(null), 'empty empty empty empty empty');
  assert.equal(fills(0), 'empty empty empty empty empty');
  assert.equal(fills(3), 'full full full empty empty');
  assert.equal(fills(3.5), 'full full full half empty');
  assert.equal(fills(4.2), 'full full full full empty');
  assert.equal(fills(4.3), 'full full full full half');
  assert.equal(fills(4.8), 'full full full full full');
  assert.equal(fills(5), 'full full full full full');
});

test('ratings read as whole numbers or one decimal', () => {
  assert.equal(formatRating(4), '4');
  assert.equal(formatRating(4.3), '4.3');
});

test('a shown rating reads "Rated 4.3 out of 5 from 12 posts"', () => {
  assert.equal(ratingLabel(4.3, 12), 'Rated 4.3 out of 5 from 12 posts');
  assert.equal(ratingLabel(5, 1), 'Rated 5 out of 5 from 1 post');
  assert.equal(ratingLabel(4), 'Rated 4 out of 5');
  assert.equal(ratingLabel(null), 'No ratings yet');
});

test('the input reads "3 of 5 stars"', () => {
  assert.equal(ratingValueText(3), '3 of 5 stars');
  assert.equal(ratingValueText(1), '1 of 5 stars');
  assert.equal(ratingValueText(null), 'No rating');
});

test('tapping a star sets it, tapping the same star again clears it', () => {
  assert.equal(tapRating(null, 3), 3);
  assert.equal(tapRating(3, 5), 5);
  assert.equal(tapRating(3, 3), null);
});

test('swiping steps one star at a time, and down from 1 clears', () => {
  assert.equal(stepRating(null, 1), 1);
  assert.equal(stepRating(3, 1), 4);
  assert.equal(stepRating(5, 1), 5);
  assert.equal(stepRating(3, -1), 2);
  assert.equal(stepRating(1, -1), null);
  assert.equal(stepRating(null, -1), null);
});

test('a rating stays only when the same place or pin is picked again', () => {
  const belem = { kind: 'mapbox', location: { id: 'loc-1' } };
  const cove = { kind: 'pin', location: { id: 'pin-1' } };
  const kitchen = { kind: 'custom', name: "Tia Rosa's kitchen" };
  assert.equal(isSameRatablePlace(belem, { kind: 'mapbox', location: { id: 'loc-1' } }), true);
  assert.equal(isSameRatablePlace(cove, { kind: 'pin', location: { id: 'pin-1' } }), true);
  assert.equal(isSameRatablePlace(belem, { kind: 'mapbox', location: { id: 'loc-2' } }), false);
  assert.equal(isSameRatablePlace(belem, cove), false);
  assert.equal(isSameRatablePlace(belem, kitchen), false);
  assert.equal(isSameRatablePlace(kitchen, { ...kitchen }), false);
  assert.equal(isSameRatablePlace(null, belem), false);
  assert.equal(isSameRatablePlace(belem, null), false);
});

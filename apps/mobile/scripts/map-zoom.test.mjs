import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRIES } from '../src/components/explore/mock-data.ts';
import { WORLD_MIN_DELTA, regionFor, zoomLevelFor, zoomRegion } from '../src/lib/map-zoom.ts';

// A portrait iPhone (390 x 844 points)
const PHONE_ASPECT = 390 / 844;

test('zoom levels switch just past each threshold', () => {
  assert.equal(zoomLevelFor(60), 'world');
  assert.equal(zoomLevelFor(30.01), 'world');
  assert.equal(zoomLevelFor(30), 'region');
  assert.equal(zoomLevelFor(1.21), 'region');
  assert.equal(zoomLevelFor(1.2), 'city');
  assert.equal(zoomLevelFor(0.014), 'city');
});

test('tapping any country zooms in past world level', () => {
  for (const country of COUNTRIES) {
    assert.ok(
      country.zoomDelta < WORLD_MIN_DELTA,
      `${country.name} zooms to ${country.zoomDelta}°, which still shows the world`,
    );
    const region = regionFor(country.coordinate, country.zoomDelta, PHONE_ASPECT);
    assert.equal(zoomLevelFor(region.latitudeDelta), 'region', country.name);
  }
});

test('regionFor keeps the latitude span and sizes longitude to the screen', () => {
  const equator = regionFor({ latitude: 0, longitude: 10 }, 20, PHONE_ASPECT);
  assert.equal(equator.latitude, 0);
  assert.equal(equator.longitude, 10);
  assert.equal(equator.latitudeDelta, 20);
  assert.ok(Math.abs(equator.longitudeDelta - 20 * PHONE_ASPECT) < 1e-9);

  // Further from the equator a degree of latitude is taller on screen, so more longitude fits
  const north = regionFor({ latitude: 60, longitude: 10 }, 20, PHONE_ASPECT);
  assert.ok(Math.abs(north.longitudeDelta - 2 * 20 * PHONE_ASPECT) < 1e-9);

  // Never asks for more than the whole globe
  assert.equal(regionFor({ latitude: 0, longitude: 0 }, 300, 2).longitudeDelta, 360);
});

test('zoomRegion builds on the region it gets, so quick taps add up', () => {
  const start = { latitude: 38.7, longitude: -9.1, latitudeDelta: 0.08, longitudeDelta: 0.04 };
  const once = zoomRegion(start, 0.5);
  const twice = zoomRegion(once, 0.5);
  assert.deepEqual(twice, { ...start, latitudeDelta: 0.02, longitudeDelta: 0.01 });

  // Stays within the map's limits
  assert.equal(zoomRegion(start, 1e-6).latitudeDelta, 0.002);
  assert.equal(zoomRegion({ ...start, latitudeDelta: 100, longitudeDelta: 200 }, 4).latitudeDelta, 150);
});

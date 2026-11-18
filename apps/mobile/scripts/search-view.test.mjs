import assert from 'node:assert/strict';
import test from 'node:test';

import { queryKeys } from '../src/api/query-keys.ts';
import { defaultSearchFilters } from '../src/lib/search/filters.ts';
import {
  isSearchOpen,
  keepPreviousResults,
  resetsSearch,
  searchRequest,
  searchView,
} from '../src/lib/search/search-view.ts';

const centers = { permission: 'granted', nearMe: null, mapCenter: { latitude: 38.77, longitude: -9.1 } };
const filters = defaultSearchFilters();
const req = (over = {}) => searchRequest({ active: true, debounced: 'lisbon', tab: 'all', filters, centers, ...over });
// The query key useSearch gives a request
const keyOf = ({ q, filtersKey }, tab = 'all') => queryKeys.search(tab, q, filtersKey);

test('searchRequest only builds a request for open search, 2+ characters and valid filters', () => {
  assert.equal(req({ active: false }).request, null);
  assert.equal(req({ debounced: 'l' }).request, null);
  const invalid = req({ tab: 'posts', filters: { ...filters, from: '2026-06-30', to: '2026-06-01' } });
  assert.equal(invalid.request, null);
  assert.match(invalid.validationError, /End date/);

  const ok = req({ debounced: '  lisbon   food ' });
  assert.deepEqual(ok.request, { q: 'lisbon food', sort: 'relevance' });
  assert.equal(ok.q, 'lisbon food');
  assert.equal(ok.validationError, null);
});

test('searchRequest keys the filters apart from the text', () => {
  assert.equal(req({ debounced: 'lis' }).filtersKey, req({ debounced: 'lisbon' }).filtersKey);
  assert.notEqual(req().filtersKey, req({ tab: 'people' }).filtersKey);
  assert.notEqual(req().filtersKey, req({ filters: { ...filters, sort: 'newest' } }).filtersKey);
  assert.equal(req({ active: false }).filtersKey, '');
});

test('keepPreviousResults keeps results only while the same search is refined', () => {
  const lis = req({ debounced: 'lis' });
  const lisbon = req({ debounced: 'lisbon' });
  // Typing more, or deleting back, in the same tab and filters
  assert.equal(keepPreviousResults(keyOf(lis), lisbon.q, lisbon.filtersKey), true);
  assert.equal(keepPreviousResults(keyOf(lisbon), lis.q, lis.filtersKey), true);
  // An unrelated earlier search
  const maya = req({ debounced: 'maya' });
  assert.equal(keepPreviousResults(keyOf(maya), lisbon.q, lisbon.filtersKey), false);
  // Same text, but a filter or the tab changed
  const newest = req({ filters: { ...filters, sort: 'newest' } });
  assert.equal(keepPreviousResults(keyOf(lisbon), newest.q, newest.filtersKey), false);
  const people = req({ tab: 'people' });
  assert.equal(keepPreviousResults(keyOf(lisbon), people.q, people.filtersKey), false);
  assert.equal(keepPreviousResults(undefined, lisbon.q, lisbon.filtersKey), false);
});

const view = (over = {}) =>
  searchView({
    active: true,
    trimmed: 'lisbon',
    debounced: 'lisbon',
    validationError: null,
    hasRequest: true,
    hasData: false,
    isError: false,
    ...over,
  });

test('searchView is idle until there is something to search', () => {
  assert.equal(view({ trimmed: 'l', debounced: 'l', hasRequest: false }).status, 'idle');
  assert.equal(view({ active: false, hasRequest: false }).status, 'idle');
  // Invalid filters: nothing is sent, and the panel shows the validation error
  assert.equal(view({ validationError: 'Choose valid dates.', hasRequest: false }).status, 'idle');
});

test('searchView loads the first results, then shows them', () => {
  assert.deepEqual(view({ trimmed: 'lisbon', debounced: '', hasRequest: false }), {
    typing: true,
    showData: false,
    status: 'loading',
  });
  assert.equal(view().status, 'loading');
  assert.deepEqual(view({ hasData: true }), { typing: false, showData: true, status: 'ready' });
});

test('searchView keeps results while refining, but not under unrelated new text', () => {
  // "lis" results are on screen and "lisbon" is still waiting on the debounce
  const refining = view({ trimmed: 'lisbon', debounced: 'lis', hasData: true });
  assert.deepEqual(refining, { typing: true, showData: true, status: 'ready' });
  // "maya" results are on screen and the user has typed "lisbon" instead
  const unrelated = view({ trimmed: 'lisbon', debounced: 'maya', hasData: true });
  assert.deepEqual(unrelated, { typing: true, showData: false, status: 'loading' });
});

test('searchView shows an error only when nothing is loaded and nothing new is pending', () => {
  assert.equal(view({ isError: true }).status, 'error');
  assert.equal(view({ isError: true, hasData: true }).status, 'ready');
  assert.equal(view({ isError: true, trimmed: 'lisbon food', debounced: 'lisbon' }).status, 'loading');
});

test('search resets only when it closes', () => {
  assert.equal(resetsSearch(true, false), true);
  assert.equal(resetsSearch(false, true), false);
  assert.equal(resetsSearch(true, true), false);
  assert.equal(resetsSearch(false, false), false);
});

test('search stays open while it has text or the bar was focused', () => {
  assert.equal(isSearchOpen(false, ''), false);
  assert.equal(isSearchOpen(false, '   '), false);
  assert.equal(isSearchOpen(true, ''), true);
  assert.equal(isSearchOpen(false, 'li'), true);
});

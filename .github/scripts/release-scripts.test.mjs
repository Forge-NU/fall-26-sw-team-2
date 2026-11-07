import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextVersion } from './next-version.mjs';
import { withSection } from './set-pr-section.mjs';

test('the first release is 0.0.1, whatever the bump', () => {
  assert.equal(nextVersion([]), '0.0.1');
  assert.equal(nextVersion(['not-a-version'], 'major'), '0.0.1');
});

test('bumps the highest version tag', () => {
  const tags = ['v0.0.9', 'v0.0.10', 'v0.1.0-beta', 'v0.0.2'];

  assert.equal(nextVersion(tags), '0.0.11');
  assert.equal(nextVersion(tags, 'minor'), '0.1.0');
  assert.equal(nextVersion(tags, 'major'), '1.0.0');
});

test('rejects an unknown bump', () => {
  assert.throws(() => nextVersion([], 'huge'), /Unknown bump/);
});

test('appends a section to a description without one', () => {
  assert.equal(
    withSection('My PR', 'release', 'v0.0.2'),
    'My PR\n\n<!-- release:start -->\nv0.0.2\n<!-- release:end -->\n',
  );
  assert.equal(withSection('', 'release', 'v0.0.2'), '<!-- release:start -->\nv0.0.2\n<!-- release:end -->\n');
});

test("replaces only its own section and keeps the author's text", () => {
  const body = [
    'Intro',
    '<!-- release:start -->\nold $& text\n<!-- release:end -->',
    '<!-- ios:start -->\nbuild 1\n<!-- ios:end -->',
    'Outro',
  ].join('\n');

  const updated = withSection(body, 'release', 'v0.0.3');

  assert.equal(
    updated,
    [
      'Intro',
      '<!-- release:start -->\nv0.0.3\n<!-- release:end -->',
      '<!-- ios:start -->\nbuild 1\n<!-- ios:end -->',
      'Outro',
    ].join('\n'),
  );
});

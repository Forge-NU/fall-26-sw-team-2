// Prints the version the next release gets: the latest vX.Y.Z tag bumped by $BUMP
// (major, minor or patch; patch by default). The first release is 0.0.1.
//   BUMP=minor node .github/scripts/next-version.mjs
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const FIRST_VERSION = '0.0.1';

export function nextVersion(tags, bump = 'patch') {
  if (!['major', 'minor', 'patch'].includes(bump)) {
    throw new Error(`Unknown bump "${bump}"; use major, minor or patch`);
  }

  const versions = tags
    .map((tag) => /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim()))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  if (versions.length === 0) return FIRST_VERSION;

  const [major, minor, patch] = versions.at(-1);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n');
  console.log(nextVersion(tags, process.env.BUMP || 'patch'));
}

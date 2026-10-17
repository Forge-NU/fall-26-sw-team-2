// Writes the release version into the app config for one CI build. EAS uploads the
// working directory, so the build picks it up without a commit.
//   node .github/scripts/set-app-version.mjs apps/mobile/app.json 0.0.2
import { readFileSync, writeFileSync } from 'node:fs';

const [file, version] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error(`Expected a version like 1.2.3, got "${version}"`);
}

const config = JSON.parse(readFileSync(file, 'utf8'));
config.expo.version = version;
writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

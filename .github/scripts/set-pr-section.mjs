// Fills in one marked section of a pull request's description and leaves the rest of
// the author's text alone. Each workflow owns its own section.
//   node .github/scripts/set-pr-section.mjs <pr-number> <section-name> <markdown-file>
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export function sectionBlock(name, content) {
  return `<!-- ${name}:start -->\n${content.trim()}\n<!-- ${name}:end -->`;
}

export function withSection(body, name, content) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const block = sectionBlock(name, content);

  const startAt = body.indexOf(start);
  const endAt = startAt === -1 ? -1 : body.indexOf(end, startAt);
  if (endAt !== -1) {
    return body.slice(0, startAt) + block + body.slice(endAt + end.length);
  }
  return body.trim() ? `${body.trimEnd()}\n\n${block}\n` : `${block}\n`;
}

// gh adds a newline after the body; drop it so each write doesn't add another.
function readBody(pr) {
  return execFileSync('gh', ['pr', 'view', pr, '--json', 'body', '--jq', '.body'], {
    encoding: 'utf8',
  }).replace(/\n$/, '');
}

async function main([pr, name, file]) {
  const content = readFileSync(file, 'utf8');
  const block = sectionBlock(name, content);

  // Two workflows can edit the description at the same moment, and the later write
  // wins. Check this section stuck, and write it again if it didn't.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const body = readBody(pr);
    if (body.includes(block)) return;
    execFileSync('gh', ['pr', 'edit', pr, '--body-file', '-'], {
      input: withSection(body, name, content),
    });
    await sleep(3000 * attempt);
    if (readBody(pr).includes(block)) return;
  }
  throw new Error(`Couldn't update the ${name} section of PR #${pr}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}

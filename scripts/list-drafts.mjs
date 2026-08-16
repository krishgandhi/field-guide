/**
 * Entries the pipeline wrote but REFUSED to publish.
 *
 * Anything that passes validation goes straight onto the site with a "not
 * checked yet" badge. What lands here failed a check — an invented figure, a
 * team ESPN never tagged, or an accusation without the denial — so it is
 * deliberately invisible and usually needs a line fixed by hand.
 *
 * An empty list is the normal, healthy result.
 *
 *   npm run drafts
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const DIR = "content/moves/_drafts";

if (!existsSync(DIR)) {
  console.log("Nothing held back. Everything the pipeline wrote is on the site.");
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
if (files.length === 0) {
  console.log("Nothing held back. Everything the pipeline wrote is on the site.");
  process.exit(0);
}

console.log(`${files.length} entr(y/ies) HELD BACK — not on the site:\n`);

for (const file of files) {
  const raw = readFileSync(path.join(DIR, file), "utf8");
  const title = raw.match(/^title:\s*(.+)$/m)?.[1] ?? "(no title)";
  const summary = raw.match(/^summary:\s*(.+)$/m)?.[1] ?? "";
  const bigness = raw.match(/^\s*bigness:\s*(\d)/m)?.[1] ?? "?";
  console.log(`  ${file}`);
  console.log(`    ${title}  [bigness ${bigness}]`);
  if (summary) console.log(`    ${summary}`);
  console.log();
}

console.log("Each failed validation. To publish one:");
console.log(`  1. read it against the reporting linked in its sources`);
console.log(`  2. fix whatever the pipeline objected to`);
console.log(`  3. git mv ${DIR}/<file> content/moves/  and set verified: true`);

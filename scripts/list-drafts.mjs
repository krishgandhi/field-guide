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

import { DRAFTS_DIR as DIR, readMoves } from "./lib/moves.mts";

const drafts = readMoves(DIR);
if (drafts.length === 0) {
  console.log("Nothing held back. Everything the pipeline wrote is on the site.");
  process.exit(0);
}

console.log(`${drafts.length} entr(y/ies) HELD BACK — not on the site:\n`);

for (const { file, title: rawTitle, summary, move } of drafts) {
  const title = rawTitle || "(no title)";
  const bigness = move.bigness ?? "?";
  console.log(`  ${file}`);
  console.log(`    ${title}  [bigness ${bigness}]`);
  if (summary) console.log(`    ${summary}`);
  console.log();
}

console.log("Each failed validation. To publish one:");
console.log(`  1. read it against the reporting linked in its sources`);
console.log(`  2. fix whatever the pipeline objected to`);
console.log(`  3. git mv ${DIR}/<file> content/moves/  and set verified: true`);

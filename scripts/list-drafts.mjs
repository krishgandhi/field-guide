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

import { existsSync, readFileSync } from "node:fs";
import { DRAFTS_DIR as DIR, readMoves } from "./lib/moves.mts";

/**
 * Candidates the pipeline gave up on: the model never returned a usable
 * answer in three tries, or the backlog overflowed before they were reached.
 * They never became an entry at all, so they are listed here too.
 */
const CANDIDATES = "src/data/move-candidates.json";
const givenUp = existsSync(CANDIDATES)
  ? (JSON.parse(readFileSync(CANDIDATES, "utf8")).givenUp ?? [])
  : [];
if (givenUp.length > 0) {
  console.log(`${givenUp.length} candidate(s) GIVEN UP — never drafted:\n`);
  for (const c of givenUp) {
    console.log(`  ${c.published ?? "?"}  ${c.headline}`);
    console.log(`    ${c.reason ?? "given up"}${c.givenUpOn ? ` (${c.givenUpOn})` : ""}`);
    if (c.url) console.log(`    ${c.url}`);
  }
  console.log("\nWrite one up by hand if it matters; otherwise ignore.\n");
}

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

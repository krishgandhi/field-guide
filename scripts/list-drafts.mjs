/**
 * What's waiting for review in content/moves/_drafts/.
 *
 * Drafts are invisible to the site by design, which means they're also easy to
 * forget. This is the reminder.
 *
 *   npm run drafts
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const DIR = "content/moves/_drafts";

if (!existsSync(DIR)) {
  console.log("No drafts. Nothing waiting for review.");
  process.exit(0);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
if (files.length === 0) {
  console.log("No drafts. Nothing waiting for review.");
  process.exit(0);
}

console.log(`${files.length} draft(s) awaiting review:\n`);

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

console.log("These are unverified — only a headline was sourced. To publish one:");
console.log(`  1. check it against the reporting linked in its sources`);
console.log(`  2. git mv ${DIR}/<file> content/moves/`);
console.log(`  3. set verified: true once you've confirmed the facts`);

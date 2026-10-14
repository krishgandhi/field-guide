/**
 * Prints content, heartbeat or none for the data workflow's commit step.
 * The rules, and why, are in scripts/lib/commit-decision.mts.
 *
 * Also warns — on stderr, and in the job summary when there is one — about
 * any fetcher with no successful run in DEAD_FETCHER_HOURS. The heartbeat no
 * longer fires for those (that just built the site daily without fixing
 * anything), so this is where a dead fetcher shows up.
 *
 *   node scripts/commit-decision.mjs
 */

import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { DEAD_FETCHER_HOURS, META_FILE, changedPaths, decide, staleFetchers } from "./lib/commit-decision.mts";
import { readMeta } from "./lib/meta.mts";

const porcelain = execSync("git status --porcelain --untracked-files=all -- src/data public/players content/moves", {
  encoding: "utf8",
});
let committed = {};
try {
  committed = JSON.parse(execSync(`git show HEAD:${META_FILE}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  // No meta.json committed yet: any change to it is worth committing.
}

const dead = staleFetchers(readMeta());
if (dead.length > 0) {
  const message = `No successful run in ${DEAD_FETCHER_HOURS}h: ${dead.join(", ")}. Check those steps' logs.`;
  console.error(`::warning title=Stale data::${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `| Stale data | **${message}** |\n`);
  }
}

console.log(decide(changedPaths(porcelain), committed));

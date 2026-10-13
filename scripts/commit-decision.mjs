/**
 * Prints content, heartbeat or none for the data workflow's commit step.
 * The rules, and why, are in scripts/lib/commit-decision.mts.
 *
 *   node scripts/commit-decision.mjs
 */

import { execSync } from "node:child_process";
import { META_FILE, changedPaths, decide } from "./lib/commit-decision.mts";

const porcelain = execSync("git status --porcelain --untracked-files=all -- src/data public/players content/moves", {
  encoding: "utf8",
});
let committed = {};
try {
  committed = JSON.parse(execSync(`git show HEAD:${META_FILE}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
} catch {
  // No meta.json committed yet: any change to it is worth committing.
}
console.log(decide(changedPaths(porcelain), committed));

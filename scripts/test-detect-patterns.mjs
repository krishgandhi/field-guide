/**
 * Prove the candidate pre-filter still notices the things it should.
 *
 * A silent regression here doesn't break anything visibly — the pipeline just
 * quietly stops finding trades, and out of season that looks exactly like a
 * normal quiet day. The role patterns in particular were written against five
 * real headline wordings, because the obvious guess ("named starter") matched
 * none of them.
 *
 *   npm run test:patterns
 */

import { classify } from "./lib/detect-patterns.mjs";

let failures = 0;
function check(want, text) {
  const got = classify(text);
  const ok = got === want;
  if (!ok) failures++;
  console.log(
    `  [${ok ? "PASS" : "FAIL"}] want ${String(want).padEnd(11)} got ${String(got).padEnd(11)} ${text.slice(0, 60)}`,
  );
}

console.log("transactions:");
check("transaction", "Chiefs trade Trent McDuffie to Rams for four draft picks");
check("transaction", "Patriots TE Hunter Henry signs extension worth up to $20M");
check("transaction", "Eagles agree to trade A.J. Brown to Patriots for 2 picks");
check("transaction", "Raiders sign C Tyler Linderbaum to record deal");
// Every inflection: reporting says "releasing" while a deal is still landing,
// and an earlier pattern that only matched "released" missed this exact story.
check("transaction", "Dolphins releasing QB Tua Tagovailoa");
check("transaction", "Browns trading Myles Garrett to the Rams");
check("transaction", "Team is signing veteran quarterback to one-year deal");
check("transaction", "Vikings waiving veteran linebacker");

console.log("\nrole changes — the five real wordings the Murray story ran under:");
check("role", "Vikings Name Kyler Murray Starting Quarterback Over J.J. McCarthy");
check("role", "Kyler Murray beats J.J. McCarthy for Minnesota Vikings starting QB job");
check("role", "Vikings name Kyler Murray starting Week 1 quarterback for 2026 season");
check("role", "Vikings name Kyler Murray starting QB over J.J. McCarthy");
check("role", "Minnesota Vikings name Kyler Murray as starting quarterback over J.J. McCarthy");
check("role", "Rookie benched after three interceptions in the opener");

console.log("\nseason-enders, which must beat the noise filter:");
check("injury", "Star receiver out for the season with a torn ACL");
check("injury", "Quarterback placed on injured reserve, done for the year");
check("injury", "Left tackle suffers season-ending Achilles injury");

console.log("\nnoise that must be dropped:");
check(null, "Jets CB Stiggers in concussion protocol after collapsing");
check(null, "Source: Lions' Cade Mays (wrist) expected to miss 8-10 weeks");
check(null, "2026 Fantasy Football Draft Guide: Rankings and mock drafts");
check(null, "Inside Lamar Jackson's adjustments to Ravens' new offense");
check(null, "Ranking NFL quarterbacks by trait: Best arm, accuracy, more");
check(null, "Week 3 injury report: who is questionable for Sunday");
check(null, "Takeaways from Raiders' nine training camp practices");

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

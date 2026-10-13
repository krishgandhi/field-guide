/**
 * Prove the candidate pre-filter still notices the things it should.
 *
 * A silent regression here doesn't break anything visibly — the pipeline just
 * quietly stops finding trades, and out of season that looks exactly like a
 * normal quiet day. The role patterns in particular were written against five
 * real headline wordings, because the obvious guess ("named starter") matched
 * none of them.
 */

import { describe, expect, it } from "vitest";
import { classify } from "../scripts/lib/detect-patterns.mjs";

const cases: Record<string, [string | null, string][]> = {
  transactions: [
    ["transaction", "Chiefs trade Trent McDuffie to Rams for four draft picks"],
    ["transaction", "Patriots TE Hunter Henry signs extension worth up to $20M"],
    ["transaction", "Eagles agree to trade A.J. Brown to Patriots for 2 picks"],
    ["transaction", "Raiders sign C Tyler Linderbaum to record deal"],
    // Every inflection: reporting says "releasing" while a deal is still
    // landing, and an earlier pattern that only matched "released" missed this
    // exact story.
    ["transaction", "Dolphins releasing QB Tua Tagovailoa"],
    ["transaction", "Browns trading Myles Garrett to the Rams"],
    ["transaction", "Team is signing veteran quarterback to one-year deal"],
    ["transaction", "Vikings waiving veteran linebacker"],
  ],
  "role changes — the five real wordings the Murray story ran under": [
    ["role", "Vikings Name Kyler Murray Starting Quarterback Over J.J. McCarthy"],
    ["role", "Kyler Murray beats J.J. McCarthy for Minnesota Vikings starting QB job"],
    ["role", "Vikings name Kyler Murray starting Week 1 quarterback for 2026 season"],
    ["role", "Vikings name Kyler Murray starting QB over J.J. McCarthy"],
    ["role", "Minnesota Vikings name Kyler Murray as starting quarterback over J.J. McCarthy"],
    ["role", "Rookie benched after three interceptions in the opener"],
  ],
  "season-enders, which must beat the noise filter": [
    ["injury", "Star receiver out for the season with a torn ACL"],
    ["injury", "Quarterback placed on injured reserve, done for the year"],
    ["injury", "Left tackle suffers season-ending Achilles injury"],
  ],
  "noise that must be dropped": [
    [null, "Jets CB Stiggers in concussion protocol after collapsing"],
    [null, "Source: Lions' Cade Mays (wrist) expected to miss 8-10 weeks"],
    [null, "2026 Fantasy Football Draft Guide: Rankings and mock drafts"],
    [null, "Inside Lamar Jackson's adjustments to Ravens' new offense"],
    [null, "Ranking NFL quarterbacks by trait: Best arm, accuracy, more"],
    [null, "Week 3 injury report: who is questionable for Sunday"],
    [null, "Takeaways from Raiders' nine training camp practices"],
  ],
};

for (const [group, rows] of Object.entries(cases)) {
  describe(group, () => {
    it.each(rows)("%s ← %s", (want, text) => {
      expect(classify(text)).toBe(want);
    });
  });
}

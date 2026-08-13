/**
 * Prove the guardrails on Claude-written game reasons.
 *
 * The name guard is new and is the reason this file exists. Previews now read
 * real reporting and may name players, which is a genuine increase in what can
 * go wrong: a sentence confidently naming a quarterback who plays for another
 * team is exactly the failure CLAUDE.md §1 exists to prevent. The rule is that
 * any two-word proper noun must appear in the article text the model was
 * shown, and that rule needs to be shown working in both directions.
 *
 *   npm run test:reasons
 */

import { problemWith } from "./lib/reason-validation.mjs";

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
}

const NAMES = {
  BUF: "Bills",
  HOU: "Texans",
  KC: "Chiefs",
};
const teamName = (id) => NAMES[id] ?? id;
const allTeamNames = Object.values(NAMES);
const game = { home: "HOU", away: "BUF" };

const sourceText =
  "Josh Allen faces the Texans for the first time since the playoff loss. " +
  "Buffalo's new head coach Joe Brady calls his first regular season game.";

const opts = { teamName, allTeamNames, sourceText };
const ok = (text) => problemWith(text, game, opts);

// --- baseline --------------------------------------------------------------
check(
  "a clean name-free sentence passes",
  ok("Buffalo's first game under a new head coach, against a team that beat them.") === null,
  String(ok("Buffalo's first game under a new head coach, against a team that beat them.")),
);

// --- the name guard --------------------------------------------------------
check(
  "a player named in the reporting is allowed",
  ok("Josh Allen returns to Houston with plenty still to settle from last time.") === null,
  String(ok("Josh Allen returns to Houston with plenty still to settle from last time.")),
);
check(
  "a coach named in the reporting is allowed",
  ok("Joe Brady takes charge for the first time, away from home and under pressure.") === null,
  String(ok("Joe Brady takes charge for the first time, away from home and under pressure.")),
);
check(
  "a player NOT in the reporting is rejected",
  (ok("Patrick Mahomes returns to Houston with plenty still to settle here.") ?? "").includes(
    "isn't in the source reporting",
  ),
  String(ok("Patrick Mahomes returns to Houston with plenty still to settle here.")),
);
check(
  "possessives are matched, not treated as a different name",
  ok("Josh Allen's return to Houston carries more weight than the record suggests.") === null,
  String(ok("Josh Allen's return to Houston carries more weight than the record suggests.")),
);
check(
  "team names never need backing from the reporting",
  ok("The Bills visit the Texans in a game that should stay close throughout.") === null,
  String(ok("The Bills visit the Texans in a game that should stay close throughout.")),
);
check(
  "with no reporting at all, any player name is rejected",
  (problemWith(
    "Josh Allen returns to Houston with plenty still to settle from last time.",
    game,
    { teamName, allTeamNames, sourceText: "" },
  ) ?? "").includes("isn't in the source reporting"),
);

// --- rules that must survive the new capability ----------------------------
check(
  "numbers are still banned, even from the reporting",
  ok("Josh Allen has thrown 3 touchdowns against them and will want more today.") ===
    "contains a number",
  String(ok("Josh Allen has thrown 3 touchdowns against them and will want more today.")),
);
check(
  "jargon is still banned",
  (ok("A high leverage game between two sides who need it rather badly today.") ?? "").includes(
    "jargon",
  ),
);
check(
  "a team not in this game is still rejected",
  (ok("The Chiefs would fancy their chances against either of these two sides.") ?? "").includes(
    "aren't in this game",
  ),
);
check("too short is rejected", (ok("Worth watching.") ?? "").includes("words"));
check(
  "no end punctuation is rejected",
  ok("Buffalo's first game under a new head coach against a team that beat them") ===
    "no end punctuation",
);

// --- false positives, which are the expensive failure here -----------------
// A guard that rejects good sentences is worse than no guard: it silently
// drops prose and falls back to a template with nobody the wiser.
const shouldPass = [
  "The Bills visit the Texans in a game that should stay close throughout.",
  "A rematch of last year's Super Bowl, in the champions' own building.",
  "Sunday Night Football gets the pick of the week, and deservedly so.",
  "Buffalo travel to Houston with plenty still to prove after last season.",
  "This one should go to the wire, and both sides know exactly why.",
];
for (const text of shouldPass) {
  check(`no false positive: "${text.slice(0, 42)}…"`, ok(text) === null, String(ok(text)));
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

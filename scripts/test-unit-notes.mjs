/**
 * Tests for the unit-note guards.
 *
 * Both rules here exist because the model got something right for the wrong
 * reason and would have got the next one wrong. It said a player "came from"
 * the club that drafted him eight years earlier, and it called two coaches new
 * when all we had handed it was their names. Neither is catchable by reading
 * the output — every sentence looks plausible — so they are caught here.
 *
 *   npm run test:units
 */

import { problemWithNote } from "./lib/unit-note-validation.mjs";

let failures = 0;

function check(expect, label, text, evidence) {
  const problem = problemWithNote(text, evidence);
  const passed = expect === "reject" ? Boolean(problem) : !problem;
  if (!passed) failures += 1;
  const status = passed ? "ok  " : "FAIL";
  console.log(`${status} ${expect.padEnd(6)} ${label}`);
  if (!passed) {
    console.log(`       got: ${problem ?? "accepted"}`);
    console.log(`       "${text}"`);
  }
}

// --- arrivals --------------------------------------------------------------

const buffalo = {
  headCoach: "Joe Brady",
  headCoachSeasonsAsHeadCoach: 0,
  recentMovesInvolvingThisTeam: [
    "Bills promote Joe Brady after firing Sean McDermott — the coordinator gets the top job.",
  ],
};

const seattle = {
  headCoach: "Mike Macdonald",
  headCoachSeasonsAsHeadCoach: 2,
  recentMovesInvolvingThisTeam: [
    "Seahawks extend Devon Witherspoon — four more years for the cornerback.",
    "Seahawks sign Terrion Arnold — a one-year deal opposite Witherspoon.",
  ],
};

check(
  "reject",
  "a transfer invented from a draft position",
  "Bradley Chubb, who came from Denver, rushes the passer alongside a young secondary.",
  seattle,
);
check(
  "accept",
  "the same fact stated as a draft position",
  "A first-round pick of Denver's who rushes the passer, alongside a young and inexperienced secondary.",
  seattle,
);
check(
  "accept",
  "an arrival a move entry records",
  "Built around Devon Witherspoon, just signed to a four-year extension, with Terrion Arnold newly signed opposite him.",
  seattle,
);

// --- coaching changes ------------------------------------------------------

const raiders = {
  headCoach: "Klint Kubiak",
  headCoachSeasonsAsHeadCoach: 0,
  recentMovesInvolvingThisTeam: [],
};

const patriots = {
  headCoach: "Mike Vrabel",
  headCoachSeasonsAsHeadCoach: 7,
  recentMovesInvolvingThisTeam: [
    "Patriots trade for A.J. Brown — Philadelphia sends its number one receiver north.",
  ],
};

check(
  "accept",
  "a first-year head coach called new",
  "New head coach Klint Kubiak arrives, so last year's pass-heavy split belongs to the old staff and may not hold.",
  raiders,
);
check(
  "accept",
  "a coaching change a move entry records",
  "Joe Brady takes over after Sean McDermott was fired, so last season's run-leaning mix may not hold this year.",
  buffalo,
);
check(
  "reject",
  "an experienced coach called new with nothing to show it",
  "New head coach Mike Vrabel takes over, so last season's numbers belong entirely to the previous regime.",
  patriots,
);
check(
  "accept",
  "the same coach simply named",
  "Drake Maye carries the ball often himself, and under Mike Vrabel the unit gained more per pass than any other team.",
  patriots,
);

// --- the older rules still hold -------------------------------------------

check(
  "reject",
  "a figure that is not in the evidence",
  "They ran the ball 547 times last season, more often than anyone else in the league by a clear margin.",
  seattle,
);
check("reject", "too short", "A good defence.", seattle);
check(
  "reject",
  "three sentences",
  "They run a lot. They throw rarely. The line is the strength of the whole operation here.",
  seattle,
);

console.log(`\n${failures === 0 ? "All unit-note guards pass." : `${failures} failing`}`);
process.exit(failures === 0 ? 0 : 1);

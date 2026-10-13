/**
 * Tests for the unit-note guards.
 *
 * Both rules here exist because the model got something right for the wrong
 * reason and would have got the next one wrong. It said a player "came from"
 * the club that drafted him eight years earlier, and it called two coaches new
 * when all we had handed it was their names. Neither is catchable by reading
 * the output — every sentence looks plausible — so they are caught here.
 */

import { describe, expect, it } from "vitest";
import {
  peopleNotInEvidence,
  problemWithNote,
  problemWithStaleNote,
  repeatsCoaching,
} from "../scripts/lib/unit-note-validation.mjs";

type Evidence = Parameters<typeof problemWithNote>[1];

function accepts(text: string, evidence: Evidence) {
  expect(problemWithNote(text, evidence) || "accepted").toBe("accepted");
}
function rejects(text: string, evidence: Evidence) {
  expect(problemWithNote(text, evidence)).toBeTruthy();
}

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

const bills = {
  headCoach: "Joe Brady",
  headCoachSeasonsAsHeadCoach: 0,
  recentMovesInvolvingThisTeam: [],
  keyPlayers: [
    // A 2025 first-rounder, so this is his second season, not his first.
    { name: "Maxwell Hairston", position: "CB", seasonInTheLeague: 2 },
    { name: "Christian Benford", position: "CB", seasonInTheLeague: 5 },
    { name: "Mansoor Delane", position: "CB", seasonInTheLeague: 1 },
  ],
};

describe("arrivals", () => {
  it("rejects a transfer invented from a draft position", () => {
    rejects(
      "Bradley Chubb, who came from Denver, rushes the passer alongside a young secondary.",
      seattle,
    );
  });
  it("accepts the same fact stated as a draft position", () => {
    accepts(
      "A first-round pick of Denver's who rushes the passer, alongside a young and inexperienced secondary.",
      seattle,
    );
  });
  it("accepts an arrival a move entry records", () => {
    accepts(
      "Built around Devon Witherspoon, just signed to a four-year extension, with Terrion Arnold newly signed opposite him.",
      seattle,
    );
  });
});

describe("coaching changes", () => {
  it("accepts a first-year head coach called new", () => {
    accepts(
      "New head coach Klint Kubiak arrives, so last year's pass-heavy split belongs to the old staff and may not hold.",
      raiders,
    );
  });
  it("accepts a coaching change a move entry records", () => {
    accepts(
      "Joe Brady takes over after Sean McDermott was fired, so last season's run-leaning mix may not hold this year.",
      buffalo,
    );
  });
  it("rejects an experienced coach called new with nothing to show it", () => {
    rejects(
      "New head coach Mike Vrabel takes over, so last season's numbers belong entirely to the previous regime.",
      patriots,
    );
  });
  it("accepts the same coach simply named", () => {
    accepts(
      "Drake Maye carries the ball often himself, and under Mike Vrabel the unit gained more per pass than any other team.",
      patriots,
    );
  });
});

describe("how long a player has been around", () => {
  it("rejects a second-year player called a rookie", () => {
    rejects(
      "Christian Benford and first-round rookie Maxwell Hairston man the corners, a pairing with plenty of speed.",
      bills,
    );
  });
  it("accepts the same player called second-year", () => {
    accepts(
      "Christian Benford and second-year corner Maxwell Hairston man the corners, a pairing with plenty of speed.",
      bills,
    );
  });
  it("accepts an actual rookie called a rookie", () => {
    accepts(
      "Christian Benford and rookie Mansoor Delane man the corners, a pairing with plenty of speed to burn.",
      bills,
    );
  });
  it("accepts a name at the end of a sentence, followed by another name", () => {
    accepts(
      "Cornerbacks Christian Benford and second-year Maxwell Hairston. Joe Brady's promotion may bring changes.",
      bills,
    );
  });
  it("accepts an initialled name in the same note", () => {
    accepts(
      "Rookie Mansoor Delane starts opposite A.J. Terrell, and the pair should see plenty of work early on.",
      {
        ...bills,
        keyPlayers: [
          ...bills.keyPlayers,
          { name: "A.J. Terrell", position: "CB", seasonInTheLeague: 6 },
        ],
      },
    );
  });
  it("rejects a rookie claim about a player the note does not name", () => {
    rejects(
      "The corners are quick and the rookie in the group is expected to start, which is a lot to ask of anyone.",
      bills,
    );
  });
});

describe("the older rules still hold", () => {
  it("rejects a figure that is not in the evidence", () => {
    rejects(
      "They ran the ball 547 times last season, more often than anyone else in the league by a clear margin.",
      seattle,
    );
  });
  it("rejects a spelled-out figure that is not in the evidence", () => {
    rejects(
      "Built around a kicker who made better than nine in ten field goals, with a steady returner behind him.",
      seattle,
    );
  });
  it("rejects too short", () => {
    rejects("A good defence.", seattle);
  });
  it("rejects three sentences", () => {
    rejects(
      "They run a lot. They throw rarely. The line is the strength of the whole operation here.",
      seattle,
    );
  });
});

describe("coaching is said once per team", () => {
  const bills = (unit: string) => ({ ...buffalo, unit });
  const style = (text: string, unit: string) => repeatsCoaching(text, bills(unit));

  it("allows the coach in the offence note", () => {
    expect(style("Runs through Josh Allen, now under new head coach Joe Brady.", "offence")).toBeNull();
  });

  it("flags him in the defence and special-teams notes", () => {
    expect(style("Leans on Ed Oliver up front, now under new head coach Joe Brady.", "defence")).toBeTruthy();
    expect(style("Tyler Bass kicks, with the whole operation reporting to Joe Brady.", "specialTeams")).toBeTruthy();
  });

  it("passes a defence note that leaves him out", () => {
    expect(style("Leans on Ed Oliver up front and a pair of young cornerbacks.", "defence")).toBeNull();
  });

  it("is not a truth rule: problemWithNote still accepts the repetitive note", () => {
    accepts(
      "Leans on Ed Oliver up front and young corners in the back, now under new head coach Joe Brady.",
      bills("defence"),
    );
  });
});

describe("a stale note must name only people in today's evidence", () => {
  // The review's case: written when McCarthy was the starter, checked after
  // Murray took the job. Every figure traces and nothing claims an arrival,
  // so problemWithNote alone passes it.
  const vikingsNow = {
    headCoach: "Kevin O'Connell",
    headCoachSeasonsAsHeadCoach: 5,
    recentMovesInvolvingThisTeam: [
      "Vikings name Kyler Murray the starter — J.J. McCarthy goes to the bench.",
    ],
    keyPlayers: [
      { name: "Kyler Murray", position: "QB", seasonInTheLeague: 8 },
      { name: "Justin Jefferson", position: "WR", seasonInTheLeague: 7 },
      { name: "Marvin Harrison Jr.", position: "WR", seasonInTheLeague: 3 },
    ],
  };
  const stale =
    "The offence runs through J.J. McCarthy throwing to Justin Jefferson, in a scheme Sean McDermott would recognise.";

  it("the ordinary check passes it — which is the bug", () => {
    expect(problemWithNote(stale, vikingsNow)).toBeNull();
  });

  it("the stale check names who is missing", () => {
    expect(peopleNotInEvidence(stale, vikingsNow)).toEqual(
      expect.arrayContaining(["J.J", "McCarthy", "Sean", "McDermott"]),
    );
    expect(problemWithStaleNote(stale, vikingsNow)).toMatch(/McCarthy/);
  });

  it("catches a lone surname mid-sentence", () => {
    expect(
      problemWithStaleNote("Justin Jefferson is the target, with McCarthy throwing to him on most downs.", vikingsNow),
    ).toMatch(/McCarthy/);
  });

  it("catches a full name opening a sentence", () => {
    expect(
      problemWithStaleNote("Sean McDermott's old scheme still shapes it. Justin Jefferson is the main target.", vikingsNow),
    ).toMatch(/McDermott/);
  });

  it("accepts a note naming only current players, the coach, teams and awards", () => {
    expect(
      problemWithStaleNote(
        "Under Kevin O'Connell, Kyler Murray throws to Justin Jefferson and Marvin Harrison Jr., a Super Bowl-hungry group in Minnesota.",
        vikingsNow,
      ),
    ).toBeNull();
  });

  it("does not read an ordinary sentence-opening word as a name", () => {
    expect(
      peopleNotInEvidence("Leans on the pass, with Kyler Murray throwing to the Vikings receivers.", vikingsNow),
    ).toEqual([]);
  });
});

/**
 * Prove the guardrails on Claude-drafted moves actually reject bad drafts.
 *
 * draft-moves.mjs can't run without an API key, so without this the most
 * safety-critical code in the project would ship unexercised. The check that
 * matters most is the fabricated-number one: the model sees only a headline
 * and a description, so any figure it produces that isn't in that text was
 * invented, and an invented contract figure about a real player is precisely
 * the "confidently wrong" outcome CLAUDE.md §1 exists to prevent.
 */

import { describe, expect, it } from "vitest";
import {
  fairnessProblem,
  isSensitive,
  problemsWith,
  sentenceCount,
  titleCaseProblem,
  titleCaseWords,
} from "../scripts/lib/draft-validation.mjs";

const candidate = {
  id: "1",
  headline: "Patriots TE Hunter Henry signs extension worth up to $20M",
  description: "New England and the tight end agreed to a 2 year deal on Monday.",
  teamIds: ["NE"],
};

const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

/** A draft that uses only figures present in the source: 20 and 2. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function goodEntry(overrides: Record<string, any> = {}) {
  return {
    id: "1",
    skip: false,
    slug: "henry-extension",
    kind: "contract",
    title: "Patriots extend Hunter Henry",
    summary: "New England kept a reliable target rather than let him leave.",
    bigness: 2,
    teams: ["NE"],
    rubric: AXES.map((axis) => ({
      axis,
      score: 3,
      note: "A steady contributor rather than a star. The deal runs 2 years.",
    })),
    body: "A quiet extension worth up to $20 million.",
    ...overrides,
  };
}

/** Does any problem message contain `needle`? Fails with the full list. */
function expectProblem(entry: ReturnType<typeof goodEntry>, needle: string, cand = candidate) {
  const problems: string[] = problemsWith(entry, cand);
  expect(problems.some((p) => p.includes(needle)), problems.join("; ")).toBe(true);
}

const withAxis = (i: number, patch: Record<string, unknown>) =>
  goodEntry().rubric.map((r, j) => (j === i ? { ...r, ...patch } : r));

it("a clean draft passes", () => {
  expect(problemsWith(goodEntry(), candidate)).toEqual([]);
});

describe("invented figures — the one that matters", () => {
  it("rejects an invented contract figure in the body", () => {
    expectProblem(
      goodEntry({
        body: "A quiet extension worth up to $20 million, with $13.5 million guaranteed.",
      }),
      "invented figures",
    );
  });
  it("rejects an invented draft pick in a rubric note", () => {
    expectProblem(
      goodEntry({ rubric: withAxis(2, { note: "New England also sent a 2028 fourth round pick." }) }),
      "invented figures",
    );
  });
  it("rejects an invented age in the summary", () => {
    expectProblem(
      goodEntry({ summary: "At 31 he is past his best, but New England kept him anyway." }),
      "invented figures",
    );
  });
  // A figure that IS in the source must not trip the check — otherwise the
  // rule is useless, because every real cap story would be rejected.
  it("allows a figure taken from the source", () => {
    const problems: string[] = problemsWith(
      goodEntry({ summary: "New England kept him on a deal worth up to $20 million." }),
      candidate,
    );
    expect(problems.some((p) => p.includes("invented figures")), problems.join("; ")).toBe(false);
  });
});

describe("structural checks", () => {
  it("rejects five axes", () => {
    expectProblem(goodEntry({ rubric: goodEntry().rubric.slice(0, 5) }), "5 axes");
  });
  it("rejects axes out of §7 order", () => {
    expectProblem(goodEntry({ rubric: [...goodEntry().rubric].reverse() }), "out of §7 order");
  });
  it("rejects a three-sentence axis note", () => {
    expectProblem(goodEntry({ rubric: withAxis(0, { note: "One. Two. Three." }) }), "two-sentence budget");
  });
  it("rejects a two-sentence summary", () => {
    expectProblem(goodEntry({ summary: "One thing. Another thing." }), "exactly one sentence");
  });
  // The JSON schema used to carry minimum/maximum on these integers, until the
  // API rejected those keywords outright. problemsWith is now the only guard.
  it("rejects a rubric score outside 1-5", () => {
    expectProblem(goodEntry({ rubric: withAxis(3, { score: 7 }) }), "outside 1–5");
  });
  it("rejects a non-integer rubric score", () => {
    expectProblem(goodEntry({ rubric: withAxis(1, { score: 2.5 }) }), "outside 1–5");
  });
  it("rejects bigness outside 1-5", () => {
    expectProblem(goodEntry({ bigness: 9 }), "outside 1–5");
  });
  it("rejects an empty body", () => {
    expectProblem(goodEntry({ body: "  " }), "empty body");
  });
  it("rejects a bad slug", () => {
    expectProblem(goodEntry({ slug: "Henry Extension!" }), "bad slug");
  });
});

// The first real draft listed five teams for a two-team signing, because ESPN
// tags every club that gave the player a visit.
describe("teams must come from what ESPN tagged", () => {
  it("rejects a team not tagged on the article", () => {
    expectProblem(goodEntry({ teams: ["NE", "SEA"] }), "not tagged");
  });
  it("rejects more than three teams", () => {
    expectProblem(goodEntry({ teams: ["NE", "NE", "NE", "NE"] }), "a move involves two or three", {
      ...candidate,
      teamIds: ["NE"],
    });
  });
  it("rejects no teams", () => {
    const problems: string[] = problemsWith(goodEntry({ teams: [] }), candidate);
    expect(problems).toContain("no teams");
  });
  it("rejects an invalid kind", () => {
    expectProblem(goodEntry({ kind: "blockbuster" }), "is not valid");
  });
});

// This rule exists because the first real draft said a player had "criminal
// charges hanging over him" and stopped there, when the reporting said he had
// pleaded not guilty.
describe("fairness: an accusation must not travel without the answer", () => {
  const legalCandidate = {
    id: "2",
    headline: "Facing charges, Terrion Arnold set to join Seahawks",
    description:
      "Arnold faces felony charges in Florida. He has pleaded not guilty and denied the allegations through his representatives.",
    teamIds: ["SEA", "DET"],
  };

  it("isSensitive spots a charge", () => {
    expect(isSensitive("He is facing felony charges.")).toBe(true);
  });
  it("isSensitive spots a suspension", () => {
    expect(isSensitive("He was suspended six games.")).toBe(true);
  });
  it("isSensitive ignores ordinary football", () => {
    expect(isSensitive("He signed a three-year deal.")).toBe(false);
  });
  // Cap vocabulary must never trip the legal rule. This exact sentence came
  // out of the pipeline and held a routine contract extension.
  it("a CAP charge is not an accusation", () => {
    expect(
      isSensitive("Deals are structured so the early-year charges are modest and the pain lands later."),
    ).toBe(false);
  });
  it("dead money charges are not an accusation", () => {
    expect(isSensitive("Cleveland is left paying dead money, and that charge is the reason.")).toBe(false);
  });
  it("but a criminal charge still is", () => {
    expect(isSensitive("He is facing criminal charges in Florida.")).toBe(true);
  });
  it('"charged with" still is', () => {
    expect(isSensitive("He was charged with two counts.")).toBe(true);
  });

  it("rejects an accusation without the denial", () => {
    expect(
      fairnessProblem(
        "A defensive back with criminal charges hanging over him signed a short deal.",
        legalCandidate.description,
      ) ?? "",
    ).toContain("without the denial");
  });
  it("passes the same sentence once it carries the denial", () => {
    expect(
      fairnessProblem(
        "A defensive back facing charges he denies signed a short deal.",
        legalCandidate.description,
      ),
    ).toBeNull();
  });
  it("'not convicted' also satisfies it", () => {
    expect(
      fairnessProblem(
        "He faces charges and has not been convicted of anything.",
        legalCandidate.description,
      ),
    ).toBeNull();
  });
  it("leaves ordinary football prose untouched", () => {
    expect(fairnessProblem("A quiet extension for a reliable target.", "")).toBeNull();
  });
  it("fires inside a full entry too", () => {
    expectProblem(
      {
        ...goodEntry(),
        teams: ["SEA"],
        body: "A defensive back with criminal charges hanging over him joins Seattle.",
      },
      "accusation",
      legalCandidate,
    );
  });
});

describe("helpers", () => {
  it("sentenceCount ignores decimals", () => {
    expect(sentenceCount("Worth $67.5 million now.")).toBe(1);
  });
});

describe("sentence-case titles", () => {
  const jones = {
    id: "2",
    headline: "Sources: Patriots add DaQuan Jones on 1-year, $6M deal",
    description: "The New England Patriots are signing defensive tackle DaQuan Jones, who spent last season with Buffalo.",
    teamIds: ["NE"],
    teams: ["New England Patriots"],
    players: [{ id: "16910", name: "DaQuan Jones" }],
  };

  it("rejects the Title Case headline that reached the site", () => {
    const problems: string[] = problemsWith(
      goodEntry({ title: "Patriots Sign DaQuan Jones on a One-Year Deal" }),
      { ...candidate, ...jones },
    );
    // "Sign" passes as a would-be first name before "DaQuan"; the rest don't.
    expect(problems.join("\n")).toMatch(/Title Case \(One, Year, Deal\)/);
  });

  it("accepts the same title in sentence case, names intact", () => {
    expect(
      titleCaseProblem("Patriots sign DaQuan Jones on a one-year deal", {
        source: `${jones.headline}. ${jones.description}`,
        names: [...jones.teams, "DaQuan Jones"],
      }),
    ).toBeNull();
  });

  it("allows acronyms, city names from the source, and figures", () => {
    expect(
      titleCaseWords("Seattle keep Witherspoon with a four-year, $132m NFL record", {
        source: "Seattle Seahawks cornerback Devon Witherspoon signs a $132m extension.",
        names: ["Seattle Seahawks", "Devon Witherspoon"],
      }),
    ).toEqual([]);
  });

  it("ignores words the source only capitalises to start a sentence", () => {
    expect(
      titleCaseWords("Bills Release a Veteran", {
        source: "Release day. Buffalo moved on.",
        names: ["Buffalo Bills"],
      }),
    ).toEqual(["Release", "Veteran"]);
  });

  it("treats a capitalised word before a surname as a first name", () => {
    expect(
      titleCaseWords("Bills fire Sean McDermott, promote Joe Brady", {
        source: "Buffalo moved on from McDermott and promoted Brady.",
        names: ["Buffalo Bills"],
      }),
    ).toEqual([]);
  });

  it("lets one unexplained capital through, so a real name can't hold a draft", () => {
    expect(titleCaseProblem("Rams bring back Donald", { source: "", names: ["Los Angeles Rams"] })).toBeNull();
  });

  it("every published move title is sentence case", async () => {
    const { getMoves } = await import("@/lib/moves");
    const { team } = await import("@/lib/teams");
    const { peopleByIds } = await import("@/lib/people");
    const { readFileSync } = await import("node:fs");
    // The candidate is long gone for a published entry, so the entry's own
    // words stand in: the whole file (minus the title line) as source, its
    // teams and people as names.
    const bad = getMoves()
      .map((m) => ({
        title: m.headline,
        problem: titleCaseProblem(m.headline, {
          source: readFileSync(`content/moves/${m.slug}.mdx`, "utf8").replace(/^title: .*$/m, ""),
          names: [
            ...m.teams.map((id) => team(id)?.displayName ?? id),
            ...peopleByIds(m.people).map((p) => p.name ?? ""),
          ],
        }),
      }))
      .filter((t) => t.problem);
    expect(bad).toEqual([]);
  });
});

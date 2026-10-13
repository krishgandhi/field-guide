/**
 * Prove the guardrails on Claude-written game reasons.
 *
 * The name guard is the reason this file exists. Previews read real reporting
 * and may name players, which is a genuine increase in what can go wrong: a
 * sentence confidently naming a quarterback who plays for another team is
 * exactly the failure CLAUDE.md §1 exists to prevent. The rule is that any
 * two-word proper noun must appear in the article text the model was shown,
 * and that rule needs to be shown working in both directions.
 */

import { describe, expect, it } from "vitest";
import { problemWith } from "../scripts/lib/reason-validation.mjs";

const NAMES: Record<string, string> = {
  BUF: "Bills",
  HOU: "Texans",
  KC: "Chiefs",
};
const teamName = (id: string) => NAMES[id] ?? id;
const allTeamNames = Object.values(NAMES);
const game = { home: "HOU", away: "BUF" };

const sourceText =
  "Josh Allen faces the Texans for the first time since the playoff loss. " +
  "Buffalo's new head coach Joe Brady calls his first regular season game.";

const opts = { teamName, allTeamNames, sourceText };
const ok = (text: string) => problemWith(text, game, opts);

describe("baseline", () => {
  it("a clean name-free sentence passes", () => {
    expect(
      ok("Buffalo's first game under a new head coach, against a team that beat them."),
    ).toBeNull();
  });
});

describe("the name guard", () => {
  it("a player named in the reporting is allowed", () => {
    expect(
      ok("Josh Allen returns to Houston with plenty still to settle from last time."),
    ).toBeNull();
  });
  it("a coach named in the reporting is allowed", () => {
    expect(
      ok("Joe Brady takes charge for the first time, away from home and under pressure."),
    ).toBeNull();
  });
  it("a player NOT in the reporting is rejected", () => {
    expect(
      ok("Patrick Mahomes returns to Houston with plenty still to settle here.") ?? "",
    ).toContain("isn't in the source reporting");
  });
  it("possessives are matched, not treated as a different name", () => {
    expect(
      ok("Josh Allen's return to Houston carries more weight than the record suggests."),
    ).toBeNull();
  });
  it("team names never need backing from the reporting", () => {
    expect(
      ok("The Bills visit the Texans in a game that should stay close throughout."),
    ).toBeNull();
  });
  it("with no reporting at all, any player name is rejected", () => {
    expect(
      problemWith(
        "Josh Allen returns to Houston with plenty still to settle from last time.",
        game,
        { teamName, allTeamNames, sourceText: "" },
      ) ?? "",
    ).toContain("isn't in the source reporting");
  });
});

describe("rules that must survive the name capability", () => {
  it("numbers are still banned, even from the reporting", () => {
    expect(
      ok("Josh Allen has thrown 3 touchdowns against them and will want more today."),
    ).toBe("contains a number");
  });
  it("jargon is still banned", () => {
    expect(
      ok("A high leverage game between two sides who need it rather badly today.") ?? "",
    ).toContain("jargon");
  });
  it("a team not in this game is still rejected", () => {
    expect(
      ok("The Chiefs would fancy their chances against either of these two sides.") ?? "",
    ).toContain("aren't in this game");
  });
  it("too short is rejected", () => {
    expect(ok("Worth watching.") ?? "").toContain("words");
  });
  it("no end punctuation is rejected", () => {
    expect(
      ok("Buffalo's first game under a new head coach against a team that beat them"),
    ).toBe("no end punctuation");
  });
});

// False positives are the expensive failure here. A guard that rejects good
// sentences is worse than no guard: it silently drops prose and falls back to
// a template with nobody the wiser.
describe("no false positives", () => {
  it.each([
    "The Bills visit the Texans in a game that should stay close throughout.",
    "A rematch of last year's Super Bowl, in the champions' own building.",
    "Sunday Night Football gets the pick of the week, and deservedly so.",
    "Buffalo travel to Houston with plenty still to prove after last season.",
    "This one should go to the wire, and both sides know exactly why.",
  ])("%s", (text) => {
    expect(ok(text)).toBeNull();
  });
});

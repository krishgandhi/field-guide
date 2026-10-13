/**
 * Profile-line evidence: coarse enough that a game day doesn't change it, and
 * the guard that decides whether a line may be shown.
 */

import { describe, expect, it } from "vitest";
import { proseKey } from "../scripts/lib/prose-cache.mjs";
import {
  careerAtLeast,
  floorToLeadingDigit,
  problemWithBlurb,
  problemWithStaleBlurb,
  profileEvidence,
  teamsNamed,
} from "../scripts/lib/profile-evidence.mjs";

const allen = {
  id: "3918298",
  name: "Josh Allen",
  position: "Quarterback",
  team: "Buffalo Bills",
  age: 30,
  experience: "9th Season",
  draft: "2018: Rd 1, Pk 7 (BUF)",
  awards: [{ name: "NFL MVP", count: "1x", seasons: ["2024"] }],
  career: { "Rushing Yards": "4721", "Rushing Touchdowns": "77" },
};

describe("floorToLeadingDigit", () => {
  it("floors to one significant figure", () => {
    expect(floorToLeadingDigit("4721")).toBe(4000);
    expect(floorToLeadingDigit("138.5")).toBe(100);
    expect(floorToLeadingDigit(27)).toBe(20);
    expect(floorToLeadingDigit("0")).toBeNull();
    expect(floorToLeadingDigit("—")).toBeNull();
  });

  it("drops zero columns from career totals", () => {
    expect(careerAtLeast({ Sacks: "0", Tackles: "608" })).toEqual({ Tackles: 600 });
  });
});

describe("profile evidence key", () => {
  it("does not move when a game adds a few yards", () => {
    const after = { ...allen, career: { "Rushing Yards": "4790", "Rushing Touchdowns": "78" } };
    expect(proseKey(3, profileEvidence(after))).toBe(proseKey(3, profileEvidence(allen)));
  });

  it("moves with a new award or a new team", () => {
    const base = proseKey(3, profileEvidence(allen));
    expect(proseKey(3, profileEvidence({ ...allen, team: "Miami Dolphins" }))).not.toBe(base);
    expect(
      proseKey(3, profileEvidence({ ...allen, awards: [...allen.awards, { name: "NFL MVP", count: "2x", seasons: [] }] })),
    ).not.toBe(base);
  });

  it("never carries this season's split", () => {
    expect(JSON.stringify(profileEvidence({ ...allen, season: { "Rushing Yards": "301" } }))).not.toContain("301");
  });
});

describe("problemWithBlurb", () => {
  const good =
    "A quarterback taken seventh overall in 2018 and now in his ninth season, all of them in Buffalo. " +
    "He is one of the best players in football and runs as much as he throws, with more than 4000 career rushing yards.";

  it("accepts a floored figure the model was shown", () => {
    expect(problemWithBlurb(good, allen)).toBeNull();
  });

  it("accepts an exact figure that is still true of his record", () => {
    expect(problemWithBlurb(good.replace("4000", "4,721"), allen)).toBeNull();
  });

  it("rejects an invented figure", () => {
    expect(problemWithBlurb(good.replace("4000", "5000"), allen)).toMatch(/invented/);
  });

  it("rejects a line that repeats his name", () => {
    expect(problemWithBlurb(good.replace("A quarterback", "Allen, a quarterback"), allen)).toMatch(/name/);
  });
});

describe("problemWithStaleBlurb — a line written before a trade", () => {
  const garrett = {
    id: "3122132",
    name: "Myles Garrett",
    position: "Defensive End",
    team: "Los Angeles Rams",
    teamId: "LAR",
    age: 30,
    experience: "10th Season",
    draft: "2017: Rd 1, Pk 1 (CLE)",
    awards: [{ name: "Defensive Player of the Year", count: "2x", seasons: ["2023", "2024"] }],
    career: { Sacks: "125" },
  };
  const tail =
    " He is the best defensive player in football, a two-time Defensive Player of the Year with more than a hundred career sacks.";
  const preTrade = "A defensive end taken first overall in 2017 and now in his tenth season, the centrepiece of the Browns." + tail;
  const postTrade =
    "A defensive end taken first overall in 2017 and now in his tenth season, recently traded from Cleveland to the Rams." + tail;
  const noTeam = "A defensive end taken first overall in 2017 and now in his tenth season, chasing quarterbacks for a living." + tail;

  it("the ordinary check passes the pre-trade line — which is the bug", () => {
    expect(problemWithBlurb(preTrade, garrett)).toBeNull();
  });

  it("refuses a line naming only his former club", () => {
    expect(problemWithStaleBlurb(preTrade, garrett)).toMatch(/Cleveland Browns.*Los Angeles Rams/);
  });

  it("accepts a former club named alongside the current one", () => {
    expect(problemWithStaleBlurb(postTrade, garrett)).toBeNull();
  });

  it("accepts a line naming no club", () => {
    expect(problemWithStaleBlurb(noTeam, garrett)).toBeNull();
  });

  it("does not read a shared city as the other club", () => {
    expect(teamsNamed("He now plays in Los Angeles.", garrett)).toEqual({ namesCurrent: true, others: [] });
    expect(teamsNamed("He left the Chargers.", garrett).others).toEqual(["Los Angeles Chargers"]);
  });
});

/**
 * Playoff wording follows the state of the season, read from the records.
 *
 * "Made the playoffs" on a 3-1 team in October was false: a seed mid-season is
 * a position, not a result.
 */

import { describe, expect, it } from "vitest";
import { finishLabel, regularSeasonOver, STANDINGS } from "@/lib/standings";

const record = (games: number, conferenceRank: number) => ({
  wins: games,
  losses: 0,
  ties: 0,
  pointDifferential: 0,
  conferenceRank,
});

const league = (games: number, isPreviousSeason = false) => ({
  season: 2026,
  isPreviousSeason,
  teams: { BUF: record(games, 4), NYJ: record(games, 12) },
});

describe("regularSeasonOver", () => {
  it("is false while teams have games left", () => {
    expect(regularSeasonOver(league(5))).toBe(false);
  });
  it("is true once every team has played 17", () => {
    expect(regularSeasonOver(league(17))).toBe(true);
  });
  it("is true for last season's finals", () => {
    expect(regularSeasonOver(league(0, true))).toBe(true);
  });
  it("is false when even one team still has a game left", () => {
    const s = league(17);
    s.teams.NYJ = record(16, 12);
    expect(regularSeasonOver(s)).toBe(false);
  });
});

describe("finishLabel", () => {
  it("speaks in the present mid-season", () => {
    expect(finishLabel("BUF", league(5))).toBe("In a playoff spot for now, 4th in the AFC");
    expect(finishLabel("NYJ", league(5))).toBe("Outside the playoff spots for now, 12th in the AFC");
  });
  it("speaks of a result once the season is over", () => {
    expect(finishLabel("BUF", league(17))).toBe("Made the playoffs, 4th in the AFC");
    expect(finishLabel("NYJ", league(0, true))).toBe("Missed the playoffs, 12th in the AFC");
  });
  it("never says made or missed on the committed mid-season data", () => {
    if (regularSeasonOver(STANDINGS)) return;
    expect(finishLabel("BUF")).not.toMatch(/^(Made|Missed)/);
  });
});

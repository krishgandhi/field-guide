/**
 * Unit-note evidence is coarse on purpose: a small weekly wobble in ranks or
 * pass share must not change the cache key, or every game day rewrites all 96
 * notes again.
 */

import { describe, expect, it } from "vitest";
import { proseKey } from "../scripts/lib/prose-cache.mjs";
import {
  leagueContext,
  median,
  passLean,
  tier,
  unitEvidence,
} from "../scripts/lib/unit-evidence.mjs";

const offence = (over: Record<string, unknown> = {}) => ({
  players: [{ label: "QB", name: "Josh Allen", draftedBy: "2018: Rd 1, Pk 7 (BUF)", experience: 9 }],
  rank: 11,
  stats: {
    _runAttempts: { value: "110", rank: 26 },
    "yards per carry": { value: "5.1", rank: 12 },
    sacks: { value: "9", rank: 3 },
  },
  passPlayShare: 60,
  quarterbackCarries: 33,
  ...over,
});

const team = (o = offence()) => ({
  coach: { name: "Joe Brady", experience: 0 },
  units: { offence: o, defence: { players: [], rank: 5, stats: {} }, specialTeams: { players: [], rank: 1, stats: {} } },
});

const leagueOf = (shares: number[]) =>
  leagueContext(
    Object.fromEntries(
      shares.map((s, i) => [`T${i}`, team(offence({ passPlayShare: s, quarterbackCarries: i }))]),
    ),
  );

describe("tier", () => {
  it("buckets ranks into quarters and a middle", () => {
    expect(tier(1)).toBe("top quarter of the league");
    expect(tier(8)).toBe("top quarter of the league");
    expect(tier(9)).toBe("middle of the league");
    expect(tier(24)).toBe("middle of the league");
    expect(tier(25)).toBe("bottom quarter of the league");
    expect(tier(null)).toBeNull();
  });
});

describe("median and pass lean", () => {
  it("computes the median from the data", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("calls a share close unless it is more than the band from the median", () => {
    expect(passLean(60, 60)).toBe("close to the league median");
    expect(passLean(63.9, 60)).toBe("close to the league median");
    expect(passLean(55, 60)).toMatch(/less/);
    expect(passLean(65, 60)).toMatch(/more/);
  });

  it("takes the league median from the teams, not a constant", () => {
    expect(leagueOf([50, 52, 54]).medianPassShare).toBe(52);
  });
});

describe("unit evidence", () => {
  const league = leagueOf([55, 58, 60, 62, 65]);

  it("never hands over raw values or underscore inputs", () => {
    const e = unitEvidence("BUF", team(), "offence", league);
    const text = JSON.stringify(e);
    expect(text).not.toContain("5.1");
    expect(text).not.toContain("_runAttempts");
    expect(e.statTiers).toEqual({
      "yards per carry": "middle of the league",
      sacks: "top quarter of the league",
    });
  });

  it("keeps the same key when ranks and share wobble within a tier", () => {
    const key = (o: ReturnType<typeof offence>) =>
      proseKey(7, unitEvidence("BUF", team(o), "offence", league));
    const before = offence();
    const after = offence({
      rank: 12,
      passPlayShare: 61.2,
      stats: { ...before.stats, "yards per carry": { value: "4.9", rank: 14 } },
    });
    expect(key(after)).toBe(key(before));
  });

  it("changes the key when a tier changes", () => {
    const key = (o: ReturnType<typeof offence>) =>
      proseKey(7, unitEvidence("BUF", team(o), "offence", league));
    expect(key(offence({ rank: 4 }))).not.toBe(key(offence()));
  });

  it("normalises a rookie's experience to his first season", () => {
    const o = offence({ players: [{ label: "WR", name: "A Rookie", draftedBy: null, experience: 0 }] });
    expect(unitEvidence("BUF", team(o), "offence", league).keyPlayers[0].seasonInTheLeague).toBe(1);
  });
});

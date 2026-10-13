/**
 * Check §8 scoring against fixed inputs.
 *
 * Deliberately not against live ESPN data: the point is that a close divisional
 * primetime game outranks a blowout, and that must hold regardless of what this
 * week's schedule happens to look like.
 */

import { describe, expect, it } from "vitest";
import type { Game } from "@/lib/slate";
import { SLATE } from "@/lib/slate";
import { noteFor } from "@/lib/slate/notes";
import { teamName } from "@/lib/teams";
import { factorsFor, sortForViewing, watchability } from "@/lib/watchability";

const game = (over: Partial<Game>): Game => ({
  id: "x",
  kickoff: "2026-09-13T17:00:00Z", // 1pm ET Sunday — not primetime
  home: "HOU",
  away: "TB",
  spread: 10,
  favourite: "home",
  overUnder: 44,
  broadcast: "CBS",
  venue: null,
  neutralSite: false,
  ...over,
});

const tight = game({ home: "BUF", away: "MIA", spread: 2, kickoff: "2026-09-15T00:20:00Z" });
const blowout = game({ home: "HOU", away: "TB", spread: 14 });
const div = game({ home: "BUF", away: "NYJ", spread: 8 });
const billsDull = game({ home: "BUF", away: "JAX", spread: 13 });
const otherGreat = game({ home: "KC", away: "LAR", spread: 1, kickoff: "2026-09-15T00:20:00Z" });
const rivalry = game({ home: "KC", away: "BUF", spread: 9 });
const neutral = game({ home: "KC", away: "JAX", spread: 9 });

const score = (g: Game, week = 1) => watchability(g, week).score;

describe("§8 scoring", () => {
  it("close divisional primetime outranks a Sunday blowout", () => {
    expect(score(tight)).toBeGreaterThan(score(blowout));
  });

  it("factor 1: a 2-point spread beats a 14-point spread, all else equal", () => {
    expect(score(game({ spread: 2 }))).toBeGreaterThan(score(game({ spread: 14 })));
  });

  // Asserted on points, not the bucketed 1-5: the extra weight is real but can
  // fail to cross a bucket boundary, and a >= on the score would pass even if
  // the weighting had been dropped entirely.
  it("factor 2: divisional games carry more weight from week 10", () => {
    const pts = (g: Game, wk: number) => factorsFor(g, wk).reduce((s, f) => s + f.points, 0);
    expect(pts(div, 12)).toBeGreaterThan(pts(div, 2));
  });

  it("factor 3: the Bills game sorts first", () => {
    expect(sortForViewing([otherGreat, billsDull], 1)[0]).toBe(billsDull);
  });
  it("…but its score is not inflated", () => {
    expect(score(billsDull)).toBeLessThan(score(otherGreat));
  });

  it("factor 6: non-divisional rivalry (Bills–Chiefs) scores above a neutral matchup", () => {
    expect(score(rivalry)).toBeGreaterThan(score(neutral));
  });
});

describe("hand-written note keys", () => {
  // Written by hand as WAS; ESPN says WSH. Before keys were normalised the
  // note silently never fired. Checked directly, because the committed-slate
  // check below only runs while the slate is on a week that has notes.
  it("normalise team aliases", () => {
    expect(noteFor(1, "WSH", "PHI")).toBeTruthy();
    expect(noteFor(1, "WAS", "PHI")).toBe(noteFor(1, "WSH", "PHI"));
  });

  it("return nothing for a game without a note", () => {
    expect(noteFor(17, "BUF", "MIA")).toBeUndefined();
  });
});

describe("factor kinds", () => {
  // write-reasons used to detect primetime with reason.startsWith("Primetime"),
  // which only one of the three standalone phrasings does. The phrasing is
  // chosen by a hash of the game id, so try enough ids to hit all three.
  it("every standalone phrasing is tagged as standalone", () => {
    const phrasings = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const f = factorsFor(game({ id: `g${i}`, kickoff: "2026-09-15T00:20:00Z" }), 1).find(
        (x) => x.kind === "standalone",
      );
      expect(f, `game g${i} kicks off Monday night`).toBeDefined();
      phrasings.add(f!.reason);
    }
    expect(phrasings.size).toBe(3);
  });

  it("a Sunday 1pm game has no standalone factor", () => {
    expect(factorsFor(blowout, 1).some((f) => f.kind === "standalone")).toBe(false);
  });
});

describe("reasons", () => {
  it("every reason is a plain sentence with no jargon", () => {
    const jargon = ["leverage", "seeding", "implications", "efficiency", "variance", "spread"];
    const bad: string[] = [];
    for (const g of [tight, blowout, div, rivalry, otherGreat]) {
      const { reason } = watchability(g, 1);
      if (!reason.endsWith(".")) bad.push(`no full stop: "${reason}"`);
      for (const j of jargon) {
        if (reason.toLowerCase().includes(j)) bad.push(`jargon "${j}": "${reason}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("a stored (Claude-written) reason is used instead of the template", () => {
    const stored = watchability(
      game({ spread: 2, reason: "A stored sentence written by the model." }),
      1,
    );
    expect(stored.reason).toBe("A stored sentence written by the model.");
    // …but the score is still computed from the factors, not the prose.
    expect(stored.score).toBe(score(game({ spread: 2 })));
  });

  it("a game with no posted line still scores and explains itself", () => {
    const nl = watchability(game({ spread: null, favourite: null }), 1);
    expect(nl.score).toBeGreaterThanOrEqual(1);
    expect(nl.reason.length).toBeGreaterThan(0);
  });
});

// Six of the first sixteen hand-written notes dismissed games the betting line
// said were coin flips, because they were written from earlier invented values.
// Prose and data disagreeing is the exact failure this product exists to
// avoid, so it's checked rather than trusted.
describe("hand-written notes against the committed slate", () => {
  const DISMISSIVE = [
    "skip it", "not much here", "isn't competitive", "rarely close",
    "not today", "nothing much", "one-sided", "no contest",
  ];
  const noted = SLATE.games.filter((g) => noteFor(SLATE.week, g.away, g.home));

  // Notes are written by hand for a given week, and only Week 1 has them. Once
  // the slate moves on there are none to check, which is expected (notes.ts:
  // "a missing entry is fine"). When a week HAS notes, every game must have
  // one — a partial set means a key didn't match after normalisation.
  it.skipIf(noted.length === 0)("every game in a noted week has a note", () => {
    const missing = SLATE.games
      .filter((g) => !noteFor(SLATE.week, g.away, g.home))
      .map((g) => `${g.away}@${g.home}`);
    expect(missing, "a key probably doesn't match after normalisation").toEqual([]);
  });

  it("no note dismisses a game the line says is close", () => {
    const contradictions: string[] = [];
    for (const g of SLATE.games) {
      const note = noteFor(SLATE.week, g.away, g.home);
      if (!note || g.spread === null || g.spread >= 4) continue;
      const bad = DISMISSIVE.find((p) => note.toLowerCase().includes(p));
      if (bad) {
        contradictions.push(
          `${teamName(g.away)} at ${teamName(g.home)} (line ${g.spread}) says "${bad}"`,
        );
      }
    }
    expect(contradictions).toEqual([]);
  });
});

describe("statements are true", () => {
  const rec = (wins: number, losses: number, conferenceRank: number) => ({
    wins,
    losses,
    ties: 0,
    pointDifferential: 0,
    conferenceRank,
  });
  const standings = (teams: Record<string, ReturnType<typeof rec>>, isPreviousSeason = false) => ({
    season: 2026,
    isPreviousSeason,
    teams,
  });
  // AFC East: BUF and MIA level at the top, NE and NYJ behind.
  const eastRace = standings({
    BUF: rec(6, 3, 2),
    MIA: rec(6, 3, 5),
    NE: rec(4, 5, 9),
    NYJ: rec(2, 7, 14),
    KC: rec(7, 2, 1),
  });
  const reasonsFor = (g: Game, week: number, s: ReturnType<typeof standings>) =>
    factorsFor(g, week, { standings: s, games: [] }).map((f) => f.reason).join(" | ");

  it("never says a division game counts double", () => {
    for (let i = 0; i < 40; i++) {
      for (const wk of [2, 12]) {
        const r = reasonsFor(game({ id: `d${i}`, home: "BUF", away: "NYJ" }), wk, eastRace);
        expect(r).not.toMatch(/double|nearly decided/i);
      }
    }
  });

  it("claims a race only when the standings show one", () => {
    const top = factorsFor(game({ home: "BUF", away: "MIA" }), 12, { standings: eastRace, games: [] });
    expect(top.find((f) => f.kind === "race")?.reason).toMatch(/top two in the division/);

    const mismatch = factorsFor(game({ home: "BUF", away: "NYJ" }), 12, { standings: eastRace, games: [] });
    expect(mismatch.some((f) => f.kind === "race")).toBe(false);
  });

  it("says both are in playoff places only when both are, in the same conference", () => {
    const f = factorsFor(game({ home: "KC", away: "BUF" }), 12, { standings: eastRace, games: [] });
    expect(f.find((x) => x.kind === "race")?.reason).toMatch(/playoff places/);
    const g = factorsFor(game({ home: "KC", away: "NE" }), 12, { standings: eastRace, games: [] });
    expect(g.some((x) => x.kind === "race")).toBe(false);
  });

  it("makes no race claims from last season's standings", () => {
    const old = standings(eastRace.teams, true);
    const f = factorsFor(game({ home: "BUF", away: "MIA" }), 12, { standings: old, games: [] });
    expect(f.some((x) => x.kind === "race")).toBe(false);
  });

  it("says 'nothing else on' only when no other game overlaps", () => {
    const mnf = game({ id: "a", kickoff: "2026-09-15T00:15:00Z" });
    const alsoMnf = game({ id: "b", kickoff: "2026-09-15T01:00:00Z" });
    const alone = factorsFor(mnf, 1, { games: [mnf] }).find((f) => f.kind === "standalone");
    const shared = factorsFor(mnf, 1, { games: [mnf, alsoMnf] }).find((f) => f.kind === "standalone");
    expect(alone?.reason).toMatch(/nothing else|to itself|only game/i);
    expect(shared?.reason).not.toMatch(/nothing else|to itself|only game/i);
    expect(shared?.points).toBe(alone?.points);
  });
});

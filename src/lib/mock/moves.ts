import type { Move } from "./types";

/**
 * Real events only. No invented transactions — a plausible fake trade involving
 * real named players is misinformation the moment this is shown to someone
 * (CLAUDE.md §3, and the copyright/accuracy posture in §9).
 *
 * Sources: the Garrett trade is given in CLAUDE.md §7 itself; the coaching
 * change and Allen's restructure were verified against reporting this session.
 *
 * What's still mock: the 1–5 scores and the prose. Those are my judgement calls
 * in the §7 register, not sourced facts, which is what the "sample data" badge
 * is for. The Garrett entry is written first and by hand precisely as §7 asks,
 * to calibrate the shape everything else matches.
 */

export const MOVES: Move[] = [
  {
    slug: "2026-06-garrett-to-rams",
    headline: "Browns trade Myles Garrett to the Rams",
    date: "June 2026",
    teams: ["CLE", "LAR"],
    bigness: 5,
    soWhat:
      "The best defensive player in football changed teams in the middle of his prime, and Cleveland took picks instead of trying to win now.",
    verified: true,
    rubric: [
      {
        axis: "Player quality",
        score: 5,
        note: "Garrett is the most feared pass rusher of his generation and still in his prime. There is no version of this where the player isn't the headline.",
      },
      {
        axis: "Positional value",
        score: 5,
        note: "Edge rusher sits just below quarterback in what it's worth. The identical trade for a guard would be a footnote nobody discussed.",
      },
      {
        axis: "Cost paid",
        score: 5,
        note: "Jared Verse — a good young edge rusher already on the roster — plus first, second and third round picks across three drafts. Giving up youth and picks together signals conviction bordering on desperation.",
      },
      {
        axis: "Cap mechanics",
        score: 4,
        note: "Moving a contract this size leaves Cleveland paying dead money for a player now in Los Angeles. That charge is the invisible reason the return had to be this large.",
      },
      {
        axis: "Competitive windows",
        score: 5,
        note: "The same player means opposite things to each side: the Rams are spending the future to win immediately, the Browns just admitted the next two years are gone. Both can be correct.",
      },
      {
        axis: "Narrative violation",
        score: 5,
        note: "Cleveland had spent years insisting this player was untouchable. A team publicly contradicting itself is what turns a transaction into a story.",
      },
    ],
  },
  {
    slug: "2026-01-brady-replaces-mcdermott",
    headline: "Bills fire Sean McDermott, promote Joe Brady",
    date: "27 January 2026",
    teams: ["BUF"],
    bigness: 4,
    soWhat:
      "Buffalo changed head coach for the first time in nine years after another playoff exit, and promoted from inside rather than starting over.",
    verified: true,
    // Empty on purpose. §7's rubric is built for player transactions — its first
    // two axes are "Player quality" and "Positional value" — so it has nothing
    // sensible to say about a coaching change. Better to show that honestly than
    // to force six scores that don't mean anything.
    rubric: [],
  },
  {
    slug: "2026-allen-restructure",
    headline: "Bills restructure Josh Allen's contract",
    date: "2026 offseason",
    teams: ["BUF"],
    bigness: 2,
    soWhat:
      "A quiet accounting move that freed about $12 million to spend this year, by promising to pay more in later years.",
    verified: true,
    rubric: [
      {
        axis: "Player quality",
        score: 5,
        note: "Allen is the franchise and nothing here changes that. He is paid like it.",
      },
      {
        axis: "Positional value",
        score: 5,
        note: "Quarterback dominates everything else on this list. It's why his number is large enough to be worth rearranging at all.",
      },
      {
        axis: "Cost paid",
        score: 1,
        note: "Nothing was given up. No picks, no players — this is paperwork.",
      },
      {
        axis: "Cap mechanics",
        score: 5,
        note: "This is the entire move: base salary converted into bonus, cutting his 2026 cap hit to $44.2 million and freeing roughly $12 million now. The same money arrives as a bigger charge later.",
      },
      {
        axis: "Competitive windows",
        score: 3,
        note: "It's a small vote for winning now rather than staying flexible. Teams that do this repeatedly run out of room eventually.",
      },
      {
        axis: "Narrative violation",
        score: 1,
        note: "Nobody reversed a public position. This is routine housekeeping.",
      },
    ],
  },
];

export function getMove(slug: string): Move | undefined {
  return MOVES.find((m) => m.slug === slug);
}

export const MOVES_BY_BIGNESS = [...MOVES].sort((a, b) => b.bigness - a.bigness);

import type { CalendarItem, Game, TeamId } from "./types";

/**
 * Week 1, 2026 — REAL matchups, verified against the published schedule.
 *
 * Deliberately not invented. A made-up slate is the kind of confidently-wrong
 * thing that would have him turn on the wrong game, and CLAUDE.md §3 rules it
 * out. Kickoff windows and broadcast slots are real too.
 *
 * What IS invented, and what the "sample data" badge is there to cover:
 *
 *   - `spread` — betting lines for week 1 don't meaningfully exist in July.
 *     Phase 3 pulls these from The Odds API (§9).
 *   - `watchability` and `reason` — §8's scoring isn't built yet. The numbers
 *     here are placed by hand to show what the screen looks like populated,
 *     not to be trusted. The reasons are written in the §8 register though:
 *     plain language, no jargon, aimed at someone with no context.
 */

export const CURRENT_WEEK = 1;

export const GAMES: Game[] = [
  {
    id: "2026-w1-ne-sea",
    week: 1,
    kickoff: "2026-09-09T20:20:00-04:00",
    away: "NE",
    home: "SEA",
    spread: null,
    window: "Kickoff game",
    watchability: 5,
    reason:
      "The season opens with a rematch of last season's Super Bowl. Everyone will be watching this one.",
  },
  {
    id: "2026-w1-sf-lar",
    week: 1,
    kickoff: "2026-09-10T20:35:00-04:00",
    away: "SF",
    home: "LAR",
    spread: null,
    window: "In Melbourne",
    watchability: 4,
    reason:
      "Two good teams who genuinely dislike each other, played in Melbourne. Odd start time, worth it.",
  },
  {
    id: "2026-w1-buf-hou",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "BUF",
    home: "HOU",
    spread: null,
    window: null,
    watchability: 5,
    reason:
      "Your team, first game, new head coach — and against the side that bullied them last time out.",
  },
  {
    id: "2026-w1-nyg-dal",
    week: 1,
    kickoff: "2026-09-13T20:20:00-04:00",
    away: "NYG",
    home: "DAL",
    spread: null,
    window: "Sunday Night Football",
    watchability: 3,
    reason:
      "An old, genuinely bitter rivalry in the prime slot. The football is often worse than the noise.",
  },
  {
    id: "2026-w1-den-kc",
    week: 1,
    kickoff: "2026-09-14T20:15:00-04:00",
    away: "DEN",
    home: "KC",
    spread: null,
    window: "Monday Night Football",
    watchability: 4,
    reason:
      "First place in their division is usually settled between these two. Denver has closed the gap.",
  },
  {
    id: "2026-w1-gb-min",
    week: 1,
    kickoff: "2026-09-13T16:25:00-04:00",
    away: "GB",
    home: "MIN",
    spread: null,
    window: null,
    watchability: 4,
    reason: "Divisional, close every year, and both sides expect to be good.",
  },
  {
    id: "2026-w1-was-phi",
    week: 1,
    kickoff: "2026-09-13T16:25:00-04:00",
    away: "WAS",
    home: "PHI",
    spread: null,
    window: null,
    watchability: 4,
    reason: "Philadelphia are the measuring stick. This tells you where Washington actually is.",
  },
  {
    id: "2026-w1-bal-ind",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "BAL",
    home: "IND",
    spread: null,
    window: null,
    watchability: 3,
    reason: "Baltimore are usually excellent and usually worth an hour of your Sunday.",
  },
  {
    id: "2026-w1-tb-cin",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "TB",
    home: "CIN",
    spread: null,
    window: null,
    watchability: 3,
    reason: "Two offences that would rather score than defend. Usually entertaining, rarely close.",
  },
  {
    id: "2026-w1-no-det",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "NO",
    home: "DET",
    spread: null,
    window: null,
    watchability: 2,
    reason: "Detroit should win this comfortably. Fine background noise, not appointment viewing.",
  },
  {
    id: "2026-w1-nyj-ten",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "NYJ",
    home: "TEN",
    spread: null,
    window: null,
    watchability: 1,
    reason: "Two teams rebuilding at the same time. Skip it unless you have a reason.",
  },
  {
    id: "2026-w1-atl-pit",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "ATL",
    home: "PIT",
    spread: null,
    window: null,
    watchability: 2,
    reason: "Pittsburgh are always stubborn at home. Low scoring, low drama.",
  },
  {
    id: "2026-w1-chi-car",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "CHI",
    home: "CAR",
    spread: null,
    window: null,
    watchability: 2,
    reason: "Two young quarterbacks finding out where they stand. Interesting later, not yet.",
  },
  {
    id: "2026-w1-cle-jax",
    week: 1,
    kickoff: "2026-09-13T13:00:00-04:00",
    away: "CLE",
    home: "JAX",
    spread: null,
    window: null,
    watchability: 1,
    reason: "Cleveland traded away their best defender in the summer. This will be a long year.",
  },
  {
    id: "2026-w1-ari-lac",
    week: 1,
    kickoff: "2026-09-13T16:25:00-04:00",
    away: "ARI",
    home: "LAC",
    spread: null,
    window: null,
    watchability: 3,
    reason: "Los Angeles are quietly good and nobody talks about them. Decent late-window option.",
  },
  {
    id: "2026-w1-mia-lv",
    week: 1,
    kickoff: "2026-09-13T16:25:00-04:00",
    away: "MIA",
    home: "LV",
    spread: null,
    window: null,
    watchability: 2,
    reason: "Both sides have questions at quarterback. Watch if the other late game is a blowout.",
  },
];

/**
 * Teams not playing this week. Empty in week 1 — byes run weeks 5–14 (verified).
 *
 * §13 calls out bye weeks as confusing newcomers "every single year", so the UI
 * must state this explicitly rather than silently listing 30 teams instead of 32.
 */
export const BYE_TEAMS: TeamId[] = [];

/** The Bills' bye is week 7 — verified. */
export const BILLS_BYE_WEEK = 7;

export const CALENDAR: CalendarItem[] = [
  {
    slug: "season-opener",
    label: "Season opens",
    date: "Wed 9 Sep",
    why: "First real game after seven months of nothing. Everything before this is practice.",
  },
  {
    slug: "bills-bye",
    label: "Bills bye week",
    date: "Week 7",
    why: "Buffalo don't play at all that week. Nothing is wrong — they're resting.",
  },
];

export function gameById(id: string): Game | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Bills first (§8 rule 3), then by watchability. */
export function slateInViewingOrder(): Game[] {
  return [...GAMES].sort((a, b) => {
    const aBills = a.home === "BUF" || a.away === "BUF";
    const bBills = b.home === "BUF" || b.away === "BUF";
    if (aBills !== bBills) return aBills ? -1 : 1;
    return b.watchability - a.watchability;
  });
}

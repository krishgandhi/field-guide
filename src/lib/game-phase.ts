/**
 * Where a game is relative to now: still to come, being played, or done.
 *
 * The site has no live scores (§2), and the slate only ever holds one week.
 * Without this, Monday night's game stayed "Must watch, Mon 8:15 PM" all the
 * way to Wednesday — presented as upcoming two days after it was played.
 *
 * Kept free of imports so client components can call it without pulling the
 * slate into the browser bundle. Callers must evaluate it when the page is
 * VIEWED, not when it was built (see components/games/timed.tsx).
 */

export type GamePhase = "upcoming" | "live" | "played";

/**
 * How long after kickoff a game counts as being played. An NFL game runs
 * about three hours and a quarter; overtime and delays push some near four.
 */
export const GAME_LENGTH_MS = 4 * 60 * 60 * 1000;

export function gamePhase(kickoff: string, now: number = Date.now()): GamePhase {
  const at = Date.parse(kickoff);
  // An unreadable kickoff is shown as upcoming: the card still says when, and
  // hiding a game is worse than mislabelling its tense.
  if (Number.isNaN(at) || now < at) return "upcoming";
  return now < at + GAME_LENGTH_MS ? "live" : "played";
}

/** The first game in `games` (already in the caller's order) still to come, or null. */
export function nextUnplayed<T extends { kickoff: string }>(
  games: T[],
  now: number = Date.now(),
): T | null {
  return games.find((g) => gamePhase(g.kickoff, now) === "upcoming") ?? null;
}

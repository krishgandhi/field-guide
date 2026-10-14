import type { Game, Injury } from "@/lib/slate";
import { injuriesFor } from "@/lib/slate";
import { recordFor, recordLabel, STANDINGS } from "@/lib/standings";
import { teamName } from "@/lib/teams";
import { todayInNewYork } from "@/lib/calendar";

/**
 * Words for the facts on a game card. Everything the old card abbreviated
 * ("fav", "1 out") is spelled out here, once, so every card says it the same
 * way.
 *
 * All times are Eastern — the league's clock, and the only zone where the
 * server render and the browser agree.
 */

const ET = "America/New_York";

const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: ET });
const weekdayLong = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: ET });
const clock = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ET,
});
const hour24 = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: ET });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: ET });
const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: ET,
});

/** "Sun 1:00 PM · Fox". Fixed, so it is safe on statically built pages. */
export function kickoffLabel(game: Game): string {
  const at = new Date(game.kickoff);
  const when = `${weekdayShort.format(at)} ${clock.format(at)}`;
  return game.broadcast ? `${when} · ${game.broadcast}` : when;
}

/**
 * "Tonight 8:15 PM · ESPN, ABC" when the game is today, otherwise the same
 * as kickoffLabel. Only for pages that re-render (the home screen does,
 * hourly) — a static page would freeze "Tonight" at build time.
 */
export function relativeKickoffLabel(game: Game, now: number = Date.now()): string {
  const at = new Date(game.kickoff);
  if (dayKey.format(at) !== todayInNewYork(now)) return kickoffLabel(game);
  const day = Number(hour24.format(at)) >= 17 ? "Tonight" : "Today";
  const when = `${day} ${clock.format(at)}`;
  return game.broadcast ? `${when} · ${game.broadcast}` : when;
}

/** "Wednesday, Oct 14". */
export function todayLabel(now: number = Date.now()): string {
  return longDate.format(new Date(now));
}

/**
 * One line on where the Bills' week stands: "Bills play tonight", "Bills
 * play Sunday", "Bills played Monday". Past tense once kickoff has gone,
 * because this site has no scores (§2) and must not pretend the game is
 * still to come.
 */
export function teamWeekLine(
  id: string,
  game: Game | undefined,
  byes: string[],
  now: number = Date.now(),
): string | null {
  const name = teamName(id);
  if (byes.includes(id)) return `${name} are off this week`;
  if (!game) return null;
  const at = new Date(game.kickoff);
  if (at.getTime() <= now) return `${name} played ${weekdayLong.format(at)}`;
  if (dayKey.format(at) === todayInNewYork(now)) {
    return Number(hour24.format(at)) >= 17 ? `${name} play tonight` : `${name} play today`;
  }
  return `${name} play ${weekdayLong.format(at)}`;
}

/**
 * "Rams by 3.5" — who the bookmakers expect to win and by how much. Null
 * when no line is posted, so the card says nothing rather than guessing.
 */
export function spreadLabel(game: Game): string | null {
  if (game.spread === null) return null;
  if (game.spread === 0 || game.favourite === null) return "Dead even";
  const fav = game.favourite === "home" ? game.home : game.away;
  return `${teamName(fav)} by ${formatSpread(game.spread)}`;
}

/** "by 3.5" on the favourite's row, or null on the other row. */
export function favouriteSuffix(game: Game, teamId: string): string | null {
  if (game.spread === null || game.spread === 0 || game.favourite === null) return null;
  const fav = game.favourite === "home" ? game.home : game.away;
  return fav === teamId ? `by ${formatSpread(game.spread)}` : null;
}

function formatSpread(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "3–1", this season only. Last season's finals would read as this year's. */
export function recordText(teamId: string): string | null {
  if (STANDINGS.isPreviousSeason) return null;
  const r = recordFor(teamId);
  return r ? recordLabel(r).replaceAll("-", "–") : null;
}

export type InjuryReport = {
  teamId: string;
  /** "Bills: 1 out" or "Bears: 3 out, 1 doubtful". */
  summary: string;
  players: Injury[];
};

/** The week's injury report for one team in plain words, or null if clean. */
export function injuryReport(teamId: string): InjuryReport | null {
  const players = injuriesFor(teamId);
  if (players.length === 0) return null;
  const counts = new Map<string, number>();
  for (const p of players) {
    const status = p.status.toLowerCase();
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    // "out" first: it's the one that changes the game.
    .sort(([a], [b]) => (a === "out" ? -1 : b === "out" ? 1 : 0))
    .map(([status, n]) => `${n} ${status}`);
  return { teamId, summary: `${teamName(teamId)}: ${parts.join(", ")}`, players };
}

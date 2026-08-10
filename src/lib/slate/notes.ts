/**
 * Hand-written notes on specific games.
 *
 * The scored template (src/lib/watchability.ts) can only say what the factors
 * tell it — close game, same division, primetime. It cannot know that Seattle
 * are the reigning champions or that Cleveland traded away their best player.
 * That's what these are for: the thing a friend who follows the league would
 * actually lead with.
 *
 * Rules, because this is the file most likely to go stale or drift into
 * invention:
 *
 *   - Every factual claim here is checked against reporting. Where there's no
 *     real storyline, the note gives an OPINION about whether the game is worth
 *     your time — which is honest — rather than a manufactured fact.
 *   - Never a statistic, a record, or a score. Those rot within a week.
 *   - Keyed by week and matchup, not ESPN's numeric event id, so they stay
 *     readable and survive a refetch.
 *   - A missing entry is fine and expected. The template covers it.
 *
 * These take precedence over both the model-written and templated sentences,
 * because a human deliberately wrote them.
 */

import { team } from "@/lib/teams";

/**
 * Keys go through the same normaliser the rest of the app uses.
 *
 * Written by hand as `WAS`, ESPN says `WSH`, and the note silently never fired
 * — the game just fell through to the template with no error. §13's
 * abbreviation warning, third time. Normalising here means the key is whatever
 * you happen to type.
 */
const KEY = (week: number, away: string, home: string) =>
  `${week}:${team(away)?.id ?? away}@${team(home)?.id ?? home}`;

const NOTES: Record<string, string> = {
  // --- Week 1, 2026 ---------------------------------------------------------

  // Verified: Seattle won Super Bowl LX over New England; first season opener
  // that's also a Super Bowl rematch since 2016; A.J. Brown debuts for the Patriots.
  [KEY(1, "NE", "SEA")]:
    "The season opens with a rematch of last year's Super Bowl, in the champions' building. If you watch one game all week, this is it.",

  // Verified: played in Melbourne; McVay and Shanahan, two of the most admired
  // coaches in the league, both made the playoffs last season.
  [KEY(1, "SF", "LAR")]:
    "Two genuine contenders, played in Australia at a strange hour, between two coaches everyone else in the league copies.",

  // Verified: Bills' first game under Joe Brady; Houston physically beat them
  // last time these two met.
  [KEY(1, "BUF", "HOU")]:
    "Buffalo's first game under a new head coach, against the team that pushed them around last time. You'll learn a lot about your season in three hours.",

  // Verified: long-standing division rivalry, Sunday night slot.
  [KEY(1, "DAL", "NYG")]:
    "An old, genuinely nasty rivalry in the Sunday night slot. The atmosphere is usually better than the football.",

  // Verified: division rivals, Monday night.
  [KEY(1, "DEN", "KC")]:
    "These two have decided their division for years, and Denver have closed the gap. Good way to end the week.",

  // Verified: Cleveland traded Myles Garrett to the Rams in June.
  [KEY(1, "CLE", "JAX")]:
    "Cleveland sold off their best player in the summer and are openly building for later. Not much here.",

  // Verified: Fernando Mendoza was the first overall pick and may start for Las Vegas.
  [KEY(1, "MIA", "LV")]:
    "The first overall pick may make his debut here, and the market has these two almost dead level.",

  [KEY(1, "GB", "MIN")]:
    "One of the oldest rivalries in the sport, and these two are usually separated by a single play.",

  [KEY(1, "WAS", "PHI")]:
    "Philadelphia are the standard in this division. This tells you whether Washington are actually close.",

  [KEY(1, "TB", "CIN")]:
    "Two teams who would much rather score than defend, and nobody can pick a winner. Should be fun.",

  [KEY(1, "BAL", "IND")]:
    "Baltimore are reliably watchable, and this is closer than most people would guess.",

  [KEY(1, "NO", "DET")]:
    "Detroit should handle this comfortably. Fine to have on in the background.",

  [KEY(1, "ATL", "PIT")]:
    "Pittsburgh are stubborn at home and this should stay tight. Low-scoring, but genuinely in doubt.",

  [KEY(1, "CHI", "CAR")]:
    "Two young quarterbacks finding out where they stand, in a game nobody can call.",

  [KEY(1, "NYJ", "TEN")]:
    "Neither side is any good yet, but they are evenly matched, so it should at least stay close.",

  [KEY(1, "ARI", "LAC")]:
    "Los Angeles are quietly good and nobody talks about them. Could get away from Arizona early.",
};

export function noteFor(
  week: number,
  away: string,
  home: string,
): string | undefined {
  return NOTES[KEY(week, away, home)];
}

import type { Game } from "@/lib/slate";
import { hasStarQb, isRivalry } from "@/lib/slate/context";
import { isDivisional } from "@/lib/teams";

/**
 * Watchability scoring — CLAUDE.md §8.
 *
 * A pure function of a game plus the week number. Kept out of the fetch script
 * so the rubric can change without refetching, and so it can be checked against
 * fixed inputs rather than whatever ESPN happens to be serving.
 *
 * §8's weighting, in its stated order:
 *   1. Spread under 4 — "single best predictor of a good watch"
 *   2. Playoff or division implications, heavier after week 10
 *   3. Bills game — handled by ORDERING, not score (see sortForViewing)
 *   4. Star quarterback matchup
 *   5. Standalone broadcast window
 *   6. Rivalry or revenge angle
 *
 * Every score travels with a sentence. §8 is explicit that the reason must be
 * written for someone with no context, so these avoid jargon entirely — no
 * "leverage", no "seeding implications".
 */

export type Factor = {
  points: number;
  /** Ordered by how much it should lead the sentence. */
  priority: number;
  reason: string;
};

/** A standalone window is one where this is the only game on. */
function isStandalone(game: Game): boolean {
  const tv = game.broadcast?.toLowerCase() ?? "";
  const day = new Date(game.kickoff).getUTCDay();
  const hourEt = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/New_York",
    }).format(new Date(game.kickoff)),
  );
  // Thursday, Monday, or anything kicking off after 7pm Eastern: the league
  // puts its best guesses in the windows where nothing competes with them.
  const primetime = hourEt >= 19;
  const standaloneDay = day === 5 /* Fri UTC = Thu night ET */ || day === 2 /* Mon night */;
  return primetime || standaloneDay || tv.includes("netflix");
}

export function factorsFor(game: Game, week: number): Factor[] {
  const found: Factor[] = [];

  // 1. The market thinks it'll be close.
  if (game.spread !== null) {
    if (game.spread < 4) {
      found.push({
        points: 3,
        priority: 1,
        reason: "The bookmakers can barely separate these two",
      });
    } else if (game.spread < 7) {
      found.push({
        points: 1,
        priority: 5,
        reason: "Should be competitive without being a coin flip",
      });
    } else {
      found.push({
        points: 0,
        priority: 9,
        reason: "One side is a clear favourite",
      });
    }
  }

  // 2. Division games decide who makes the playoffs, and matter more late on.
  if (isDivisional(game.home, game.away)) {
    const late = week >= 10;
    found.push({
      points: late ? 2 : 1,
      priority: 2,
      reason: late
        ? "Same division, and this late it goes a long way to deciding who wins it"
        : "Same division — they play twice a year and it counts double in the standings",
    });
  }

  // 4. Star quarterbacks. Never named: see the note in context.ts.
  const stars = [game.home, game.away].filter(hasStarQb).length;
  if (stars === 2) {
    found.push({
      points: 2,
      priority: 3,
      reason: "Two of the best quarterbacks in the league, head to head",
    });
  } else if (stars === 1) {
    found.push({
      points: 1,
      priority: 6,
      reason: "One of the best quarterbacks in the league is playing",
    });
  }

  // 5. Nothing else is on.
  if (isStandalone(game)) {
    found.push({
      points: 1,
      priority: 7,
      reason: "Primetime, with no other game to flick between",
    });
  }

  // 6. They don't like each other.
  if (isRivalry(game.home, game.away)) {
    found.push({
      points: 1,
      priority: 4,
      reason: "These two genuinely don't like each other",
    });
  }

  return found;
}

/** Total points → the 1–5 the UI shows. */
function toScore(points: number): number {
  if (points >= 6) return 5;
  if (points >= 4) return 4;
  if (points >= 2) return 3;
  if (points >= 1) return 2;
  return 1;
}

export type Watchability = {
  score: number;
  reason: string;
};

export function watchability(game: Game, week: number): Watchability {
  const factors = factorsFor(game, week);
  const points = factors.reduce((sum, f) => sum + f.points, 0);

  const spoken = [...factors]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 2)
    .map((f) => f.reason);

  const reason =
    spoken.length === 0
      ? "Nothing much riding on this one."
      : spoken.length === 1
        ? `${spoken[0]}.`
        : `${spoken[0]}, and ${spoken[1].charAt(0).toLowerCase()}${spoken[1].slice(1)}.`;

  return { score: toScore(points), reason };
}

/**
 * Viewing order. §8: the Bills game "always surfaces first regardless of
 * score" — so it sorts first, and its score is left honest rather than
 * inflated. A bad Bills game should still read as a bad game.
 */
export function sortForViewing<T extends Game>(
  games: T[],
  week: number,
  favourite = "BUF",
): T[] {
  return [...games].sort((a, b) => {
    const aFav = a.home === favourite || a.away === favourite;
    const bFav = b.home === favourite || b.away === favourite;
    if (aFav !== bFav) return aFav ? -1 : 1;
    return watchability(b, week).score - watchability(a, week).score;
  });
}

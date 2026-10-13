import type { Game } from "@/lib/slate";
import { hasStarQb, isRivalry } from "@/lib/slate/context";
import { isDivisional } from "@/lib/teams";
import { noteFor } from "@/lib/slate/notes";

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

/**
 * Which §8 factor fired. Code that needs to know WHY a game scored — the
 * prose writer asking "is this primetime?" — reads this, never the wording:
 * the sentences are picked from several phrasings per factor, and matching on
 * text ("starts with Primetime") silently missed two of the three.
 */
export type FactorKind = "close" | "division" | "quarterbacks" | "standalone" | "rivalry";

export type Factor = {
  kind: FactorKind;
  points: number;
  /** Ordered by how much it should lead the sentence. */
  priority: number;
  reason: string;
};

/**
 * Pick one phrasing for this game, stably.
 *
 * Sixteen games all saying "The bookmakers can barely separate these two" is
 * what made the templated version read as machine-assembled. Several phrasings
 * per factor fixes that — but the choice has to be deterministic, or a static
 * rebuild would silently reword every game and the diff would be noise.
 *
 * A hash of the game id gives variety across the slate and stability across
 * builds.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const pick = (options: string[], seed: string, salt: number) =>
  options[(hash(seed) + salt) % options.length];

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

  const seed = game.id;

  // 1. The market thinks it'll be close.
  if (game.spread !== null) {
    if (game.spread < 4) {
      found.push({
        kind: "close",
        points: 3,
        priority: 1,
        reason: pick(
          [
            "Nobody can separate these two",
            "This one should go to the wire",
            "As even a game as the week offers",
            "Expect it to be tight the whole way",
          ],
          seed,
          0,
        ),
      });
    } else if (game.spread < 7) {
      found.push({
        kind: "close",
        points: 1,
        priority: 5,
        reason: pick(
          [
            "One side is favoured, but not by much",
            "Competitive without being a coin flip",
            "Closer than it looks on paper",
          ],
          seed,
          1,
        ),
      });
    } else {
      found.push({
        kind: "close",
        points: 0,
        priority: 9,
        reason: pick(
          [
            "One side is a heavy favourite",
            "This could get away from someone early",
            "Not much doubt about who wins",
          ],
          seed,
          2,
        ),
      });
    }
  }

  // 2. Division games decide who makes the playoffs, and matter more late on.
  if (isDivisional(game.home, game.away)) {
    const late = week >= 10;
    found.push({
      kind: "division",
      points: late ? 2 : 1,
      priority: 2,
      reason: late
        ? pick(
            [
              "Same division, and this late that goes a long way to settling it",
              "A division game with the standings nearly decided",
              "These two are fighting for the same playoff spot",
            ],
            seed,
            3,
          )
        : pick(
            [
              "Same division, so it counts double in the standings",
              "They play twice a year and both games matter",
              "A division game, which is worth more than the record suggests",
            ],
            seed,
            4,
          ),
    });
  }

  // 4. Star quarterbacks: a former MVP starting, per context.ts. The wording
  // says exactly what the list guarantees and no more.
  const stars = [game.home, game.away].filter((t) => hasStarQb(t)).length;
  if (stars === 2) {
    found.push({
      kind: "quarterbacks",
      points: 2,
      priority: 3,
      reason: pick(
        [
          "Two former MVPs at quarterback, head to head",
          "Both quarterbacks have won the league's MVP award",
          "A quarterback duel between two former MVPs",
        ],
        seed,
        5,
      ),
    });
  } else if (stars === 1) {
    found.push({
      kind: "quarterbacks",
      points: 1,
      priority: 6,
      reason: pick(
        [
          "A former league MVP is playing quarterback",
          "Worth it to watch a former MVP at quarterback",
        ],
        seed,
        6,
      ),
    });
  }

  // 5. Nothing else is on.
  if (isStandalone(game)) {
    found.push({
      kind: "standalone",
      points: 1,
      priority: 7,
      reason: pick(
        [
          "Primetime, with nothing else on",
          "It has the night to itself",
          "The only game in this window",
        ],
        seed,
        7,
      ),
    });
  }

  // 6. They don't like each other.
  if (isRivalry(game.home, game.away)) {
    found.push({
      kind: "rivalry",
      points: 1,
      priority: 4,
      reason: pick(
        [
          "These two genuinely don't like each other",
          "There's real history here",
          "An old grudge, and both sides remember it",
        ],
        seed,
        8,
      ),
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

  // Precedence, most deliberate first: a hand-written note, then a validated
  // model-written sentence, then the template. The score is computed from the
  // factors either way — better prose must never make a game look better.
  const note = noteFor(week, game.away, game.home);
  if (note) return { score: toScore(points), reason: note };
  if (game.reason) return { score: toScore(points), reason: game.reason };

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

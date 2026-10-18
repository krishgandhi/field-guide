/**
 * The two §8 factors no API provides: rivalries, and which quarterbacks are
 * worth crossing the room for.
 *
 * Both lists are hand-kept JSON beside this file — editorial data, not code.
 * Rivalries are a judgement and say so. The quarterback list is a checkable
 * fact (MVP winners), joined to live data: who is starting this week.
 */

import rivalries from "./rivalries.json";
import starQuarterbacks from "./star-quarterbacks.json";
import { injuriesFor } from "@/lib/slate";
import { startingQb } from "@/lib/team-detail";
import { team } from "@/lib/teams";

/**
 * Rivalries — pairs that carry weight beyond the standings. The list lives in
 * rivalries.json, with the reasoning for what goes in it.
 */
const RIVALRY_KEYS = new Set(
  (rivalries.pairs as [string, string][]).map(([a, b]) => key(a, b)),
);

function key(a: string, b: string): string {
  return [team(a)?.id ?? a, team(b)?.id ?? b].sort().join("|");
}

export function isRivalry(a: string, b: string): boolean {
  return RIVALRY_KEYS.has(key(a, b));
}

/**
 * Quarterbacks whose presence alone makes a game worth watching.
 *
 * This was a list of three TEAMS — BUF, KC, LAR — which is a claim about a
 * player stored against the wrong thing: trade one of them, or bench him, and
 * the bonus silently stayed with the club. Now it is keyed by ESPN athlete id
 * (star-quarterbacks.json) and checked against the player actually starting.
 *
 * The criterion is an AP MVP award rather than a ranking of who is "elite",
 * because an award can be checked and a ranking can't — and the reason
 * sentence says "a former MVP", which is exactly what the list guarantees.
 */
const STAR_QB_IDS = new Set(starQuarterbacks.players.map((p) => p.id));

export function isStarQb(athleteId: string): boolean {
  return STAR_QB_IDS.has(athleteId);
}

/** A ruling that means he will not, or almost certainly will not, play. */
const RULED_OUT = new Set(["out", "doubtful", "injured reserve"]);

/**
 * Is a former MVP starting at quarterback for this team this week?
 *
 * Starter from the depth chart; ruled out if the week's injury report has him
 * out or doubtful — the depth chart can still list an injured starter first.
 * Lookups are parameters so the rule can be tested on fixed inputs.
 */
export function hasStarQb(
  teamId: string,
  lookup: {
    starter?: (teamId: string) => { id: string; name: string } | null;
    injuries?: (teamId: string) => { player: string; status: string }[];
  } = {},
): boolean {
  const { starter = startingQb, injuries = injuriesFor } = lookup;
  const qb = starter(team(teamId)?.id ?? teamId);
  if (!qb || !isStarQb(qb.id)) return false;
  return !injuries(team(teamId)?.id ?? teamId).some(
    (i) => i.player === qb.name && RULED_OUT.has(i.status.toLowerCase()),
  );
}

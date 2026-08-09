/**
 * The two §8 factors no API provides: rivalries, and which quarterbacks are
 * worth crossing the room for.
 *
 * Hand-kept on purpose. Both are judgements, not data, and pretending
 * otherwise by scraping something would make them look more authoritative than
 * they are.
 */

/**
 * Rivalries — pairs that carry weight beyond the standings.
 *
 * Divisional games already score on their own, so the ones that earn their keep
 * here are the cross-division grudges, Bills–Chiefs above all: it's the defining
 * matchup of Buffalo's last decade and it isn't divisional, so nothing else in
 * the scoring would catch it.
 */
const RIVALRIES: [string, string][] = [
  // The modern ones, none of them divisional
  ["BUF", "KC"],
  ["KC", "CIN"],
  ["SF", "DAL"],
  // Long-standing, divisional as well — they get both bumps, correctly
  ["GB", "CHI"],
  ["GB", "MIN"],
  ["PIT", "BAL"],
  ["PIT", "CLE"],
  ["PIT", "CIN"],
  ["DAL", "PHI"],
  ["DAL", "WSH"],
  ["DAL", "NYG"],
  ["NYG", "PHI"],
  ["KC", "LV"],
  ["KC", "DEN"],
  ["DEN", "LV"],
  ["SF", "SEA"],
  ["SF", "LAR"],
  ["SEA", "LAR"],
  ["NO", "ATL"],
  ["NO", "TB"],
  ["TB", "CAR"],
  ["IND", "TEN"],
  ["HOU", "IND"],
  ["BUF", "MIA"],
  ["BUF", "NE"],
  ["BUF", "NYJ"],
  ["NE", "NYJ"],
  ["MIA", "NYJ"],
  ["CHI", "DET"],
  ["DET", "MIN"],
  ["BAL", "CIN"],
  ["BAL", "CLE"],
  ["CLE", "CIN"],
  ["JAX", "TEN"],
  ["JAX", "HOU"],
  ["LAC", "KC"],
  ["ARI", "SEA"],
  ["CAR", "ATL"],
];

const RIVALRY_KEYS = new Set(
  RIVALRIES.map(([a, b]) => [a, b].sort().join("|")),
);

export function isRivalry(a: string, b: string): boolean {
  return RIVALRY_KEYS.has([a, b].sort().join("|"));
}

/**
 * Quarterbacks whose presence alone makes a game worth watching.
 *
 * Deliberately short. Every name here was checked against 2026 reporting —
 * Allen, Mahomes and Stafford were the consensus top three going into the
 * season, Stafford as reigning MVP. Others widely assumed to belong could not
 * be confirmed as starters for their teams, and a list that under-fires costs
 * a game one point, while a list that invents a starter is the confident
 * wrongness this whole product exists to avoid.
 *
 * The player name is stored so this stays auditable, but it is never rendered:
 * the reason sentence says "two of the best quarterbacks in the league", never
 * a name. A stale entry therefore skews a score slightly and states nothing
 * false about a person.
 *
 * Extend it as more get confirmed.
 */
const STAR_QB_TEAMS: Record<string, string> = {
  BUF: "Josh Allen",
  KC: "Patrick Mahomes",
  LAR: "Matthew Stafford",
};

export function hasStarQb(teamId: string): boolean {
  return teamId in STAR_QB_TEAMS;
}

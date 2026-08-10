import type { Team, TeamId } from "./types";

/**
 * All 32 teams. Names, cities, conferences and divisions are stable facts and
 * are safe to hard-code — the divisions haven't changed since 2002.
 *
 * Write-ups are NOT here — they live in content/teams/*.mdx per §5, so that
 * glossary terms inside them get auto-linked (§6a) and the flag queue can name
 * the file to edit. This module is only the roster of who exists and where.
 */

type Seed = [TeamId, string, string, Team["conference"], Team["division"]];

const SEEDS: Seed[] = [
  ["BUF", "Buffalo", "Bills", "AFC", "East"],
  ["MIA", "Miami", "Dolphins", "AFC", "East"],
  ["NE", "New England", "Patriots", "AFC", "East"],
  ["NYJ", "New York", "Jets", "AFC", "East"],
  ["BAL", "Baltimore", "Ravens", "AFC", "North"],
  ["CIN", "Cincinnati", "Bengals", "AFC", "North"],
  ["CLE", "Cleveland", "Browns", "AFC", "North"],
  ["PIT", "Pittsburgh", "Steelers", "AFC", "North"],
  ["HOU", "Houston", "Texans", "AFC", "South"],
  ["IND", "Indianapolis", "Colts", "AFC", "South"],
  ["JAX", "Jacksonville", "Jaguars", "AFC", "South"],
  ["TEN", "Tennessee", "Titans", "AFC", "South"],
  ["DEN", "Denver", "Broncos", "AFC", "West"],
  ["KC", "Kansas City", "Chiefs", "AFC", "West"],
  ["LV", "Las Vegas", "Raiders", "AFC", "West"],
  ["LAC", "Los Angeles", "Chargers", "AFC", "West"],
  ["DAL", "Dallas", "Cowboys", "NFC", "East"],
  ["NYG", "New York", "Giants", "NFC", "East"],
  ["PHI", "Philadelphia", "Eagles", "NFC", "East"],
  ["WAS", "Washington", "Commanders", "NFC", "East"],
  ["CHI", "Chicago", "Bears", "NFC", "North"],
  ["DET", "Detroit", "Lions", "NFC", "North"],
  ["GB", "Green Bay", "Packers", "NFC", "North"],
  ["MIN", "Minnesota", "Vikings", "NFC", "North"],
  ["ATL", "Atlanta", "Falcons", "NFC", "South"],
  ["CAR", "Carolina", "Panthers", "NFC", "South"],
  ["NO", "New Orleans", "Saints", "NFC", "South"],
  ["TB", "Tampa Bay", "Buccaneers", "NFC", "South"],
  ["ARI", "Arizona", "Cardinals", "NFC", "West"],
  ["LAR", "Los Angeles", "Rams", "NFC", "West"],
  ["SF", "San Francisco", "49ers", "NFC", "West"],
  ["SEA", "Seattle", "Seahawks", "NFC", "West"],
];

export const TEAMS: Team[] = SEEDS.map(([id, city, name, conference, division]) => ({
  id,
  slug: `${city} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  city,
  name,
  conference,
  division,
}));

export const TEAMS_BY_ID = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
) as Record<TeamId, Team>;

export function getTeam(slug: string): Team | undefined {
  return TEAMS.find((t) => t.slug === slug);
}

/** Short label for dense rows — "Bills", not "Buffalo Bills". */
export function shortName(id: TeamId): string {
  return TEAMS_BY_ID[id].name;
}

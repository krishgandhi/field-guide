import type { Team, TeamId } from "./types";

/**
 * All 32 teams. Names, cities, conferences and divisions are stable facts and
 * are safe to hard-code — the divisions haven't changed since 2002.
 *
 * `blurb`, `quarterback` and `oneThingToKnow` are left EMPTY for every team
 * except Buffalo. That is deliberate, not laziness: inventing a plausible
 * quarterback or team identity for 31 teams would put confident-sounding
 * fiction on screen, which is the exact failure CLAUDE.md §1 and §3 exist to
 * prevent. Empty renders as "not written yet", which shows the shape and
 * doubles as a visible content backlog.
 *
 * Buffalo's copy is written from facts verified against sources this session.
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

/** Only entries here get real copy. Everything else renders as unwritten. */
const WRITTEN: Partial<Record<TeamId, Pick<Team, "blurb" | "quarterback" | "oneThingToKnow">>> = {
  BUF: {
    quarterback: "Josh Allen",
    blurb:
      "Perennially good, perennially short of the ending they want. Josh Allen is the whole offence — he throws it and he runs it, and the team goes as far as he carries them. New voice in charge this year after a long run under the same coach, and the books are tight enough that roster moves are forced rather than chosen.",
    oneThingToKnow:
      "Sean McDermott was fired after nine seasons and Joe Brady moved up from offensive coordinator — the first real change at the top in a decade.",
  },
};

export const TEAMS: Team[] = SEEDS.map(([id, city, name, conference, division]) => ({
  id,
  slug: `${city} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  city,
  name,
  conference,
  division,
  blurb: WRITTEN[id]?.blurb ?? "",
  quarterback: WRITTEN[id]?.quarterback ?? "",
  oneThingToKnow: WRITTEN[id]?.oneThingToKnow ?? "",
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

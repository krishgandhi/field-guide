import data from "./nfl-teams.json";

/**
 * The 32 teams — the one team registry (§13: normalise once, in one place).
 *
 * Identity, logos and colours come from a JSON file committed to the repo by
 * `npm run fetch:teams`; conference and division are added here because
 * ESPN's teams endpoint doesn't carry them. Ids are ESPN's abbreviations
 * (WSH, not WAS), since every live data source in this project is ESPN.
 *
 * Never fetched at request time — CLAUDE.md §4. If ESPN changes or breaks,
 * this file keeps working and we re-run the script when convenient.
 */

export type Conference = "AFC" | "NFC";
export type DivisionName = "East" | "North" | "South" | "West";

/** One team as `npm run fetch:teams` writes it. */
type FetchedTeam = {
  id: string;
  /**
   * ESPN's numeric id, for `news?team=<id>` — the only feed that returns
   * team-specific stories. The per-game summary endpoint looks like it should
   * work and doesn't: it serves the same generic league-wide article list for
   * every event.
   */
  espnId: string;
  slug: string;
  location: string;
  name: string;
  displayName: string;
  /** The true official colour. Kept for reference; usually unusable on dark. */
  brandColor: string;
  /** Contrast-corrected against the page background. Render THIS one. */
  displayColor: string;
  logo: string;
};

export type NflTeam = FetchedTeam & {
  conference: Conference;
  division: DivisionName;
};

/**
 * Division membership. Hard-coded because it is a stable fact — the alignment
 * hasn't changed since 2002 — and because ESPN's teams endpoint doesn't carry
 * it. Listed in the order the teams page shows them.
 */
const ALIGNMENT: Record<Conference, Record<DivisionName, string[]>> = {
  AFC: {
    East: ["BUF", "MIA", "NE", "NYJ"],
    North: ["BAL", "CIN", "CLE", "PIT"],
    South: ["HOU", "IND", "JAX", "TEN"],
    West: ["DEN", "KC", "LV", "LAC"],
  },
  NFC: {
    East: ["DAL", "NYG", "PHI", "WSH"],
    North: ["CHI", "DET", "GB", "MIN"],
    South: ["ATL", "CAR", "NO", "TB"],
    West: ["ARI", "LAR", "SF", "SEA"],
  },
};

const PLACE = new Map<string, { conference: Conference; division: DivisionName }>();
for (const [conference, divisions] of Object.entries(ALIGNMENT) as [Conference, Record<DivisionName, string[]>][]) {
  for (const [division, ids] of Object.entries(divisions) as [DivisionName, string[]][]) {
    for (const id of ids) PLACE.set(id, { conference, division });
  }
}

export const NFL_TEAMS: NflTeam[] = (data as FetchedTeam[]).map((t) => {
  const place = PLACE.get(t.id);
  if (!place) throw new Error(`nfl-teams.json has ${t.id}, which is in no division`);
  return { ...t, ...place };
});

const BY_ID = new Map(NFL_TEAMS.map((t) => [t.id, t]));
const BY_SLUG = new Map(NFL_TEAMS.map((t) => [t.slug, t]));

/**
 * Other spellings of a team id, mapped to ESPN's. Hand-typed ids (notes,
 * move frontmatter) are where these come from: written as `WAS`, ESPN says
 * `WSH`, and the lookup silently missed — three separate times.
 */
const ALIASES: Record<string, string> = {
  WAS: "WSH",
};

/** The canonical id for any spelling we know; unknown ids pass through unchanged. */
export function teamId(id: string): string {
  const upper = id.toUpperCase();
  return ALIASES[upper] ?? upper;
}

export function team(id: string): NflTeam | undefined {
  return BY_ID.get(teamId(id));
}

export function teamBySlug(slug: string): NflTeam | undefined {
  return BY_SLUG.get(slug);
}

/** The four teams in a division, in display order. */
export function teamsInDivision(conference: Conference, division: DivisionName): NflTeam[] {
  return ALIGNMENT[conference][division].map((id) => BY_ID.get(id)).filter((t) => t !== undefined);
}

/** Falls back to the id so a missing team degrades to "BUF", never to a crash. */
export function teamName(id: string): string {
  return team(id)?.name ?? id;
}

export function teamLogo(id: string): string | undefined {
  return team(id)?.logo;
}

export function teamColor(id: string): string {
  return team(id)?.displayColor ?? "#98A29E";
}

/** "AFC East", or null for an unknown id. */
export function division(id: string): string | null {
  const t = team(id);
  return t ? `${t.conference} ${t.division}` : null;
}

/** True when both teams share a division — they meet twice a year and it decides seeding. */
export function isDivisional(a: string, b: string): boolean {
  const da = division(a);
  return da !== null && da === division(b);
}

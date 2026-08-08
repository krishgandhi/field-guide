import data from "./nfl-teams.json";

/**
 * The 32 teams, with logos and colours, read from a JSON file committed to the
 * repo by `npm run fetch:teams`.
 *
 * Never fetched at request time — CLAUDE.md §4. If ESPN changes or breaks,
 * this file keeps working and we re-run the script when convenient.
 */

export type NflTeam = {
  id: string;
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

export const NFL_TEAMS = data as NflTeam[];

const BY_ID = new Map(NFL_TEAMS.map((t) => [t.id, t]));

/**
 * ESPN uses WSH and LAR where our mock data uses WAS and LA-style codes.
 * §13 warns that abbreviations differ between sources and says to normalise
 * once, in one place. This is that place.
 */
const ALIASES: Record<string, string> = {
  WAS: "WSH",
};

export function team(id: string): NflTeam | undefined {
  return BY_ID.get(ALIASES[id] ?? id);
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

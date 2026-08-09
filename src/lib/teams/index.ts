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

/**
 * Division membership. Hard-coded because it is a stable fact — the alignment
 * hasn't changed since 2002 — and because ESPN's teams endpoint doesn't carry
 * it. Lives here rather than in a screen so there is one answer to "who is in
 * whose division", per §13.
 */
const DIVISIONS: Record<string, string> = {
  BUF: "AFC East", MIA: "AFC East", NE: "AFC East", NYJ: "AFC East",
  BAL: "AFC North", CIN: "AFC North", CLE: "AFC North", PIT: "AFC North",
  HOU: "AFC South", IND: "AFC South", JAX: "AFC South", TEN: "AFC South",
  DEN: "AFC West", KC: "AFC West", LV: "AFC West", LAC: "AFC West",
  DAL: "NFC East", NYG: "NFC East", PHI: "NFC East", WSH: "NFC East",
  CHI: "NFC North", DET: "NFC North", GB: "NFC North", MIN: "NFC North",
  ATL: "NFC South", CAR: "NFC South", NO: "NFC South", TB: "NFC South",
  ARI: "NFC West", LAR: "NFC West", SF: "NFC West", SEA: "NFC West",
};

export function division(id: string): string | null {
  return DIVISIONS[ALIASES[id] ?? id] ?? null;
}

/** True when both teams share a division — they meet twice a year and it decides seeding. */
export function isDivisional(a: string, b: string): boolean {
  const da = division(a);
  return da !== null && da === division(b);
}

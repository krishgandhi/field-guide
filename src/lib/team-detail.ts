import data from "@/data/team-detail.json";
import { prose, unitSubject } from "@/lib/prose";

/**
 * Depth chart, coach and unit ratings, read from the cron's cache.
 *
 * Forgiving like the people cache and unlike the slate loader: a team missing
 * here means one section doesn't render, which is a gap. It must never fail a
 * build.
 */

export type UnitKey = "offence" | "defence" | "specialTeams";

export type UnitPlayer = {
  id: string;
  name: string;
  /** The player's own listed position — DT, CB, K. */
  label: string;
};

export type Unit = {
  players: UnitPlayer[];
  /** 1–32 in the league, or null before the season has data. */
  rank: number | null;
  /** 1–5, the same shape as every other rating on the site. */
  score: number | null;
  /** Deterministic, pairs with the meter, always true. */
  note: string;
  /**
   * What KIND of unit this is — written from evidence by write-unit-notes.mjs
   * and stored in the prose cache, not in team-detail.json. Null until written.
   */
  blurb: string | null;
};

export type TeamDetail = {
  coach: { name: string; experience: number | null } | null;
  statsSeason: number;
  previousSeason: boolean;
  units: Record<UnitKey, Unit>;
};

/** As stored: facts only. The blurb is joined in from the prose cache below. */
type StoredDetail = Omit<TeamDetail, "units"> & { units: Record<UnitKey, Omit<Unit, "blurb">> };

const TEAMS = (data as unknown as { teams?: Record<string, StoredDetail> }).teams ?? {};

export const UNIT_ORDER: UnitKey[] = ["offence", "defence", "specialTeams"];

export const UNIT_LABEL: Record<UnitKey, string> = {
  offence: "Offence",
  defence: "Defence",
  specialTeams: "Special teams",
};

export function detailFor(teamId: string): TeamDetail | null {
  const detail = TEAMS[teamId];
  if (!detail) return null;
  // The facts come from the fetch, the sentence from the prose cache.
  const units = Object.fromEntries(
    UNIT_ORDER.map((key) => [
      key,
      { ...detail.units[key], blurb: prose("units", unitSubject(teamId, key)) },
    ]),
  ) as Record<UnitKey, Unit>;
  return { ...detail, units };
}

/**
 * "First season as head coach" reads better than "experience: 0", and it's the
 * fact a newcomer can actually use — a rookie coach means nobody knows what
 * this team is yet.
 */
export function coachTenure(experience: number | null): string | null {
  if (experience === null) return null;
  if (experience === 0) return "First season as a head coach";
  if (experience === 1) return "Second season as a head coach";
  return `${experience} seasons as a head coach`;
}

/**
 * The quarterback at the top of ESPN's depth chart, or null.
 *
 * Read from the facts as stored, not the joined detail, because nothing here
 * needs prose. The depth chart can lag an injury by a day or two; callers that
 * care check the week's injury report as well (see hasStarQb).
 */
export function startingQb(teamId: string): UnitPlayer | null {
  return TEAMS[teamId]?.units.offence.players.find((p) => p.label === "QB") ?? null;
}

import { z } from "zod";
import raw from "@/data/standings.json";
import { division, team } from "@/lib/teams";

/**
 * Every team's record, from the JSON the daily job commits.
 *
 * Never fetched at request time (§4). Validated on import for the same reason
 * the slate is: a silent shape change at an undocumented endpoint should fail
 * the build naming the field, not render nonsense.
 */

const recordSchema = z.object({
  wins: z.number(),
  losses: z.number(),
  ties: z.number(),
  pointDifferential: z.number().nullable(),
  /** Rank within the conference, 1–16. Not a playoff seed — see the fetch script. */
  conferenceRank: z.number(),
});

const standingsSchema = z.strictObject({
  season: z.number(),
  /** True when the current season hasn't started and these are last year's finals. */
  isPreviousSeason: z.boolean(),
  fetchedAt: z.string(),
  teams: z.record(z.string(), recordSchema),
});

export type TeamRecord = z.infer<typeof recordSchema>;

const parsed = standingsSchema.safeParse(raw);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid src/data/standings.json\n${detail}`);
}

export const STANDINGS = parsed.data;

export function recordFor(teamId: string): TeamRecord | undefined {
  return STANDINGS.teams[team(teamId)?.id ?? teamId];
}

/** "12-5", or "12-5-1" when there's a tie to report. */
export function recordLabel(r: TeamRecord): string {
  return r.ties > 0 ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`;
}

/** Seven per conference qualify. */
export function madePlayoffs(r: TeamRecord): boolean {
  return r.conferenceRank >= 1 && r.conferenceRank <= 7;
}

/**
 * How they finished, in words a newcomer can use.
 *
 * "6th in the AFC" means nothing on its own; whether that got them into the
 * playoffs is the part worth saying out loud.
 */
export function finishLabel(teamId: string): string | null {
  const r = recordFor(teamId);
  if (!r) return null;
  // division() returns "AFC East"; the conference is the first word.
  const conference = division(teamId)?.split(" ")[0];
  const where = conference ? ` in the ${conference}` : "";
  return madePlayoffs(r)
    ? `Made the playoffs, ${ordinal(r.conferenceRank)}${where}`
    : `Missed the playoffs, ${ordinal(r.conferenceRank)}${where}`;
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

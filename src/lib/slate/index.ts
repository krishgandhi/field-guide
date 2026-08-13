import { z } from "zod";
import raw from "@/data/slate.json";

/**
 * The week's real games, read from the JSON that GitHub Actions commits.
 *
 * Never fetched at request time (§4). If ESPN breaks, the last good file stays
 * committed and the site serves slightly stale data rather than an error.
 *
 * Validated on import for the same reason the content pipeline is: a silent
 * shape change at an undocumented endpoint (§9 warns about exactly this) should
 * fail the build with a message naming the field, not render a broken page.
 */

const gameSchema = z.object({
  id: z.string(),
  kickoff: z.string(),
  home: z.string(),
  away: z.string(),
  /** Absolute margin. Null when no line has been posted yet. */
  spread: z.number().nullable(),
  favourite: z.enum(["home", "away"]).nullable(),
  overUnder: z.number().nullable(),
  broadcast: z.string().nullable(),
  venue: z.string().nullable(),
  neutralSite: z.boolean(),
  /**
   * Claude-written "why watch this", generated once by the daily job and
   * cached here (§13). Absent when the model wasn't run or its sentence failed
   * validation — the deterministic template covers that game instead.
   */
  reason: z.string().optional(),
});

const injurySchema = z.object({
  player: z.string(),
  position: z.string(),
  status: z.string(),
});

const slateSchema = z.strictObject({
  season: z.number(),
  week: z.number().min(1).max(18),
  fetchedAt: z.string(),
  /**
   * When write-reasons.mjs last wrote the per-game prose. Optional because the
   * slate is fetched first and the reasons step is allowed to fail.
   *
   * This key broke the build the first time that step ever succeeded: with no
   * API key it had always exited early, so the strict schema had never seen
   * the field it writes. Strictness caught it, which is the point — but the
   * lesson is that a `continue-on-error` step which never runs is a step whose
   * output is never validated.
   */
  reasonsWrittenAt: z.string().optional(),
  games: z.array(gameSchema),
  byes: z.array(z.string()),
  injuries: z.record(z.string(), z.array(injurySchema)),
});

export type Game = z.infer<typeof gameSchema>;
export type Injury = z.infer<typeof injurySchema>;
export type Slate = z.infer<typeof slateSchema>;

const parsed = slateSchema.safeParse(raw);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid src/data/slate.json\n${detail}`);
}

export const SLATE: Slate = parsed.data;

export function injuriesFor(teamId: string): Injury[] {
  return SLATE.injuries[teamId] ?? [];
}

/** Days since the data was pulled — drives the staleness warning. */
export function daysStale(now: number = Date.now()): number {
  return Math.floor((now - Date.parse(SLATE.fetchedAt)) / 86_400_000);
}

import { z } from "zod";
import raw from "@/data/slate.json";
import { prose } from "@/lib/prose";
import { lastRun } from "@/lib/meta";

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
   * Claude-written "why watch this". Never in slate.json: it is joined in
   * below from the prose cache (src/lib/prose.ts), because fetch-slate
   * rebuilds this file from scratch daily. Absent when the model wasn't run or
   * its sentence failed validation — the template covers that game instead.
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
  games: z.array(gameSchema),
  byes: z.array(z.string()),
  injuries: z.record(z.string(), z.array(injurySchema)),
});

export type Game = z.infer<typeof gameSchema>;
export type Injury = z.infer<typeof injurySchema>;
/**
 * fetchedAt comes from src/data/meta.json, not slate.json: a timestamp inside
 * the data made every daily run a commit and a production build.
 */
export type Slate = z.infer<typeof slateSchema> & { fetchedAt: string };

const parsed = slateSchema.safeParse(raw);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid src/data/slate.json\n${detail}`);
}

export const SLATE: Slate = {
  ...parsed.data,
  // Epoch when there is no stamp, so the stale warning shows rather than hides.
  fetchedAt: lastRun("slate") ?? new Date(0).toISOString(),
  games: parsed.data.games.map((game) => {
    const reason = prose("reasons", game.id);
    return reason ? { ...game, reason } : game;
  }),
};

export function injuriesFor(teamId: string): Injury[] {
  return SLATE.injuries[teamId] ?? [];
}

/** Days since the data was pulled — drives the staleness warning. */
export function daysStale(now: number = Date.now()): number {
  return Math.floor((now - Date.parse(SLATE.fetchedAt)) / 86_400_000);
}

/**
 * Should the data workflow commit, and why?
 *
 * Every commit to main is a production build. The fetchers used to stamp a
 * time into each data file, so every run committed: one or two builds a day
 * whether or not anything had changed. Timestamps now live in
 * src/data/meta.json alone, which makes "only the clock moved" detectable:
 *
 *   content   — something besides meta.json changed. Commit everything.
 *   heartbeat — only meta.json changed, but the committed stamp is older than
 *               HEARTBEAT_HOURS. Commit it alone, so the site's "updated"
 *               line and its stale-data warning (which fires past three days)
 *               stay true through a quiet week rather than claiming the job
 *               has stopped running. At most one build every two days.
 *   none      — only the clock moved, and recently. Don't commit.
 */

export const META_FILE = "src/data/meta.json";
export const HEARTBEAT_HOURS = 48;

export type Decision = "content" | "heartbeat" | "none";

/** Paths from `git status --porcelain`, e.g. " M src/data/slate.json" or "?? content/moves/x.mdx". */
export function changedPaths(porcelain: string): string[] {
  return porcelain
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.slice(3).trim().replace(/^"|"$/g, ""));
}

export function decide(
  changed: string[],
  committedMeta: Record<string, string>,
  now: Date = new Date(),
): Decision {
  if (changed.some((p) => p !== META_FILE)) return "content";
  if (!changed.includes(META_FILE)) return "none";
  const stamps = Object.values(committedMeta)
    .map((v) => Date.parse(v))
    .filter((t) => Number.isFinite(t));
  // The OLDEST committed stamp: if any fetcher's date is about to look stale,
  // refresh them all.
  const oldest = stamps.length ? Math.min(...stamps) : 0;
  return now.getTime() - oldest >= HEARTBEAT_HOURS * 3_600_000 ? "heartbeat" : "none";
}

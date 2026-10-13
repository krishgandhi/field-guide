import data from "@/data/meta.json";

/**
 * When each daily fetch last ran, from src/data/meta.json.
 *
 * Kept out of the data files so a run where nothing changed doesn't commit
 * (see scripts/lib/meta.mts). The workflow still commits this file on its own
 * every couple of days, so "updated" and the stale-data warning stay true.
 */

export type MetaKey = "slate" | "standings" | "teamDetail" | "people" | "moveCandidates";

const META = data as Partial<Record<MetaKey, string>>;

/** ISO timestamp of the last successful run, or null if there has never been one. */
export function lastRun(key: MetaKey): string | null {
  return META[key] ?? null;
}

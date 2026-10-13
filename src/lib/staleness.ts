/**
 * How old the daily data is, and whether to say so.
 *
 * Kept free of imports so a client component can use it without pulling
 * slate.json into the browser bundle.
 */

/** Past this many days, the page says the daily update hasn't run. */
export const STALE_AFTER_DAYS = 3;

/** Whole days between a fetch timestamp and `now`. */
export function daysStale(fetchedAt: string, now: number = Date.now()): number {
  const at = Date.parse(fetchedAt);
  // An unreadable stamp is treated as ancient, so the warning shows rather than hides.
  if (Number.isNaN(at)) return Number.POSITIVE_INFINITY;
  return Math.floor((now - at) / 86_400_000);
}

export function isStale(fetchedAt: string, now: number = Date.now()): boolean {
  return daysStale(fetchedAt, now) > STALE_AFTER_DAYS;
}

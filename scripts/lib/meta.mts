/**
 * When each fetcher last ran, in one file: src/data/meta.json.
 *
 * The timestamps used to sit inside the data files themselves (slate.json's
 * fetchedAt, move-candidates.json's generatedAt, …). A timestamp changes on
 * every run, so every run changed five files, the workflow always had
 * something to commit, and every commit triggered a production build —
 * one or two a day whether or not a single fact had moved.
 *
 * Kept apart, the workflow can tell "only the clock moved" from "the data
 * moved" by asking whether anything outside this file changed
 * (scripts/lib/commit-decision.mts). Pages read it through src/lib/meta.ts.
 *
 * Node builtins only, so fetchers can still run before `npm ci`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const META_PATH = "src/data/meta.json";

/** Which run a stamp belongs to. */
export type MetaKey = "slate" | "standings" | "teamDetail" | "people" | "moveCandidates";

export type Meta = Partial<Record<MetaKey, string>>;

export function readMeta(file: string = META_PATH): Meta {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Did this run actually refresh everything it should have — every item
 * written, none of them yesterday's copy kept after a failed fetch?
 *
 * Only then may it stamp. fetch-team-detail used to stamp whenever all 32
 * teams were in the file, including when all 32 had been carried over from
 * yesterday because ESPN was down: the site then claimed fresh data that
 * was a day old, and kept claiming it for as long as the outage lasted. A
 * stamp that stops moving is how the job summary spots a dead fetcher.
 */
export function freshRun({ expected, written, carriedOver }: { expected: number; written: number; carriedOver: number }): boolean {
  return written === expected && carriedOver === 0;
}

/** Record that `key` just ran successfully. Call only after its data is written. */
export function stamp(key: MetaKey, at: Date = new Date(), file: string = META_PATH): void {
  const meta = { ...readMeta(file), [key]: at.toISOString() };
  const sorted = Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * The one store for Claude-written prose: game reasons, unit notes, profile
 * lines. src/data/prose-cache.json, one section per kind.
 *
 * Why it exists. Each kind used to live inside the fetched data it describes
 * (slate.json, team-detail.json, people.json), so the fetchers had to carry it
 * forward — and they didn't, reliably. fetch-slate rebuilt slate.json from
 * scratch and wiped every game reason daily; fetch-people dropped a profile
 * line the moment its evidence hash moved, before any replacement existed,
 * which is how 17 of 18 lines became 3. Prose now lives apart from the data:
 * fetchers never touch it, writers own it, pages read it through one accessor
 * (src/lib/prose.ts).
 *
 * One file rather than one per kind: there is one accessor, one place to look
 * when a sentence is wrong, and the writers run one after another in the same
 * job, so they never contend for it.
 *
 * Keying. Every entry stores the key it was written for: a hash of the prompt
 * version plus the COARSE inputs — spread bucket, rank tiers, article ids —
 * that the model was shown. The model sees exactly what is hashed, nothing
 * finer, so nothing it could quote can drift without the key moving too. A
 * key that matches is a hit and costs nothing; that is what stops every game
 * day rewriting all 96 unit notes because a rank moved from 11th to 12th.
 *
 * Replacement. Old text is replaced only once new text validates. Until then
 * the old line stays — but only while it passes a stricter check against the
 * CURRENT evidence (every person it names still there, no former club named
 * without the current one), so a note naming a player who has left the depth
 * chart goes (§9: a missing entry, never a wrong one).
 *
 * Node builtins only.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const PROSE_PATH = "src/data/prose-cache.json";

export const PROSE_KINDS = ["reasons", "units", "profiles"] as const;
export type ProseKind = (typeof PROSE_KINDS)[number];

export type ProseEntry = {
  /** The sentence(s) pages show. */
  text: string;
  /** The inputs it was written for; null for lines migrated from the old layout. */
  key: string | null;
  /**
   * A key whose fresh attempt failed validation. Not retried until the
   * inputs or the prompt change, so a brief the model can't satisfy costs one
   * call, not one a day.
   */
  rejectedKey?: string;
  /**
   * How many times `rejectedKey` has been tried. Only matters when nothing is
   * showing: a subject with no line is retried up to MAX_ATTEMPTS times per
   * key, so one bad reply can't leave a blank for as long as the inputs hold.
   */
  attempts?: number;
};

/** Tries per key for a subject that has no line to show. */
export const MAX_ATTEMPTS = 3;

export type ProseSection = Record<string, ProseEntry>;
export type ProseCache = Record<ProseKind, ProseSection>;

/** JSON with object keys sorted, so the same inputs always hash the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** The cache key for one subject: prompt version plus coarse inputs. */
export function proseKey(promptVersion: number, inputs: unknown): string {
  return createHash("sha256")
    .update(stableStringify({ promptVersion, inputs }))
    .digest("hex")
    .slice(0, 16);
}

export function emptyCache(): ProseCache {
  return { reasons: {}, units: {}, profiles: {} };
}

export function readCache(file: string = PROSE_PATH): ProseCache {
  if (!existsSync(file)) return emptyCache();
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const cache = emptyCache();
  for (const kind of PROSE_KINDS) cache[kind] = raw?.[kind] ?? {};
  return cache;
}

/** Subjects sorted, so a run that changes one line produces a one-line diff. */
export function writeCache(cache: ProseCache, file: string = PROSE_PATH): void {
  const sorted = Object.fromEntries(
    PROSE_KINDS.map((kind) => [
      kind,
      Object.fromEntries(Object.entries(cache[kind]).sort(([a], [b]) => a.localeCompare(b))),
    ]),
  );
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}

/** One subject a writer wants a line for, with the key of its current inputs. */
export type Wanted = { subject: string; key: string };

/**
 * Which subjects need the model: no entry, or an entry written for different
 * inputs — unless this exact key has already been tried and rejected.
 *
 * A rejection is final for the key only while an older line is still up. A
 * subject showing nothing gets MAX_ATTEMPTS tries, so a dropped line isn't
 * left blank until the inputs happen to move.
 */
export function needsWriting<T extends Wanted>(section: ProseSection, wanted: T[]): T[] {
  return wanted.filter(({ subject, key }) => {
    const entry = section[subject];
    if (entry?.key === key) return false;
    if (entry?.rejectedKey === key) {
      if (entry.text) return false;
      return (entry.attempts ?? 1) < MAX_ATTEMPTS;
    }
    return true;
  });
}

export type SettleLog = {
  written: string[];
  rejected: string[];
  /** Out-of-date lines left in place because they still validate. */
  keptStale: string[];
  /** Out-of-date lines removed because they no longer validate. */
  dropped: string[];
  /** Subjects no longer wanted at all — last week's games, departed people. */
  pruned: string[];
};

/**
 * Apply one run's results to a section, returning the new section.
 *
 * `results` holds what the model returned this run (absent subjects simply
 * weren't asked, or got no answer). `validate` returns a problem or null for
 * new text. `validateStale` decides whether an out-of-date line may stay up
 * until it is replaced; it defaults to `validate`, but a writer should pass
 * something stricter. The ordinary validators check figures and wording, not
 * who or which club a line names — so a note naming last year's starter
 * passes them against this year's depth chart.
 */
export function settle(
  section: ProseSection,
  wanted: Wanted[],
  results: Map<string, string>,
  validate: (text: string, subject: string) => string | null,
  validateStale: (text: string, subject: string) => string | null = validate,
): { section: ProseSection; log: SettleLog } {
  const next: ProseSection = {};
  const log: SettleLog = { written: [], rejected: [], keptStale: [], dropped: [], pruned: [] };
  const wantedSubjects = new Set(wanted.map((w) => w.subject));

  for (const subject of Object.keys(section)) {
    if (!wantedSubjects.has(subject)) log.pruned.push(subject);
  }

  for (const { subject, key } of wanted) {
    const old = section[subject];
    if (old?.key === key) {
      next[subject] = old;
      continue;
    }

    let rejectedKey = old?.rejectedKey;
    let attempts = old?.rejectedKey === key ? (old.attempts ?? 1) : 0;
    const fresh = results.get(subject);
    if (fresh !== undefined) {
      const problem = validate(fresh.trim(), subject);
      if (!problem) {
        next[subject] = { text: fresh.trim(), key };
        log.written.push(subject);
        continue;
      }
      log.rejected.push(`${subject}: ${problem} — "${fresh.trim()}"`);
      rejectedKey = key;
      attempts += 1;
    }
    const rejection = rejectedKey === key ? { rejectedKey, attempts } : {};

    // No valid replacement this run. Keep the old line only if it is still
    // true of the current evidence — by the stricter test.
    if (old?.text) {
      const problem = validateStale(old.text, subject);
      if (!problem) {
        const { rejectedKey: _r, attempts: _a, ...line } = old;
        next[subject] = { ...line, ...rejection };
        log.keptStale.push(subject);
        continue;
      }
      // Removed, not kept: a missing line, never a wrong one (§9).
      log.dropped.push(`${subject}: ${problem}`);
    }
    // Remember a rejected key with no text, so needsWriting can count tries.
    if (rejectedKey === key) next[subject] = { text: "", key: null, ...rejection };
  }

  return { section: next, log };
}

export function printLog(label: string, log: SettleLog): void {
  console.log(
    `${label}: ${log.written.length} written, ${log.rejected.length} rejected, ` +
      `${log.keptStale.length} kept until replaced, ${log.dropped.length} dropped, ` +
      `${log.pruned.length} pruned`,
  );
  for (const r of log.rejected.slice(0, 15)) console.log(`  rejected — ${r}`);
  for (const d of log.dropped) console.log(`  dropped  — ${d}`);
}

/** Split into fixed-size batches. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

import data from "@/data/prose-cache.json";

/**
 * The one way pages read Claude-written prose.
 *
 * Written by the scripts/write-*.mjs jobs into src/data/prose-cache.json and
 * never generated at request time (§4, §13). Forgiving: a missing line means
 * the deterministic text shows instead, which is a gap, never an error.
 */

export type ProseKind = "reasons" | "units" | "profiles";

type Section = Record<string, { text?: string | null } | undefined>;

const CACHE = data as unknown as Partial<Record<ProseKind, Section>>;

/** The line for one subject, or null. Subjects: a game id, "BUF:offence", an athlete id. */
export function prose(kind: ProseKind, subject: string): string | null {
  const text = CACHE[kind]?.[subject]?.text;
  return text ? text : null;
}

/** Subject key for a unit note. Shared with scripts/write-unit-notes.mjs. */
export const unitSubject = (teamId: string, unit: string) => `${teamId}:${unit}`;

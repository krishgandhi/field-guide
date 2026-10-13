import data from "@/data/people.json";
import { prose } from "@/lib/prose";

/**
 * The people named in move entries, read from the cache the cron job writes.
 *
 * Entries store ESPN athlete ids and nothing else. A profile goes stale fast —
 * Terrion Arnold's team changed the same week his entry was written — so the
 * facts live in one refreshed file rather than baked into a dozen MDX files.
 *
 * Deliberately forgiving, unlike the slate loader: a missing or malformed
 * person means one card doesn't render, which is a cosmetic gap. It must never
 * fail a build the way bad slate data should.
 */

export type Person = {
  id: string;
  name: string | null;
  position: string | null;
  positionShort: string | null;
  team: string | null;
  teamId: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  experience: string | null;
  /** "2023: Rd 1, Pk 5 (SEA)" straight from ESPN. */
  draft: string | null;
  college: string | null;
  headshot: string | null;
  /** One plain-English line, written by write-profiles.mjs into the prose cache. */
  blurb: string | null;
};

const PEOPLE = (data as unknown as { people?: Record<string, Omit<Person, "blurb">> }).people ?? {};

/** Only people we actually have a name for — a nameless card says nothing. */
export function peopleByIds(ids: string[]): Person[] {
  return ids
    .map((id) => PEOPLE[id])
    .filter((p) => Boolean(p?.name))
    .map((p) => ({ ...p, blurb: prose("profiles", p.id) }));
}

/**
 * "2023: Rd 1, Pk 5 (SEA)" → "First-round pick, 2023".
 *
 * The raw string is ESPN's shorthand and means nothing to a newcomer, which is
 * the whole problem this site exists to fix.
 */
const ROUNDS = [
  "First", "Second", "Third", "Fourth",
  "Fifth", "Sixth", "Seventh",
];

/** 1 → 1st, 2 → 2nd, 11 → 11th, 21 → 21st. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function draftLabel(draft: string | null): string | null {
  if (!draft) return null;
  const year = draft.match(/^(\d{4})/)?.[1];
  const round = Number(draft.match(/Rd (\d+)/)?.[1]);
  const pick = Number(draft.match(/Pk (\d+)/)?.[1]);
  if (!year) return null;
  if (!round) return `Undrafted, ${year}`;
  const name = ROUNDS[round - 1] ?? `Round ${round}`;
  return pick
    ? `${name}-round pick, ${year} — ${ordinal(pick)} overall`
    : `${name}-round pick, ${year}`;
}

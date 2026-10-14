/**
 * Cache the people named in move entries, and bundle their headshots.
 *
 * A move entry names someone a newcomer has never heard of. This is what fills
 * the profile card: who they are, where they came from, what they play.
 *
 * Entries carry ESPN athlete ids and NOTHING else, because a profile goes
 * stale fast — Terrion Arnold's team changed the same week his entry was
 * written, so a baked-in "Detroit Lions" would have been wrong within days.
 * The facts live here, refreshed daily, and pages read the cache (§4, §13).
 *
 * Headshots are downloaded, never hotlinked, exactly as §10 requires of team
 * logos: it also means ESPN breaking never breaks the site. ESPN's combiner
 * resizes 600x436 / 283KB down to a real 160x160 / 28KB PNG, which is what
 * makes bundling them reasonable.
 *
 * Players only. ESPN publishes no coach or GM data — no /coaches endpoint and
 * nothing in the team payload — so a coaching entry carries no ids and simply
 * renders no card.
 *
 * Needs `npm ci` (gray-matter, to read move frontmatter) — unlike the other
 * fetchers, which are builtins only.
 *
 *   node scripts/fetch-people.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ATHLETES as ATHLETE, getBytes, getJson } from "./lib/espn.mts";
import { readMoves } from "./lib/moves.mts";
import { fetchEvidence as fetchEvidenceFrom, refreshPerson } from "./lib/people.mjs";
import { stamp } from "./lib/meta.mts";

const OUT = "src/data/people.json";
const SHOTS = "public/players";

/** The combiner resize; the raw file is ten times the size for no benefit. */
const HEADSHOT = (id) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=160&h=160`;

/** Every ESPN athlete id referenced by an entry's `move.people`. */
function referencedIds() {
  const ids = new Set();
  for (const { move } of readMoves()) {
    for (const id of move.people) if (/^\d+$/.test(id)) ids.add(id);
  }
  return [...ids];
}

async function fetchPerson(id) {
  const body = await getJson(`${ATHLETE}/${id}`);
  const a = body.athlete ?? body;
  return {
    id: String(a.id ?? id),
    name: a.displayName ?? a.fullName ?? null,
    position: a.position?.displayName ?? null,
    positionShort: a.position?.abbreviation ?? null,
    team: a.team?.displayName ?? null,
    teamId: a.team?.abbreviation ?? null,
    age: a.age ?? null,
    height: a.displayHeight ?? null,
    weight: a.displayWeight ?? null,
    experience: a.displayExperience ?? null,
    /** "2023: Rd 1, Pk 21 (LAC)" — exactly the "drafted in" line we want. */
    draft: a.displayDraft ?? null,
    college: a.college?.name ?? null,
  };
}

/**
 * Awards and career numbers — the evidence a profile line is allowed to
 * characterise from.
 *
 * Without this the line can only restate the draft position, which is a
 * database row rather than a translation. Josh Allen comes back with an MVP
 * and 4,721 career rushing yards, which is what turns "picked seventh overall"
 * into "one of the best, and he runs like a running back".
 *
 * ESPN only carries major honours here — Devon Witherspoon returns none
 * despite three Pro Bowls. That gap is filled from this site's own sourced
 * prose, in write-profiles.mjs.
 */
// It throws on a failed fetch, and the loop then keeps yesterday's record
// whole (scripts/lib/people.mjs says why).
const fetchEvidence = (id) => fetchEvidenceFrom(id, getJson, ATHLETE);

async function saveHeadshot(id) {
  const file = path.join(SHOTS, `${id}.png`);
  // Headshots don't change; re-downloading a dozen of them daily is waste.
  if (existsSync(file)) return "cached";
  const buf = await getBytes(HEADSHOT(id)).catch(() => null);
  if (!buf) return "missing";
  // Guard against ESPN handing back an error page with a 200.
  if (buf.length < 1000 || buf.subarray(1, 4).toString() !== "PNG") return "missing";
  writeFileSync(file, buf);
  return "downloaded";
}

const ids = referencedIds();
console.log(`${ids.length} people referenced by move entries.`);

mkdirSync(SHOTS, { recursive: true });
mkdirSync("src/data", { recursive: true });

// Facts only. The profile line lives in src/data/prose-cache.json and belongs
// to write-profiles.mjs. This script used to carry it here, and deleted it the
// moment the evidence moved — before any replacement existed — which took the
// site from 17 lines to 3. `existing` is read only so a failed fetch keeps
// yesterday's facts.
const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8")).people ?? {}
  : {};

const people = {};
let failed = 0;

for (const id of ids) {
  const { record, shot, error } = await refreshPerson(id, existing[id], {
    fetchPerson,
    fetchEvidence,
    saveHeadshot,
  });
  // On any failure `record` is yesterday's, untouched — never today's profile
  // with an empty award list, which would read as a thin résumé.
  if (record) people[id] = record;
  if (error) {
    failed++;
    console.error(`  ${id}: ${error.message}${existing[id] ? " — kept yesterday's record" : ""}`);
    continue;
  }
  console.log(
    `  ${record.name ?? id} — ${record.positionShort ?? "?"}, ${record.team ?? "no team"}` +
      ` (headshot ${shot}, ${record.awards.length} award(s),` +
      ` ${Object.keys(record.career).length} career stats)`,
  );
}

writeFileSync(
  OUT,
  `${JSON.stringify({ people }, null, 2)}\n`,
);
stamp("people");
console.log(
  `\nWrote ${Object.keys(people).length} to ${OUT}${failed ? `, ${failed} failed` : ""}.`,
);

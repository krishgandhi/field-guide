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
 * Node builtins only, like the other fetchers.
 *
 *   node scripts/fetch-people.mjs
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const MOVES = "content/moves";
const OUT = "src/data/people.json";
const SHOTS = "public/players";

const ATHLETE =
  "https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes";
/** The combiner resize; the raw file is ten times the size for no benefit. */
const HEADSHOT = (id) =>
  `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${id}.png&w=160&h=160`;

/** Every id referenced by an entry. Deliberately parses only that one line. */
function referencedIds() {
  const ids = new Set();
  for (const file of readdirSync(MOVES).filter((f) => f.endsWith(".mdx"))) {
    const raw = readFileSync(path.join(MOVES, file), "utf8");
    const line = raw.match(/^ {2}people: \[([^\]]*)\]/m);
    if (!line) continue;
    for (const part of line[1].split(",")) {
      const id = part.trim().replace(/^["']|["']$/g, "");
      if (/^\d+$/.test(id)) ids.add(id);
    }
  }
  return [...ids];
}

async function fetchPerson(id) {
  const res = await fetch(`${ATHLETE}/${id}`, {
    headers: { "user-agent": "field-guide (personal, non-commercial)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`athlete ${id} returned ${res.status}`);
  const body = await res.json();
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

async function saveHeadshot(id) {
  const file = path.join(SHOTS, `${id}.png`);
  // Headshots don't change; re-downloading a dozen of them daily is waste.
  if (existsSync(file)) return "cached";
  const res = await fetch(HEADSHOT(id), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return "missing";
  const buf = Buffer.from(await res.arrayBuffer());
  // Guard against ESPN handing back an error page with a 200.
  if (buf.length < 1000 || buf.subarray(1, 4).toString() !== "PNG") return "missing";
  writeFileSync(file, buf);
  return "downloaded";
}

const ids = referencedIds();
console.log(`${ids.length} people referenced by move entries.`);

mkdirSync(SHOTS, { recursive: true });
mkdirSync("src/data", { recursive: true });

// Keep any existing prose written by write-profiles.mjs — this script owns the
// facts, that one owns the sentence, and neither should clobber the other.
const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8")).people ?? {}
  : {};

const people = {};
let failed = 0;

for (const id of ids) {
  try {
    const person = await fetchPerson(id);
    const shot = await saveHeadshot(id);
    people[id] = {
      ...person,
      headshot: shot === "missing" ? null : `/players/${id}.png`,
      // Preserved across refreshes; regenerating it daily would burn tokens
      // rewriting the same sentence (§13).
      blurb: existing[id]?.blurb ?? null,
    };
    console.log(
      `  ${person.name ?? id} — ${person.positionShort ?? "?"}, ${person.team ?? "no team"} (headshot ${shot})`,
    );
  } catch (err) {
    failed++;
    // Keep whatever we had rather than dropping the card entirely.
    if (existing[id]) people[id] = existing[id];
    console.error(`  ${id}: ${err.message}`);
  }
}

writeFileSync(
  OUT,
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), people }, null, 2)}\n`,
);
console.log(
  `\nWrote ${Object.keys(people).length} to ${OUT}${failed ? `, ${failed} failed` : ""}.`,
);

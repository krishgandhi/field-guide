/**
 * Find transactions worth writing up, from ESPN's news feed.
 *
 * Why the news feed and not the transactions endpoint: /nfl/transactions works
 * and is useless. It returns roster churn — "Waived LS Luke Elkin. Placed RB
 * KC Eziomume on injured reserve" — and CLAUDE.md §1 rules out a fact with no
 * reason to care. Checked twice now; don't go back to it.
 *
 * The news feed carries `headline`, `description`, a web link, and categories
 * tagged by team and athlete. That's enough to spot a candidate and to link
 * out (§9).
 *
 * This script never decides that something IS a move. It cuts the obvious
 * noise and writes what's left to src/data/move-candidates.json. The judgement
 * call — is this a Moves entry at all — belongs to draft-moves.mjs, or to a
 * human. A regex cannot tell a blockbuster from a practice-squad signing.
 *
 * Node builtins only, like the other fetchers, so a broken dependency can
 * never stop a refresh.
 *
 *   node scripts/detect-moves.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { classify } from "./lib/detect-patterns.mjs";
import { ATHLETES as ATHLETE, SITE, getJson } from "./lib/espn.mts";

const FEED = `${SITE}/news?limit=50`;
const SEEN = "src/data/seen-news.json";
const OUT = "src/data/move-candidates.json";

/**
 * How many article ids to remember.
 *
 * This file is load-bearing: without it every run re-proposes the same events
 * and the drafting step burns tokens rewriting entries that already exist.
 * Capped so it can't grow without limit in the repo.
 */
const SEEN_LIMIT = 500;

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // A corrupt seen-list should not wedge the pipeline; worst case we
    // re-propose a few candidates and the drafting step skips them.
    return fallback;
  }
}

/**
 * ESPN tags articles with display names ("New England Patriots"); everything
 * downstream keys off abbreviations. §13's abbreviation trap, normalised once
 * here at the boundary rather than guessed later — the model should never be
 * inventing team codes, and a draft with no teams fails the schema on
 * promotion because it requires at least one.
 */
const TEAMS = JSON.parse(readFileSync("src/lib/teams/nfl-teams.json", "utf8"));
const BY_NAME = new Map(TEAMS.map((t) => [t.displayName.toLowerCase(), t.id]));

function abbreviate(names) {
  return [...new Set(names.map((n) => BY_NAME.get(String(n).toLowerCase())))].filter(
    Boolean,
  );
}

/**
 * Look up a player's real position.
 *
 * The single biggest source of error in a generated rubric. §7 makes
 * positional value the axis that decides everything, and the model was scoring
 * it off the headline — so a cornerback whose headline never said "CB" got a
 * neutral 3 with "the report does not spell out where he lines up". A
 * cornerback is a 4. One lookup removes that whole class of mistake.
 */
async function playerDetail(athleteId, name) {
  try {
    const body = await getJson(`${ATHLETE}/${athleteId}`, { timeoutMs: 15_000 });
    const a = body.athlete ?? body;
    // The id must survive: draft-moves writes it into `people:`, which is what
    // puts a profile card on the entry. Dropping it here published a signing
    // with people: [] and no card, and the moves test caught it.
    return {
      id: String(athleteId),
      name: a.displayName ?? name,
      position: a.position?.displayName ?? null,
      currentTeam: a.team?.abbreviation ?? null,
    };
  } catch {
    // Losing the position only costs accuracy on one axis; it must never stop
    // detection.
    return { id: athleteId, name };
  }
}

function athleteTags(article) {
  return (article.categories ?? [])
    .filter((c) => c?.type === "athlete" && c.athleteId)
    .map((c) => ({
      id: c.athleteId,
      name: c.description ?? c.athlete?.description ?? "",
    }));
}

function categoryValues(article, type) {
  return (article.categories ?? [])
    .filter((c) => c?.type === type)
    .map((c) => c.description ?? c[type]?.description)
    .filter(Boolean);
}

let articles;
try {
  ({ articles = [] } = await getJson(FEED));
} catch (err) {
  console.error(`ESPN news failed: ${err.message}`);
  process.exit(1);
}
console.log(`Fetched ${articles.length} articles.`);

const seen = new Set(readJson(SEEN, []));
const candidates = [];

for (const article of articles) {
  const id = String(article.id ?? "");
  if (!id || seen.has(id)) continue;

  // Video clips are never the source for a written entry.
  if (!["HeadlineNews", "Story"].includes(article.type)) continue;

  const headline = article.headline ?? "";
  const description = article.description ?? "";
  const text = `${headline} ${description}`;

  // A hint, not a decision — the model still judges what this really is.
  const likelyKind = classify(text);
  if (!likelyKind) continue;

  // Require a named player. A move is about a person; a story tagged only with
  // a team is usually a season preview.
  const tagged = athleteTags(article);
  if (tagged.length === 0) continue;

  const teamNames = categoryValues(article, "team");
  candidates.push({
    id,
    headline,
    description,
    published: (article.published ?? "").slice(0, 10),
    likelyKind,
    teams: teamNames,
    /** Normalised at the boundary — what the draft actually writes. */
    teamIds: abbreviate(teamNames),
    /** Filled in below with real positions. */
    players: tagged.slice(0, 3),
    url: article.links?.web?.href ?? "",
  });
}

// Positions, only for the handful that survived the filter.
for (const c of candidates) {
  c.players = await Promise.all(
    c.players.map((p) => playerDetail(p.id, p.name)),
  );
}

// Everything examined is marked seen EXCEPT the candidates, so rejected
// articles don't get re-examined daily while live ones survive to be drafted.
//
// Marking candidates here too is what lost Aaron Donald. He came out of
// retirement and re-signed with the Rams on 30 August, the biggest story of
// the offseason; the detector read those articles, filed them as seen, and the
// drafting step then failed on an empty API balance. The worklist is replaced
// every run and this feed only reaches back about two days, so by the time
// anyone looked the story was unreachable. Nothing anywhere reported a
// problem. A candidate now stays unseen until draft-moves.mjs records an
// outcome for it.
const candidateIds = new Set(candidates.map((c) => c.id));
const nextSeen = [
  ...articles
    .map((a) => String(a.id ?? ""))
    .filter((id) => id && !candidateIds.has(id)),
  ...seen,
];
const trimmed = [...new Set(nextSeen)].slice(0, SEEN_LIMIT);

mkdirSync("src/data", { recursive: true });
writeFileSync(SEEN, `${JSON.stringify(trimmed, null, 2)}\n`);

// Candidates are a worklist, and it now persists across runs. Replacing the
// file wholesale meant a candidate had exactly one night to be drafted: if the
// drafting step failed, the next morning's run overwrote it and the story was
// gone, because this feed only reaches back about two days. Carrying the
// undecided ones forward gives the pipeline as many attempts as it needs.
// Anything drafted, held or dismissed is in the seen list by then and drops
// out here.
const carried = (readJson(OUT, {}).candidates ?? []).filter(
  (c) => c?.id && !seen.has(c.id) && !candidateIds.has(c.id),
);
const worklist = [...candidates, ...carried]
  .sort((a, b) => String(b.published ?? "").localeCompare(String(a.published ?? "")))
  .slice(0, 40);
if (carried.length > 0) {
  console.log(`Carried ${carried.length} undecided candidate(s) forward.`);
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    { generatedAt: new Date().toISOString(), candidates: worklist },
    null,
    2,
  )}\n`,
);

if (candidates.length === 0) {
  console.log("No new candidates. This is the normal result out of season.");
} else {
  console.log(`\n${candidates.length} candidate(s):`);
  for (const c of candidates) {
    console.log(`  ${c.published}  [${c.likelyKind}] ${c.headline}`);
    console.log(
      `             ${c.teamIds.join(", ") || "no team tag"}  —  ${c.players
        .map((p) => `${p.name}${p.position ? ` (${p.position})` : ""}`)
        .join(", ")}`,
    );
  }
}

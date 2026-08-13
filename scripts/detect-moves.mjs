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

const FEED =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50";
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

/** Words that suggest a transaction rather than a game story. */
const TRANSACTION =
  /\b(traded?|trades|trading|acquires?|acquired|signs?|signed|signing|agrees? to terms|extension|extends?|released?|cut|franchise tag|restructur\w*|claimed off waivers)\b/i;

/**
 * Noise that survives the verb filter. Fantasy is the biggest category in the
 * feed by volume, and none of it is a move.
 */
const NOISE =
  /\b(fantasy|start[\s/]?sit|waiver wire|draft kit|power rankings?|mock draft|betting odds|best bets|prop bets?|survivor pool|injury report|questionable|doubtful|ruled out|expected to miss|practice squad|preseason recap)\b/i;

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

function categoryValues(article, type) {
  return (article.categories ?? [])
    .filter((c) => c?.type === type)
    .map((c) => c.description ?? c[type]?.description)
    .filter(Boolean);
}

const res = await fetch(FEED, {
  headers: { "user-agent": "field-guide (personal, non-commercial)" },
  signal: AbortSignal.timeout(20000),
});
if (!res.ok) {
  console.error(`ESPN news returned ${res.status}`);
  process.exit(1);
}
const { articles = [] } = await res.json();
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

  if (!TRANSACTION.test(text)) continue;
  if (NOISE.test(text)) continue;

  // Require a named player. A move is about a person; a story tagged only with
  // a team is usually a season preview.
  const athletes = categoryValues(article, "athlete");
  if (athletes.length === 0) continue;

  const teamNames = categoryValues(article, "team");
  candidates.push({
    id,
    headline,
    description,
    published: (article.published ?? "").slice(0, 10),
    teams: teamNames,
    /** Normalised at the boundary — what the draft actually writes. */
    teamIds: abbreviate(teamNames),
    athletes,
    url: article.links?.web?.href ?? "",
  });
}

// Mark everything examined as seen, not just the survivors — otherwise the
// same rejected articles get re-examined every day forever.
const nextSeen = [
  ...articles.map((a) => String(a.id ?? "")).filter(Boolean),
  ...seen,
];
const trimmed = [...new Set(nextSeen)].slice(0, SEEN_LIMIT);

mkdirSync("src/data", { recursive: true });
writeFileSync(SEEN, `${JSON.stringify(trimmed, null, 2)}\n`);

// Candidates are a worklist, not an archive: each run replaces the file with
// what is currently outstanding. Anything already drafted or dismissed is in
// the seen list and won't come back.
writeFileSync(
  OUT,
  `${JSON.stringify(
    { generatedAt: new Date().toISOString(), candidates },
    null,
    2,
  )}\n`,
);

if (candidates.length === 0) {
  console.log("No new candidates. This is the normal result out of season.");
} else {
  console.log(`\n${candidates.length} candidate(s):`);
  for (const c of candidates) {
    console.log(`  ${c.published}  ${c.headline}`);
    console.log(`             ${c.teamIds.join(", ") || "no team tag"}`);
  }
}

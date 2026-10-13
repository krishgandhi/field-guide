/**
 * Write the "why watch this" sentences for the week's games, using Claude.
 *
 * Runs after fetch-slate.mjs in the daily workflow and writes the results back
 * into src/data/slate.json, so the prose is generated once and cached rather
 * than regenerated per page load (CLAUDE.md §13). Pages stay static.
 *
 * Deliberately a separate script from the fetch:
 *   - fetch-slate.mjs stays dependency-free (Node builtins only), so a broken
 *     npm install can never stop a data refresh.
 *   - If this step fails, or there's no API key, the slate is already correct
 *     and the app falls back to the deterministic template. Losing nice prose
 *     is a cosmetic downgrade; losing the schedule is not.
 *
 * Every sentence is validated before it is accepted. Anything that fails is
 * dropped and that game keeps its template. The model is given ONLY the facts
 * we already verified — it is writing prose about supplied inputs, not
 * recalling anything about football.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npm run write:reasons
 */

import { readFile, writeFile } from "node:fs/promises";
import { problemWith } from "./lib/reason-validation.mjs";
import { SITE, getJson } from "./lib/espn.mts";
import { MODELS, generateJson, hasKey, isNoResult } from "./lib/claude.mts";

const SLATE = "src/data/slate.json";

/**
 * --self-test: run one fixture game through the real API and write nothing.
 *
 * Week 1 is entirely hand-written and previews don't exist until September, so
 * this code path is otherwise unreachable until the moment it matters. Three
 * bugs reached main that way already.
 */
const SELF_TEST = process.argv.includes("--self-test");

const { factorsFor } = await import("../src/lib/watchability.ts");
const { noteFor } = await import("../src/lib/slate/notes.ts");
const { teamName, isDivisional, team } = await import("../src/lib/teams/index.ts");
const { isRivalry, hasStarQb } = await import("../src/lib/slate/context.ts");

// No key: leave the templates in place and exit clean. This is the normal
// state on a fork or a local run, not an error.
if (!hasKey()) {
  console.log("No ANTHROPIC_API_KEY — keeping template reasons.");
  process.exit(0);
}

const slate = JSON.parse(await readFile(SLATE, "utf8"));

/** A real fixture: Bills at Texans, with plausible preview reporting. */
const FIXTURE_REPORTING = [
  {
    headline: "Josh Allen and the Bills open at Houston under a new head coach",
    description:
      "Joe Brady takes charge for the first time since replacing Sean McDermott, against the team that knocked Buffalo out last season.",
  },
];

/**
 * Games that still need a sentence.
 *
 * A hand-written note in src/lib/slate/notes.ts outranks anything generated
 * here (see the precedence in watchability.ts), so asking the model for those
 * produces prose that can never be displayed. Week 1 is fully hand-written,
 * which made the first successful run generate sixteen sentences and show
 * none of them.
 */
// The Bills game, so the fixture reporting below actually belongs to it. With
// a mismatched pairing the model correctly ignores the article and the
// self-test proves nothing about the feature it exists to test.
const needsReason = SELF_TEST
  ? [slate.games.find((g) => g.home === "BUF" || g.away === "BUF") ?? slate.games[0]]
  : slate.games.filter((game) => !noteFor(slate.week, game.away, game.home));

if (SELF_TEST) {
  console.log("Self-test: one fixture game, real API call, nothing written.\n");
}

if (needsReason.length === 0) {
  console.log(
    `All ${slate.games.length} games in week ${slate.week} have hand-written notes. Nothing to generate.`,
  );
  process.exit(0);
}

/**
 * Preview reporting for each game, so the sentences can say what is actually
 * going on rather than "two evenly matched teams".
 *
 * Uses `news?team=<espnId>`, NOT the per-game summary endpoint. The latter
 * looks right and isn't: its news.articles is the same generic league-wide
 * list for every event — verified against a September game and two different
 * preseason games, identical six stories each time.
 *
 * §9: headlines and descriptions are used here and never written to disk. Only
 * the generated sentence and the source link are stored.
 */
const NEWS = `${SITE}/news`;
const PREVIEW_WINDOW_DAYS = 10;

async function teamArticles(teamId) {
  const espnId = team(teamId)?.espnId;
  if (!espnId) return [];
  try {
    const { articles = [] } = await getJson(`${NEWS}?team=${espnId}&limit=30`);
    return articles;
  } catch {
    // Losing preview colour is cosmetic; the sentence still gets written from
    // the structured facts.
    return [];
  }
}

/** Articles near kickoff that mention the opponent — that's what a preview is. */
function previewsFor(articles, opponentId, kickoff) {
  const opponent = team(opponentId);
  if (!opponent) return [];
  const when = new Date(kickoff).getTime();
  const needles = [opponent.name, opponent.location, opponent.displayName]
    .filter(Boolean)
    .map((n) => n.toLowerCase());

  return articles.filter((a) => {
    const published = new Date(a.published ?? 0).getTime();
    if (!published) return false;
    const days = Math.abs(when - published) / 86400000;
    if (days > PREVIEW_WINDOW_DAYS) return false;
    const text = `${a.headline ?? ""} ${a.description ?? ""}`.toLowerCase();
    return needles.some((n) => text.includes(n));
  });
}

// One request per team, not per game — both sides of a game share the fetch.
const playing = [...new Set(needsReason.flatMap((g) => [g.home, g.away]))];
const articlesByTeam = SELF_TEST
  ? new Map()
  : new Map(
      await Promise.all(playing.map(async (id) => [id, await teamArticles(id)])),
    );

/** gameId -> [{headline, description, link}], for the prompt and the guard. */
const previews = new Map();
for (const game of needsReason) {
  if (SELF_TEST) {
    previews.set(game.id, FIXTURE_REPORTING.map((r) => ({ ...r, link: "" })));
    continue;
  }
  const found = [
    ...previewsFor(articlesByTeam.get(game.home) ?? [], game.away, game.kickoff),
    ...previewsFor(articlesByTeam.get(game.away) ?? [], game.home, game.kickoff),
  ];
  const seen = new Set();
  previews.set(
    game.id,
    found
      .filter((a) => !seen.has(a.id) && seen.add(a.id))
      .slice(0, 3)
      .map((a) => ({
        headline: a.headline ?? "",
        description: a.description ?? "",
        link: a.links?.web?.href ?? "",
      })),
  );
}

const withPreviews = [...previews.values()].filter((p) => p.length > 0).length;
console.log(
  `${withPreviews}/${needsReason.length} games have preview reporting to draw on.`,
);

/**
 * What the model is allowed to know about each game.
 *
 * Verified inputs only, described in words rather than handed over as raw
 * numbers so there is nothing to misquote — plus the preview reporting above,
 * which is the one place real names enter and is checked against the output.
 */
const games = needsReason.map((game) => {
  const factors = factorsFor(game, slate.week);
  const closeness =
    game.spread === null
      ? "no betting line posted yet"
      : game.spread < 4
        ? "the bookmakers can barely separate them"
        : game.spread < 7
          ? "one side is a modest favourite"
          : "one side is a heavy favourite";

  return {
    id: game.id,
    away: teamName(game.away),
    home: teamName(game.home),
    closeness,
    sameDivision: isDivisional(game.home, game.away),
    longstandingRivalry: isRivalry(game.home, game.away),
    eliteQuarterbacks: [game.home, game.away].filter(hasStarQb).length,
    primetime: factors.some((f) => f.reason.startsWith("Primetime")),
    involvesBills: game.home === "BUF" || game.away === "BUF",
    // Headlines only, never article bodies (§9).
    reporting: (previews.get(game.id) ?? []).map((p) => ({
      headline: p.headline,
      description: p.description,
    })),
  };
});

const SYSTEM = `You write one-sentence explanations of why an NFL game is or isn't worth watching, for someone who has watched a bit of football but has no feel for what makes a game matter.

Rules, all of them hard:
- Use ONLY the facts given for that game, including anything in its "reporting" list. You know nothing else about these teams.
- "reporting" is recent coverage of this game. Use it to say what is actually going on — a quarterback's first start, a coach facing his old team, a rematch of something. That specificity is the whole point; without it you will write something bland and useless.
- Summarise reporting in your own words. Never copy a phrase from a headline.
- You MAY name a player, but ONLY if that exact name appears in "reporting". If it isn't there, describe the situation instead ("their new quarterback").
- Never state a number, statistic, record, or score. Not one, ever, even from reporting.
- No jargon. Banned outright: leverage, implications, seeding, efficiency, variance, spread, matchup, elite, storyline, momentum.
- Plain spoken English, one sentence, roughly 10 to 20 words, ending in a full stop.
- Say why it is or isn't worth turning on. If nothing is riding on it, say so plainly rather than inventing interest.
- Vary the phrasing across the slate. Sixteen sentences that open the same way are useless.
- Never address the reader as a fan of either side, except where involvesBills is true — that is his team, and you may say so.`;

const schema = {
  type: "object",
  properties: {
    reasons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["reasons"],
  additionalProperties: false,
};

let reasons, usage;
try {
  ({ data: { reasons }, usage } = await generateJson({
    label: "write-reasons",
    model: MODELS.prose,
    system: SYSTEM,
    user: `Week ${slate.week}. Write one sentence per game.\n\n${JSON.stringify(games, null, 2)}`,
    schema,
    maxTokens: 8000,
    // Short, scoped writing task — not intelligence-sensitive. This is the
    // lever to turn up if the sentences come out flat.
    effort: "medium",
  }));
} catch (err) {
  if (!isNoResult(err)) throw err;
  console.error(`${err.message}. Keeping templates.`);
  process.exit(0);
}

// --- validation ------------------------------------------------------------

/** Every team nickname, so a sentence can't name a side that isn't playing. */
const allTeamNames = slate.games.flatMap((g) => [teamName(g.home), teamName(g.away)]);

const byId = new Map(slate.games.map((g) => [g.id, g]));
let accepted = 0;
const rejected = [];

for (const { id, reason } of reasons ?? []) {
  const game = byId.get(id);
  if (!game) {
    rejected.push(`unknown game id ${id}`);
    continue;
  }
  const sourceText = (previews.get(game.id) ?? [])
    .map((p) => `${p.headline} ${p.description}`)
    .join(" ");
  const problem = problemWith(reason, game, { teamName, allTeamNames, sourceText });
  if (problem) {
    rejected.push(`${id}: ${problem} — "${reason}"`);
    continue;
  }
  game.reason = reason.trim();
  accepted++;
}

if (SELF_TEST) {
  console.log("Self-test — the sentence it produced, not written to disk:\n");
  for (const game of needsReason) {
    console.log(`  ${teamName(game.away)} at ${teamName(game.home)}`);
    console.log(`  "${game.reason ?? "(rejected)"}"\n`);
  }
} else {
  slate.reasonsWrittenAt = new Date().toISOString();
  await writeFile(SLATE, `${JSON.stringify(slate, null, 2)}\n`);
}

console.log(
  `${accepted}/${SELF_TEST ? needsReason.length : slate.games.length} reasons accepted`,
);
for (const r of rejected) console.log(`  rejected — ${r}`);
console.log(`tokens: ${usage.input} in, ${usage.output} out`);

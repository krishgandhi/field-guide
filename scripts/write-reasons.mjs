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
import Anthropic from "@anthropic-ai/sdk";

const SLATE = "src/data/slate.json";

const { factorsFor } = await import("../src/lib/watchability.ts");
const { noteFor } = await import("../src/lib/slate/notes.ts");
const { teamName, isDivisional } = await import("../src/lib/teams/index.ts");
const { isRivalry, hasStarQb } = await import("../src/lib/slate/context.ts");

// No key: leave the templates in place and exit clean. This is the normal
// state on a fork or a local run, not an error.
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("No ANTHROPIC_API_KEY — keeping template reasons.");
  process.exit(0);
}

const slate = JSON.parse(await readFile(SLATE, "utf8"));

/**
 * What the model is allowed to know about each game.
 *
 * Only verified inputs, described in words rather than handed over as raw
 * numbers, so there is nothing for it to misquote. It never sees a team's
 * record, a player's name, or anything we haven't checked.
 */
/**
 * Games that still need a sentence.
 *
 * A hand-written note in src/lib/slate/notes.ts outranks anything generated
 * here (see the precedence in watchability.ts), so asking the model for those
 * produces prose that can never be displayed. Week 1 is fully hand-written,
 * which made the first successful run generate sixteen sentences and show
 * none of them.
 */
const needsReason = slate.games.filter(
  (game) => !noteFor(slate.week, game.away, game.home),
);

if (needsReason.length === 0) {
  console.log(
    `All ${slate.games.length} games in week ${slate.week} have hand-written notes. Nothing to generate.`,
  );
  process.exit(0);
}

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
  };
});

const client = new Anthropic();

const SYSTEM = `You write one-sentence explanations of why an NFL game is or isn't worth watching, for someone who has watched a bit of football but has no feel for what makes a game matter.

Rules, all of them hard:
- Use ONLY the facts given for that game. You know nothing else about these teams.
- Never state a number, statistic, record, score, or player name. Not one.
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

const response = await client.beta.messages.create({
  model: "claude-opus-5",
  max_tokens: 8000,
  system: SYSTEM,
  // Short, scoped writing task — not intelligence-sensitive. This is the lever
  // to turn up if the sentences come out flat.
  output_config: { effort: "medium", format: { type: "json_schema", schema } },
  // Recommended default on Opus 5: if a safety classifier declines, the API
  // re-runs on a fallback model rather than handing back a refusal.
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  messages: [
    {
      role: "user",
      content: `Week ${slate.week}. Write one sentence per game.\n\n${JSON.stringify(games, null, 2)}`,
    },
  ],
});

// Check before reading content: a refusal returns HTTP 200 with empty or
// partial content, and indexing into it blind would throw.
if (response.stop_reason === "refusal") {
  console.error(
    `Model declined (${response.stop_details?.category ?? "unknown"}). Keeping templates.`,
  );
  process.exit(0);
}

const payload = response.content.find((b) => b.type === "text")?.text;
if (!payload) {
  console.error("No text block in response. Keeping templates.");
  process.exit(0);
}

const { reasons } = JSON.parse(payload);

// --- validation ------------------------------------------------------------

const BANNED = [
  "leverage", "implication", "seeding", "efficiency", "variance",
  "spread", "matchup", "elite", "storyline", "momentum",
];

/** Every team nickname, so a sentence can't name a side that isn't playing. */
const ALL_NAMES = slate.games.flatMap((g) => [teamName(g.home), teamName(g.away)]);

function problemWith(text, game) {
  const words = text.trim().split(/\s+/).length;
  if (words < 6 || words > 26) return `${words} words`;
  if (!/[.!?]$/.test(text.trim())) return "no end punctuation";
  if (/\d/.test(text)) return "contains a number";

  const lower = text.toLowerCase();
  const banned = BANNED.find((w) => lower.includes(w));
  if (banned) return `jargon "${banned}"`;

  const ours = new Set([teamName(game.home), teamName(game.away)]);
  const stray = ALL_NAMES.find((n) => !ours.has(n) && text.includes(n));
  if (stray) return `names "${stray}", who aren't in this game`;

  return null;
}

const byId = new Map(slate.games.map((g) => [g.id, g]));
let accepted = 0;
const rejected = [];

for (const { id, reason } of reasons ?? []) {
  const game = byId.get(id);
  if (!game) {
    rejected.push(`unknown game id ${id}`);
    continue;
  }
  const problem = problemWith(reason, game);
  if (problem) {
    rejected.push(`${id}: ${problem} — "${reason}"`);
    continue;
  }
  game.reason = reason.trim();
  accepted++;
}

slate.reasonsWrittenAt = new Date().toISOString();
await writeFile(SLATE, `${JSON.stringify(slate, null, 2)}\n`);

console.log(`${accepted}/${slate.games.length} reasons accepted`);
for (const r of rejected) console.log(`  rejected — ${r}`);
console.log(
  `tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`,
);

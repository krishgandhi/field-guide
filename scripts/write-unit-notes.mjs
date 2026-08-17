/**
 * Write the "what kind of unit is this" line for each team's offence, defence
 * and special teams, using Claude.
 *
 * The rank sentence beside the meter is templated and always true, but it can
 * only ever say "fourth-best for points scored". It cannot tell you Buffalo
 * ran the ball more than anyone in the league, or that Seattle just paid their
 * best cornerback and added another. That is what a fan would actually say
 * about a unit, and it is what this writes.
 *
 * Same discipline as write-profiles.mjs: characterise from supplied evidence
 * only. The model gets efficiency and scoring ranks, an ADJUSTED run/pass
 * split, the unit's key players, and this site's own sourced move entries.
 *
 * It is deliberately NOT given raw attempt counts. Buffalo ranked first in the
 * league in rushing attempts last season, and the obvious reading — a
 * run-first team — is wrong: 112 of those carries were Josh Allen's own, 40
 * sacks never appear in the pass column, and a 12-5 team runs out a lot of
 * clocks. Adjusted, they sat 28th of 32 in pass share against a league median
 * of 58.8%. Mildly run-leaning, not a philosophy. Volume ranks cannot tell
 * intent from circumstance, so they don't get shown.
 *
 * Cached in src/data/team-detail.json and regenerated only when the evidence
 * or the brief changes (§13).
 *
 *   ANTHROPIC_API_KEY=... npm run write:units
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { problemWithNote } from "./lib/unit-note-validation.mjs";

const DETAIL = "src/data/team-detail.json";
const MOVES = "content/moves";

/** Bump when the brief changes materially, to rewrite existing lines. */
const PROMPT_VERSION = 6;

const SELF_TEST = process.argv.includes("--self-test");

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("No ANTHROPIC_API_KEY — no unit notes written.");
  process.exit(0);
}
if (!existsSync(DETAIL)) {
  console.log("No team detail cache. Run fetch-team-detail.mjs first.");
  process.exit(0);
}

const cache = JSON.parse(readFileSync(DETAIL, "utf8"));
const UNITS = ["offence", "defence", "specialTeams"];

/** What this site already says about the team — sourced prose, safe to reuse. */
function movesFor(teamId) {
  const out = [];
  for (const file of readdirSync(MOVES).filter((f) => f.endsWith(".mdx"))) {
    const raw = readFileSync(path.join(MOVES, file), "utf8");
    const teams = raw.match(/^ {2}teams: \[([^\]]*)\]/m)?.[1] ?? "";
    if (!teams.split(",").some((t) => t.trim() === teamId)) continue;
    const title = raw.match(/^title: (.+)$/m)?.[1];
    const summary = raw.match(/^summary: (.+)$/m)?.[1];
    if (title) out.push(summary ? `${title} — ${summary}` : title);
  }
  return out;
}

function evidenceFor(teamId, team, unit) {
  const u = team.units[unit];
  // Underscore keys are inputs to the pass-rate maths, not evidence. Handing
  // over "rushing attempts rank 1" invites exactly the wrong conclusion.
  const stats = Object.fromEntries(
    Object.entries(u.stats ?? {}).filter(([k]) => !k.startsWith("_")),
  );
  return {
    unit,
    rankInLeague: u.rank,
    statRanksOutOf32: stats,
    ...(unit === "offence"
      ? {
          /** Adjusted for the quarterback's own carries and for sacks. */
          passPlaySharePct: u.passPlayShare,
          passPlayShareRank: u.passPlayShareRank,
          leagueMedianPassShare: 58.8,
          quarterbackOwnCarries: u.quarterbackCarries,
        }
      : {}),
    keyPlayers: (u.players ?? []).map((p) => ({
      position: p.label,
      name: p.name,
      // "(CAR)" on a player now in Buffalo is a sourced hint that he came from
      // elsewhere. It does NOT say when, and the brief forbids guessing.
      drafted: p.draftedBy ?? null,
      // Which season this is for him, counting from 1. ESPN's own field uses 0
      // for a rookie and then counts inclusively — a 2025 pick reads 2 in 2026
      // — so it is handed over normalised. Reading the draft year as "this
      // year" made the model call ten second-year players rookies.
      seasonInTheLeague: p.experience === 0 ? 1 : (p.experience ?? null),
    })),
    headCoach: team.coach?.name ?? null,
    // ESPN counts seasons as an NFL head coach ANYWHERE, not with this club, so
    // 0 proves the man is new and any other number proves nothing either way —
    // Vrabel reads 7 in his second year at New England. It is enough to stop
    // the model calling a coach new from memory, which is what it did when all
    // it had was a name.
    headCoachSeasonsAsHeadCoach: team.coach?.experience ?? null,
    recentMovesInvolvingThisTeam: movesFor(teamId),
  };
}

const hashOf = (evidence) =>
  createHash("sha256").update(JSON.stringify(evidence)).digest("hex").slice(0, 16);

// --- what needs writing ----------------------------------------------------

const todo = [];
for (const [teamId, team] of Object.entries(cache.teams ?? {})) {
  for (const unit of UNITS) {
    const u = team.units[unit];
    const evidence = evidenceFor(teamId, team, unit);
    const hash = hashOf(evidence);
    if (u.blurb && u.blurbHash === hash && u.promptVersion === PROMPT_VERSION) {
      continue;
    }
    todo.push({ key: `${teamId}:${unit}`, teamId, unit, evidence, hash });
  }
}

if (todo.length === 0) {
  console.log("Every unit already has a line. Nothing to generate.");
  process.exit(0);
}

const batch = SELF_TEST ? todo.slice(0, 3) : todo;
console.log(
  `${todo.length} unit note(s) to write${SELF_TEST ? " — self-test, writing 3 and saving none" : ""}.\n`,
);

const client = new Anthropic();

const SYSTEM = `You describe one unit of an NFL team — its offence, its defence or its special teams — to someone who has watched a bit of football but does not follow it closely.

You get that unit's league ranks out of 32, its key players with where each was drafted, the head coach, and summaries of recent moves involving the team from this site.

There are two different rules for facts and for reading them.

FACTS MUST COME FROM THE EVIDENCE. Every number, player name, award, coaching change and transaction you mention has to be in what you were given. You may not add one from memory.

THE READING IS YOURS. You may interpret what the numbers imply, connect them to a coaching change, and say what looks likely to change. That is the job — a list of ranks is not worth reading.

Two things follow from that, and they matter:

1. THE STATISTICS DESCRIBE LAST SEASON. If the evidence shows the head coach changed, last season's tendencies belong to the previous regime and you should say so rather than presenting them as what this team is. A note that describes a team as its fired coach built it is worse than useless to someone about to talk about this year.

Only two things in the evidence show a coaching change: headCoachSeasonsAsHeadCoach is 0, or a coaching move appears in recentMovesInvolvingThisTeam. If neither holds, the coach is NOT new — name him if he is worth naming, but do not say he took over, arrived, is new, or inherited anything from a previous staff. Any other number in that field proves nothing: it counts seasons as a head coach anywhere in the league, so a coach in his first year with this team can read 7.

2. NEVER SAY A PLAYER IS NEW, CAME FROM ANYWHERE, WAS SIGNED, OR WAS TRADED unless that exact move appears in recentMovesInvolvingThisTeam.

3. A PLAYER IS A ROOKIE ONLY IF seasonInTheLeague IS 1. Do not work it out from the draft year — the most recent draft in the data is not necessarily this year's. Second-year, third-year and so on follow the same field: 2 means his second season. If the field is missing, say nothing about how long he has been around.

The "drafted" field says WHO DRAFTED HIM, not where he was last. A player drafted by Denver in 2018 and now in Buffalo has probably played for other clubs in between — writing "came from Denver" is simply false. You may say "a first-round pick of Denver's" or "drafted fifth overall by Denver", because those are what the field actually says. You may not turn it into a transfer.

For an offence you also get passPlaySharePct: the share of plays that were pass plays, already adjusted for sacks and for the quarterback's own carries, with the league median for comparison. USE THIS, not your instincts, to judge whether a team leans run or pass. It is the honest version — raw carry counts are inflated by quarterback scrambles and by teams running out the clock when ahead.

Write ONE or TWO sentences saying what kind of unit this is. Not how good — a rating already sits next to your words and says that. What KIND.

The useful things to say, when the evidence supports them:
- How they play, judged from passPlaySharePct against the league median. A team well below the median leans on the run; well above, they throw. Close to it, say nothing about balance — most teams are unremarkable here and pretending otherwise is worse than silence.
- If quarterbackOwnCarries is high, the interesting fact is that the quarterback is a major part of the running game, NOT that the team is run-heavy.
- Who it runs through. Name the player the unit is built around if the evidence points at one.
- What just changed, and what it points to. A new head coach or a move in the list are signals about direction. A key player drafted by another club is a weaker hint — it tells you he was acquired at some point, not recently. A unit that ran a lot under a coach who has since been fired may not run a lot now, and saying so is more useful than repeating last year's split.

Hard rules:
- Never state a number that is not in the evidence. Prefer plain words: "ran the ball more than any other team" rather than "547 carries".
- Use at most one figure, and only if it genuinely helps.
- Do not restate the rank. "Fourth-best for points scored" already appears directly above your sentence; repeating it wastes the only two sentences you get.
- Do NOT pass judgement on the unit overall — no "middling", "strong", "poor", "ordinary", "unremarkable" about the unit as a whole. The rating beside you already says how good it is, and one of these words next to four dots out of five reads as a contradiction. Describe traits instead: what they do a lot of, what they do well, what they don't.
- You MAY say a specific thing is a weakness ("rarely gets to the quarterback") when a rank supports it. That is a trait, not a verdict on the unit.
- If nothing is distinctive, name the players and what the unit is built around. Silence about character is better than a verdict that fights the rating.
- Never mention a player who is not in the evidence.
- Do not describe a team's "philosophy" or "identity" as though you know their intent. Describe what the numbers show them doing.
- Plain spoken English, 15 to 40 words, and never more than 45. Anything longer is thrown away, and a long sentence is the first thing to go when you have too much to say. No jargon a newcomer wouldn't know, and no fantasy framing.`;

const schema = {
  type: "object",
  properties: {
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, blurb: { type: "string" } },
        required: ["key", "blurb"],
        additionalProperties: false,
      },
    },
  },
  required: ["notes"],
  additionalProperties: false,
};

/** Batched so one request covers many units; 96 separate calls would be silly. */
const CHUNK = 12;
const results = new Map();
let tokensIn = 0;
let tokensOut = 0;

for (let i = 0; i < batch.length; i += CHUNK) {
  const slice = batch.slice(i, i + CHUNK);
  const response = await client.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content: `Write one entry per unit.\n\n${JSON.stringify(
          slice.map((t) => ({ key: t.key, ...t.evidence })),
          null,
          2,
        )}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.error("Model declined a batch. Skipping it.");
    continue;
  }
  const payload = response.content.find((b) => b.type === "text")?.text;
  if (!payload) continue;
  for (const n of JSON.parse(payload).notes ?? []) results.set(n.key, n.blurb);
  tokensIn += response.usage.input_tokens;
  tokensOut += response.usage.output_tokens;
}

// --- validation ------------------------------------------------------------

// The guards live in scripts/lib/unit-note-validation.mjs so they can be tested
// without an API key — importing this file starts calling the model.

let accepted = 0;
const rejected = [];

for (const item of batch) {
  const blurb = results.get(item.key);
  if (!blurb) {
    rejected.push(`${item.key}: no response`);
    continue;
  }
  const problem = problemWithNote(blurb, item.evidence);
  if (problem) {
    rejected.push(`${item.key}: ${problem} — "${blurb}"`);
    continue;
  }
  if (!SELF_TEST) {
    const unit = cache.teams[item.teamId].units[item.unit];
    unit.blurb = blurb.trim();
    unit.blurbHash = item.hash;
    unit.promptVersion = PROMPT_VERSION;
  }
  accepted++;
  if (SELF_TEST) console.log(`  ${item.key}\n    "${blurb.trim()}"`);
}

if (!SELF_TEST) {
  cache.unitNotesWrittenAt = new Date().toISOString();
  writeFileSync(DETAIL, `${JSON.stringify(cache, null, 2)}\n`);
} else {
  console.log("\n(self-test: nothing written)");
}

console.log(`\n${accepted}/${batch.length} accepted`);
for (const r of rejected.slice(0, 10)) console.log(`  rejected — ${r}`);
console.log(`tokens: ${tokensIn} in, ${tokensOut} out`);

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
 * only. The model gets rank TIERS, an ADJUSTED run/pass split bucketed against
 * the league median (computed from the data, not hardcoded), the unit's key
 * players, and this site's own sourced move entries — see
 * scripts/lib/unit-evidence.mjs for why all of it is coarse.
 *
 * It is deliberately NOT given raw attempt counts. In 2025 Buffalo ranked
 * first in the league in rushing attempts, and the obvious reading — a
 * run-first team — was wrong: 112 of those carries were Josh Allen's own, 40
 * sacks never appear in the pass column, and a 12-5 team runs out a lot of
 * clocks. Volume ranks cannot tell intent from circumstance, so they don't get
 * shown.
 *
 * The brief states which season the statistics describe, read from
 * team-detail.json. It used to say "last season" unconditionally, which became
 * false the week the fetcher switched to 2026 numbers.
 *
 * Stored in src/data/prose-cache.json under "units", keyed on the evidence
 * and the prompt version, and regenerated only when either changes (§13).
 * Without an API key this still runs: it prunes, and drops any out-of-date
 * note that no longer validates against the current evidence.
 *
 *   ANTHROPIC_API_KEY=... npm run write:units
 */

import { readFileSync, existsSync } from "node:fs";
import { problemWithNote, problemWithStaleNote, repeatsCoaching } from "./lib/unit-note-validation.mjs";
import { MODELS, generateJson, hasKey, isNoResult } from "./lib/claude.mts";
import { readMoves } from "./lib/moves.mts";
import { leagueContext, unitEvidence } from "./lib/unit-evidence.mjs";
import {
  chunk,
  needsWriting,
  printLog,
  proseKey,
  readCache,
  settle,
  writeCache,
} from "./lib/prose-cache.mts";

const DETAIL = "src/data/team-detail.json";

/**
 * Bump when the brief changes materially, to rewrite existing lines.
 * 8: the coaching situation belongs to the offence note only — all three
 * Buffalo notes ended "now under new head coach Joe Brady".
 */
const PROMPT_VERSION = 8;

const SELF_TEST = process.argv.includes("--self-test");

if (SELF_TEST && !hasKey()) {
  console.log("Self-test needs ANTHROPIC_API_KEY.");
  process.exit(1);
}
if (!existsSync(DETAIL)) {
  console.log("No team detail cache. Run fetch-team-detail.mjs first.");
  process.exit(0);
}

const detail = JSON.parse(readFileSync(DETAIL, "utf8"));
const prose = readCache();
const UNITS = ["offence", "defence", "specialTeams"];

/** What this site already says about the team — sourced prose, safe to reuse. */
function movesFor(teamId) {
  const out = [];
  for (const { title, summary, move } of readMoves()) {
    if (!move.teams.includes(teamId)) continue;
    if (title) out.push(summary ? `${title} — ${summary}` : title);
  }
  return out;
}

const league = leagueContext(detail.teams);
const evidenceFor = (teamId, team, unit) =>
  unitEvidence(teamId, team, unit, league, movesFor(teamId));

// --- what needs writing ----------------------------------------------------

/** Every unit in the league, with its evidence and the key of that evidence. */
const wanted = [];
for (const [teamId, team] of Object.entries(detail.teams ?? {})) {
  for (const unit of UNITS) {
    const evidence = evidenceFor(teamId, team, unit);
    wanted.push({
      subject: `${teamId}:${unit}`,
      // The season framing changes the brief, so it is part of the key.
      key: proseKey(PROMPT_VERSION, { evidence, season: detail.statsSeason, previousSeason: detail.previousSeason }),
      evidence,
    });
  }
}
const evidenceOf = new Map(wanted.map((w) => [w.subject, w.evidence]));

const todo = needsWriting(prose.units, wanted);
// The self-test takes any three units, cached or not: it exists to prove the call works.
const batch = !hasKey() ? [] : SELF_TEST ? wanted.slice(0, 3) : todo;
if (!hasKey()) {
  console.log(`No ANTHROPIC_API_KEY — ${todo.length} unit note(s) would be written; checking existing ones only.`);
} else {
  console.log(
    `${todo.length} unit note(s) to write${SELF_TEST ? " — self-test, writing 3 and saving none" : ""}.\n`,
  );
}

/** What the statistics describe, in the brief's own words. */
const SEASON_RULE = detail.previousSeason
  ? `1. THE STATISTICS DESCRIBE LAST SEASON (${detail.statsSeason}); this season has not produced enough data yet. If the evidence shows the head coach changed, last season's tendencies belong to the previous regime and you should say so rather than presenting them as what this team is. A note that describes a team as its fired coach built it is worse than useless to someone about to talk about this year.`
  : `1. THE STATISTICS DESCRIBE THE ${detail.statsSeason} SEASON SO FAR — this season, under the current head coach. Never call them last season's. A few weeks of games can mislead, so describe tendencies ("so far this season they have…") rather than settled identity.`;

const SYSTEM = `You describe one unit of an NFL team — its offence, its defence or its special teams — to someone who has watched a bit of football but does not follow it closely.

You get where that unit sits in the league (as tiers: top quarter, middle, bottom quarter, where "top" means ESPN ranked them nearest 1st for that stat), its key players with where each was drafted, the head coach, and summaries of recent moves involving the team from this site.

There are two different rules for facts and for reading them.

FACTS MUST COME FROM THE EVIDENCE. Every number, player name, award, coaching change and transaction you mention has to be in what you were given. You may not add one from memory.

THE READING IS YOURS. You may interpret what the numbers imply, connect them to a coaching change, and say what looks likely to change. That is the job — a list of ranks is not worth reading.

Two things follow from that, and they matter:

${SEASON_RULE}

Only two things in the evidence show a coaching change: headCoachSeasonsAsHeadCoach is 0, or a coaching move appears in recentMovesInvolvingThisTeam. If neither holds, the coach is NOT new — name him if he is worth naming, but do not say he took over, arrived, is new, or inherited anything from a previous staff. Any other number in that field proves nothing: it counts seasons as a head coach anywhere in the league, so a coach in his first year with this team can read 7.

SAY THE COACHING SITUATION ONCE PER TEAM, IN THE OFFENCE NOTE. The three notes for a team sit one under another on the same page, beneath a line that already names the head coach and says whether it is his first season. Ending every note with "now under new head coach X" reads as filler. In a defence or special-teams note, do not name the head coach, say "head coach", or mention a coaching change at all. If the statistics come from a previous regime, you may say they are last season's — that is about the numbers, not the coach.

2. NEVER SAY A PLAYER IS NEW, CAME FROM ANYWHERE, WAS SIGNED, OR WAS TRADED unless that exact move appears in recentMovesInvolvingThisTeam.

3. A PLAYER IS A ROOKIE ONLY IF seasonInTheLeague IS 1. Do not work it out from the draft year — the most recent draft in the data is not necessarily this year's. Second-year, third-year and so on follow the same field: 2 means his second season. If the field is missing, say nothing about how long he has been around.

The "drafted" field says WHO DRAFTED HIM, not where he was last. A player drafted by Denver in 2018 and now in Buffalo has probably played for other clubs in between — writing "came from Denver" is simply false. You may say "a first-round pick of Denver's" or "drafted fifth overall by Denver", because those are what the field actually says. You may not turn it into a transfer.

For an offence you also get passPlayShare: how the share of plays that were pass plays compares with this season's league median, already adjusted for sacks and for the quarterback's own carries. USE THIS, not your instincts, to judge whether a team leans run or pass. It is the honest version — raw carry counts are inflated by quarterback scrambles and by teams running out the clock when ahead.

Write ONE or TWO sentences saying what kind of unit this is. Not how good — a rating already sits next to your words and says that. What KIND.

The useful things to say, when the evidence supports them:
- How they play, judged from passPlayShare. A team that passes noticeably less than the median leans on the run; noticeably more, they throw. Close to it, say nothing about balance — most teams are unremarkable here and pretending otherwise is worse than silence.
- If quarterbackRunsALot is true, the interesting fact is that the quarterback is a major part of the running game, NOT that the team is run-heavy.
- Who it runs through. Name the player the unit is built around if the evidence points at one.
- What just changed, and what it points to. A new head coach or a move in the list are signals about direction. A key player drafted by another club is a weaker hint — it tells you he was acquired at some point, not recently. A unit that ran a lot under a coach who has since been fired may not run a lot now, and saying so is more useful than repeating last year's split.

Hard rules:
- Never state a number that is not in the evidence. You are given tiers, not figures, so describe in plain words: "among the teams that run the most" rather than a count.
- Do not restate the rank. "Fourth-best for points scored" already appears directly above your sentence; repeating it wastes the only two sentences you get.
- Do NOT pass judgement on the unit overall — no "middling", "strong", "poor", "ordinary", "unremarkable" about the unit as a whole. The rating beside you already says how good it is, and one of these words next to four dots out of five reads as a contradiction. Describe traits instead: what they do a lot of, what they do well, what they don't.
- You MAY say a specific thing is a weakness ("rarely gets to the quarterback") when a tier supports it. That is a trait, not a verdict on the unit.
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

for (const slice of chunk(batch, CHUNK)) {
  let data, usage;
  try {
    ({ data, usage } = await generateJson({
      label: "write-unit-notes",
      model: MODELS.prose,
      system: SYSTEM,
      user: `Write one entry per unit.\n\n${JSON.stringify(
        slice.map((t) => ({ key: t.subject, ...t.evidence })),
        null,
        2,
      )}`,
      schema,
      maxTokens: 8000,
      effort: "medium",
    }));
  } catch (err) {
    if (!isNoResult(err)) throw err;
    console.error(`${err.message}. Skipping this batch.`);
    continue;
  }
  const asked = new Set(slice.map((t) => t.subject));
  for (const n of data.notes ?? []) if (asked.has(n.key)) results.set(n.key, n.blurb);
  tokensIn += usage.input;
  tokensOut += usage.output;
}

// --- validation and storage ------------------------------------------------

// The guards live in scripts/lib/unit-note-validation.mjs so they can be tested
// without an API key. New text gets problemWithNote plus the repeatsCoaching
// style rule. An out-of-date note — one
// written for evidence that has since moved — may stay up until its
// replacement validates only if it passes the stricter problemWithStaleNote,
// which also requires every person it names to be in the unit or coaching the
// team today. problemWithNote alone doesn't check names (only an arrival
// claim's), so it let a note naming last year's starter stand: New Orleans once
// kept describing a receiver who had left the depth chart. §9's bargain is a
// missing entry, never a wrong one, so a note that fails is removed.
// repeatsCoaching is a style rule and stays out of the stale check: an existing
// note that names the coach is repetitive, not wrong, so it may stay up until a
// replacement validates rather than leaving a gap.
const validate = (text, subject) =>
  problemWithNote(text, evidenceOf.get(subject)) ?? repeatsCoaching(text, evidenceOf.get(subject));
const validateStale = (text, subject) => problemWithStaleNote(text, evidenceOf.get(subject));

if (SELF_TEST) {
  for (const item of batch) {
    const blurb = results.get(item.subject);
    const problem = blurb ? validate(blurb, item.subject) : "no response";
    console.log(`  ${item.subject}\n    ${problem ? `REJECTED (${problem})` : "ok"}: "${blurb ?? ""}"`);
  }
  console.log("\n(self-test: nothing written)");
  if (results.size === 0) process.exit(1);
} else {
  const { section, log } = settle(prose.units, wanted, results, validate, validateStale);
  prose.units = section;
  writeCache(prose);
  printLog("unit notes", log);
}
if (tokensIn) console.log(`tokens: ${tokensIn} in, ${tokensOut} out`);

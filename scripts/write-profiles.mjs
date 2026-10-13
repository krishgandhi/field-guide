/**
 * Write the one-line description on each player's profile card, using Claude.
 *
 * Runs after fetch-people.mjs. Lines live in src/data/prose-cache.json under
 * "profiles", keyed on the coarse evidence below and the prompt version, so a
 * sentence is generated once per person and again only when something a
 * reader would notice changes — a new award, a new team (§13). Without an
 * API key this still runs: it prunes people no move names any more and drops
 * any old line that no longer validates.
 *
 * IT CHARACTERISES, BUT ONLY FROM SUPPLIED EVIDENCE.
 *
 * The first version banned characterisation outright, and the lines came out
 * as database rows: "picked seventh overall in 2018, now in his ninth season."
 * True, useless. What a newcomer needs is that Josh Allen is one of the best
 * quarterbacks alive and runs like a running back — that IS the translation
 * layer, and refusing to do it missed the point of the product.
 *
 * The fix is evidence, not licence. The model gets awards (Allen's MVP),
 * career totals floored to "at least" figures (at least 4,000 career rushing
 * yards for a quarterback — see scripts/lib/profile-evidence.mjs), and
 * this site's own already-sourced prose about the person. It may say anything
 * that evidence supports, and nothing it doesn't. A thin résumé gets a factual
 * line — that restraint is the point.
 *
 * Note this does NOT make the card a stats page (§1). The numbers go in and
 * meaning comes out; the card itself still displays no statistics.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npm run write:profiles
 */

import { readFileSync, existsSync } from "node:fs";
import { MODELS, generateJson, hasKey, isNoResult } from "./lib/claude.mts";
import { readMoves } from "./lib/moves.mts";
import { problemWithBlurb, profileEvidence } from "./lib/profile-evidence.mjs";
import {
  needsWriting,
  printLog,
  proseKey,
  readCache,
  settle,
  writeCache,
} from "./lib/prose-cache.mts";

const PEOPLE = "src/data/people.json";

/**
 * Bump when the brief below changes materially, so existing lines are rewritten.
 * The evidence hash only catches changes in the FACTS; without this, a better
 * prompt would never reach the players already done.
 */
const PROMPT_VERSION = 3;

/** --self-test: one fixture person through the real API, writing nothing. */
const SELF_TEST = process.argv.includes("--self-test");

const FIXTURE = {
  id: "self-test",
  name: "Devon Witherspoon",
  position: "Cornerback",
  positionShort: "CB",
  team: "Seattle Seahawks",
  age: 25,
  height: "6' 0\"",
  weight: "185 lbs",
  experience: "4th Season",
  draft: "2023: Rd 1, Pk 5 (SEA)",
  college: "Illinois",
};

if (SELF_TEST && !hasKey()) {
  console.log("Self-test needs ANTHROPIC_API_KEY.");
  process.exit(1);
}
if (!SELF_TEST && !existsSync(PEOPLE)) {
  console.log("No people cache. Run fetch-people.mjs first.");
  process.exit(0);
}

const cache = SELF_TEST
  ? { people: { "self-test": FIXTURE } }
  : JSON.parse(readFileSync(PEOPLE, "utf8"));

/**
 * Whatever this site already says about the person — all of it sourced.
 *
 * Includes the rubric notes, not just the summary, because that is where the
 * checkable claims live. ESPN's awards feed only carries major honours, so
 * Devon Witherspoon comes back with none despite three Pro Bowls — and his
 * entry says "named to the Pro Bowl three times" in a rubric note.
 */
function contextFor(id) {
  const lines = [];
  for (const { summary, move } of readMoves()) {
    if (!move.people.includes(id)) continue;
    if (summary) lines.push(summary);
    for (const { note } of move.rubric) {
      if (note) lines.push(String(note).split(/\s+/).filter(Boolean).join(" "));
    }
  }
  return lines;
}

/** Everyone with a name, with the evidence their line is written from. */
const wanted = Object.values(cache.people)
  .filter((p) => p.name)
  .map((p) => {
    const evidence = profileEvidence(p, contextFor(p.id));
    return { subject: p.id, key: proseKey(PROMPT_VERSION, evidence), evidence, person: p };
  });
const byId = new Map(wanted.map((w) => [w.subject, w]));
const prose = readCache();

const todo = SELF_TEST ? wanted : needsWriting(prose.profiles, wanted);
if (!hasKey()) {
  console.log(`No ANTHROPIC_API_KEY — ${todo.length} profile line(s) would be written; checking existing ones only.`);
} else if (todo.length === 0) {
  console.log("Every profile line is current. Nothing to generate.");
} else {
  console.log(`${todo.length} profile line(s) to write.\n`);
}

const SYSTEM = `You introduce an NFL player to someone who has watched a bit of football, does not follow it closely, and has never heard of this person.

You get his record (position, age, size, draft, college, experience, team), his awards, his career totals as "at least" figures (careerTotalsAtLeast: 4000 means at least four thousand), and sentences about him from articles on this site. That is your evidence. You have no other knowledge of him and must not draw on any you think you have.

Write TWO sentences:
1. Who he is — position, where he was drafted, how far into his career he is.
2. What kind of player he is, and how good.

The second sentence is the one that matters. "Picked seventh overall in 2018" tells the reader nothing useful; "one of the best quarterbacks in the league, and he runs almost as much as he throws" is what they came for. Say it plainly.

Ground every judgement in the evidence:
- An MVP or a major award earns "one of the best" outright.
- Pro Bowls mentioned in the site sentences count as evidence too.
- Heavy rushing volume for a quarterback earns "runs a lot". A high yards-per-attempt earns "throws downfield". Big tackle totals for a defensive back earn "busy" or "physical".
- If the evidence is thin — a young player, few starts, no awards — SAY SO plainly, or stay factual. "Still early in his career and yet to establish himself" is a good, honest line. Do not inflate someone the evidence does not support. This restraint matters more than sounding impressive.

Hard rules:
- Never state a number that is not in the supplied evidence.
- Use AT MOST two figures, and spell them out: "more than four thousand career rushing yards". Career totals are floors, so say "more than" or "at least", never an exact total. A line that ends in a list of totals reads like a stat sheet, which is the thing this site replaces. One vivid number beats four.
- Do not repeat his name — the card shows it directly above your sentences.
- Plain spoken English, 45 to 65 words total, never more than 75, ending in a full stop. Anything longer is thrown away and the player gets no line at all — Aaron Donald's first attempt ran to 88 and was lost.
- Explain a position the first time it would puzzle someone: "a centre, the lineman who snaps the ball". This gloss is the FIRST thing to cut if you are near the word limit — a long, decorated career needs the words more than the definition does, and running over loses the whole line.
- No jargon a newcomer wouldn't know, and no fantasy-football framing.`;

const schema = {
  type: "object",
  properties: {
    profiles: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, blurb: { type: "string" } },
        required: ["id", "blurb"],
        additionalProperties: false,
      },
    },
  },
  required: ["profiles"],
  additionalProperties: false,
};

const results = new Map();
let usage = null;
if (hasKey() && todo.length > 0) {
  try {
    let profiles;
    ({ data: { profiles }, usage } = await generateJson({
      label: "write-profiles",
      model: MODELS.prose,
      system: SYSTEM,
      user: `Write one sentence for each.\n\n${JSON.stringify(
        todo.map((t) => t.evidence),
        null,
        2,
      )}`,
      schema,
      maxTokens: 8000,
      effort: "medium",
    }));
    const asked = new Set(todo.map((t) => t.subject));
    for (const { id, blurb } of profiles ?? []) if (asked.has(id)) results.set(id, blurb);
  } catch (err) {
    if (!isNoResult(err)) throw err;
    console.error(`${err.message}. No lines written.`);
  }
}

// --- validation and storage ------------------------------------------------

// The guard lives in scripts/lib/profile-evidence.mjs so it can be tested
// without a key. It also decides whether an out-of-date line may stay up
// until a replacement validates — which is what fetch-people got wrong by
// deleting lines before anything replaced them.
const validate = (text, id) => {
  const w = byId.get(id);
  return problemWithBlurb(text, w.person, w.evidence.mentionedOnSiteAs);
};

if (SELF_TEST) {
  for (const t of todo) {
    const blurb = results.get(t.subject);
    const problem = blurb ? validate(blurb, t.subject) : "no response";
    console.log(`  ${t.person.name}\n    ${problem ? `REJECTED (${problem})` : "ok"}: "${blurb ?? ""}"`);
  }
  console.log("\n(self-test: nothing written)");
  if (results.size === 0) process.exit(1);
} else {
  const { section, log } = settle(prose.profiles, wanted, results, validate);
  prose.profiles = section;
  writeCache(prose);
  printLog("profile lines", log);
}
if (usage) console.log(`tokens: ${usage.input} in, ${usage.output} out`);

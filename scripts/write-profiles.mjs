/**
 * Write the one-line description on each player's profile card, using Claude.
 *
 * Runs after fetch-people.mjs and fills in the `blurb` for anyone who lacks
 * one. Cached in src/data/people.json, so a sentence is generated once per
 * person rather than per build (§13).
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
 * career and season splits (4,721 career rushing yards for a quarterback), and
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

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { numbersIn, sentenceCount } from "./lib/draft-validation.mjs";

const PEOPLE = "src/data/people.json";
const MOVES = "content/moves";

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

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("No ANTHROPIC_API_KEY — no profile lines written.");
  process.exit(0);
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
  for (const file of readdirSync(MOVES).filter((f) => f.endsWith(".mdx"))) {
    const raw = readFileSync(path.join(MOVES, file), "utf8");
    if (!raw.includes(`"${id}"`)) continue;
    const summary = raw.match(/^summary: (.+)$/m)?.[1];
    if (summary) lines.push(summary);
    for (const note of raw.matchAll(/^ {6}note: >-\n((?: {8}.*\n)+)/gm)) {
      lines.push(note[1].split(/\s+/).filter(Boolean).join(" "));
    }
  }
  return lines;
}

const todo = Object.values(cache.people).filter((p) => !p.blurb && p.name);
if (todo.length === 0) {
  console.log("Every profile already has a line. Nothing to generate.");
  process.exit(0);
}
console.log(`${todo.length} profile line(s) to write.\n`);

const client = new Anthropic();

const SYSTEM = `You introduce an NFL player to someone who has watched a bit of football, does not follow it closely, and has never heard of this person.

You get his record (position, age, size, draft, college, experience, team), his awards, his career and season statistics, and sentences about him from articles on this site. That is your evidence. You have no other knowledge of him and must not draw on any you think you have.

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
- Never state a number that is not in the supplied evidence. Prefer words to figures anyway: "more than four thousand career rushing yards" is fine, an invented completion percentage is not.
- Do not repeat his name — the card shows it directly above your sentences.
- Plain spoken English, roughly 45 to 65 words total, ending in a full stop.
- Explain a position the first time it would puzzle someone: "a centre, the lineman who snaps the ball".
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

const input = todo.map((p) => ({
  id: p.id,
  position: p.position,
  age: p.age,
  height: p.height,
  weight: p.weight,
  experience: p.experience,
  draft: p.draft,
  college: p.college,
  currentTeam: p.team,
  awards: p.awards ?? [],
  careerStats: p.career ?? {},
  lastSeasonStats: p.season ?? {},
  mentionedOnSiteAs: contextFor(p.id),
}));

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
      content: `Write one sentence for each.\n\n${JSON.stringify(input, null, 2)}`,
    },
  ],
});

if (response.stop_reason === "refusal") {
  console.error(
    `Model declined (${response.stop_details?.category ?? "unknown"}). No lines written.`,
  );
  process.exit(0);
}
const payload = response.content.find((b) => b.type === "text")?.text;
if (!payload) {
  console.error("No text block in response. No lines written.");
  process.exit(0);
}
const { profiles } = JSON.parse(payload);

// --- validation ------------------------------------------------------------

const byId = new Map(todo.map((p) => [p.id, p]));

/** Everything wrong with a line, or null. Exported shape mirrors the others. */
export function problemWithBlurb(text, person, context = []) {
  const trimmed = String(text ?? "").trim();
  const words = trimmed.split(/\s+/).length;
  // Two sentences now: one placing him, one saying what kind of player he is.
  if (words < 25 || words > 75) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  const sentences = sentenceCount(trimmed);
  if (sentences > 3) return `${sentences} sentences, expected two`;

  // Every figure must come from something we supplied — the ESPN record OR the
  // site's own already-sourced prose, which is handed over as context.
  //
  // The first run rejected four correct lines because this only allowed the
  // ESPN record: $12m, $67.5m and $132m all came from our own entries. Giving
  // the model context and then refusing to let it use that context is a bug in
  // the guard, not a fault in the output.
  const allowed = new Set(
    numbersIn(
      [
        person.draft,
        person.age,
        person.experience,
        person.height,
        person.weight,
        // Awards and stats are evidence the model is meant to use, so their
        // figures have to be allowed through the same guard.
        JSON.stringify(person.awards ?? []),
        JSON.stringify(person.career ?? {}),
        JSON.stringify(person.season ?? {}),
        ...context,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  );
  // Ordinals the model legitimately writes out: "fifth overall" has no digits,
  // but "2023" and "5" both come from the draft string, so this stays tight.
  const invented = numbersIn(trimmed).filter((n) => !allowed.has(n));
  if (invented.length > 0) return `invented figures: ${invented.join(", ")}`;

  if (person.name && trimmed.includes(person.name.split(" ").at(-1))) {
    return "repeats his name, which the card already shows";
  }
  return null;
}

let accepted = 0;
const rejected = [];

for (const { id, blurb } of profiles ?? []) {
  const person = byId.get(id);
  if (!person) {
    rejected.push(`unknown id ${id}`);
    continue;
  }
  const problem = problemWithBlurb(blurb, person, contextFor(id));
  if (problem) {
    rejected.push(`${person.name}: ${problem} — "${blurb}"`);
    continue;
  }
  cache.people[id].blurb = blurb.trim();
  accepted++;
  console.log(`  ${person.name}\n    "${blurb.trim()}"`);
}

if (!SELF_TEST) {
  cache.profilesWrittenAt = new Date().toISOString();
  writeFileSync(PEOPLE, `${JSON.stringify(cache, null, 2)}\n`);
} else {
  console.log("\n(self-test: nothing written)");
}

console.log(`\n${accepted}/${todo.length} accepted`);
for (const r of rejected) console.log(`  rejected — ${r}`);
console.log(
  `tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`,
);

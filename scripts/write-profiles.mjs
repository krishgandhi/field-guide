/**
 * Write the one-line description on each player's profile card, using Claude.
 *
 * Runs after fetch-people.mjs and fills in the `blurb` for anyone who lacks
 * one. Cached in src/data/people.json, so a sentence is generated once per
 * person rather than per build (§13).
 *
 * THE LINE EXPLAINS THE FIELDS. IT DOES NOT ADD SCOUTING KNOWLEDGE.
 *
 * "A first-round corner in his fourth season" is a translation of
 * "2023: Rd 1, Pk 5" into English, which is precisely this product's job.
 * "A press corner who plays bigger than his size" is outside knowledge about a
 * real person that nothing here can check — the confident-error failure §1 and
 * §3 exist to prevent. The model gets the ESPN record and the move entry's own
 * already-sourced prose, and nothing else.
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

/** Whatever the entries already say about this person — sourced prose. */
function contextFor(id) {
  const lines = [];
  for (const file of readdirSync(MOVES).filter((f) => f.endsWith(".mdx"))) {
    const raw = readFileSync(path.join(MOVES, file), "utf8");
    if (!raw.includes(`"${id}"`)) continue;
    const summary = raw.match(/^summary: (.+)$/m)?.[1];
    if (summary) lines.push(summary);
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

const SYSTEM = `You write one sentence introducing an NFL player to someone who has watched a bit of football but does not follow it closely and has never heard of this person.

You are given that player's record: position, age, size, draft, college, experience, current team. You may also be given sentences from articles on the site that mention him.

Rules, all of them hard:
- Use ONLY the facts supplied. You know nothing else about this player, and you must not draw on anything you may recall about him.
- Do NOT characterise how he plays. "A press corner who plays bigger than his size" is a scouting opinion you cannot support from a draft position. Translate the record instead: what being a first-round pick means, how far into his career he is, what his position does.
- Never state a number that is not in the supplied record. No statistics at all.
- One sentence, roughly 12 to 28 words, ending in a full stop.
- Plain spoken English. Say "picked fifth overall" rather than "Rd 1, Pk 5".
- Do not repeat his name — the card shows it directly above your sentence.
- No jargon a newcomer wouldn't know.`;

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
  // 40, not 34: the first run rejected a genuinely good line at 36 words
  // because it paused to explain what a centre does — which is the entire job
  // of this site, not padding.
  if (words < 8 || words > 40) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  if (sentenceCount(trimmed) > 1) return "more than one sentence";

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

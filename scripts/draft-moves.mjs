/**
 * Turn detected candidates into move entries, using Claude.
 *
 * Runs after detect-moves.mjs, and PUBLISHES what passes validation. Krish
 * doesn't want to run a command to see the news; he wants to open the site and
 * find it there. So the gate is mechanical rather than human.
 *
 * Everything written here carries `verified: false`, which renders a visible
 * "not checked yet" badge. That is the honest trade: the entry is there
 * immediately, and the reader is told plainly that nobody has been through it.
 *
 * A draft that FAILS validation goes to content/moves/_drafts/ instead, which
 * the loader cannot see — getSlugs filters readdirSync on ".mdx" and a
 * directory name never matches. So the failure mode is a missing entry, never
 * a wrong one. `npm run drafts` lists what got held back.
 *
 * The model's most useful output is often "skip". Deciding that a headline
 * isn't a Moves entry is exactly the judgement a regex can't make, and most
 * candidates should be skipped.
 *
 * The hard rule, enforced mechanically below: every number in the draft must
 * appear in the source headline or description. An invented cap figure or draft
 * pick is the "confidently wrong" failure the whole product exists to avoid
 * (§1, §3), and it's the one failure mode that is cheap to check.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npm run draft:moves
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { isSensitive, problemsWith, yamlFold } from "./lib/draft-validation.mjs";

const CANDIDATES = "src/data/move-candidates.json";
const PUBLISHED = "content/moves";
/** Where a draft goes when it fails validation — never rendered by the site. */
const HELD = "content/moves/_drafts";

/**
 * --self-test: exercise the API call against a fixture and write nothing.
 *
 * Out of season the detector correctly finds nothing for months, which means
 * the Anthropic call in this script can sit unexercised until the day it
 * matters. That is how the reasonsWrittenAt bug reached production — a step
 * that never ran was a step never validated. This proves the key works and the
 * request shape is still accepted, on demand, without touching the repo.
 *
 * The fixture player is fictional on purpose: a real name with invented
 * contract terms would be misinformation, which is the whole thing this
 * pipeline is built to avoid.
 */
const SELF_TEST = process.argv.includes("--self-test");

const FIXTURE = [
  {
    id: "self-test",
    headline:
      "Springfield Atoms trade QB Rex Fictional to the Shelbyville Ferrets for 3 draft picks",
    description:
      "The Ferrets sent a 2027 first round pick and 2 later selections for the 28 year old quarterback, who signed a 4 year extension worth $50 million.",
    published: "2026-08-13",
    teams: ["Springfield Atoms"],
    // Real ids so the self-test exercises the write path; the event is fake
    // and nothing is written to disk.
    teamIds: ["LAR", "SEA"],
    athletes: ["Rex Fictional"],
    url: "https://www.espn.com/nfl/",
  },
];

// No key: exit clean. Same posture as write-reasons.mjs — this is the normal
// state locally and on a fork, not an error.
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("No ANTHROPIC_API_KEY — no drafts written.");
  process.exit(0);
}

let candidates;
if (SELF_TEST) {
  console.log("Self-test: calling the API with a fixture. Nothing will be written.\n");
  candidates = FIXTURE;
} else {
  if (!existsSync(CANDIDATES)) {
    console.log("No candidates file. Run detect-moves.mjs first.");
    process.exit(0);
  }
  ({ candidates = [] } = JSON.parse(readFileSync(CANDIDATES, "utf8")));
  if (candidates.length === 0) {
    console.log("No candidates to draft.");
    process.exit(0);
  }
}

const client = new Anthropic();

const SYSTEM = `You apply a fixed rubric to NFL transactions for a site that explains the sport to a newcomer.

You will be given news headlines. For each one, decide whether it is a genuine roster move worth a written entry — a trade, a significant signing or extension, a release, a franchise tag, a notable restructure. Most headlines are NOT. Season previews, position battles, injury updates, opinion pieces and anything about a marginal player should be skipped.

When you skip, say so and give a one-line reason. Skipping is a good outcome; do not stretch to justify an entry.

When you do write one, score all six axes of this rubric 1-5, each with AT MOST TWO SENTENCES:

1. Player quality — how good is he actually
2. Positional value — quarterback dominates everything; edge rusher, offensive tackle and cornerback next; running back, guard and centre move the needle far less
3. Cost paid — picks and players surrendered
4. Cap mechanics — restructures, bonuses, dead money, accounting dates like June 1
5. Competitive windows — is this team going for it now or building for later
6. Narrative violation — did someone reverse a public position

Also give a "bigness" 1-5. This is NOT the average of the axes — averaging inflates routine moves. It is a judgement about how much the move actually matters. A record contract for a guard or centre is still a low number.

Each candidate lists the players involved with their real positions. USE THEM — positional value is the axis that decides everything, and guessing it from the headline is how a cornerback ends up scored as a neutral mid-tier player.

Set "teams" to the clubs actually party to the move, chosen from the candidate's teamIds. A player visiting four clubs before signing for one is a move between two of them, not five.

If the story touches charges, an arrest, an investigation, a lawsuit or a suspension, you MUST also state that the person denies it or has not been convicted, wherever the source supports it. An accusation without the answer to it is unfair and will be rejected.

ABSOLUTE RULES:
- Use ONLY facts present in the headline and description you are given. You have no other knowledge of this event.
- Every number you write must appear in the supplied text. Do not state a contract figure, a draft pick, a year or an age that is not there. If you don't have the number, write around it.
- Never reproduce sentences from the source. Summarise in your own words.
- Plain English. No jargon a newcomer wouldn't know, and no words like "leverage", "efficiency" or "seeding".
- The summary is ONE sentence saying why a newcomer should care.
- The body is two short paragraphs: what it means, and why it matters to a Buffalo Bills fan if it genuinely does.`;

const schema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          skip: { type: "boolean" },
          skipReason: { type: "string" },
          slug: {
            type: "string",
            description: "kebab-case, no date prefix, e.g. henry-extension",
          },
          title: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "trade", "signing", "contract", "release",
              "role", "injury", "coaching",
            ],
          },
          summary: { type: "string" },
          // No minimum/maximum: structured outputs reject those on integers
          // ("For 'integer' type, properties maximum, minimum are not
          // supported"). The range goes in the description for the model and
          // is enforced for real in problemsWith().
          bigness: { type: "integer", description: "1 to 5" },
          teams: {
            type: "array",
            items: { type: "string" },
            description:
              "Only the clubs party to the move, chosen from the candidate's teamIds. Two or three at most.",
          },
          rubric: {
            type: "array",
            items: {
              type: "object",
              properties: {
                axis: {
                  type: "string",
                  enum: [
                    "Player quality",
                    "Positional value",
                    "Cost paid",
                    "Cap mechanics",
                    "Competitive windows",
                    "Narrative violation",
                  ],
                },
                score: { type: "integer", description: "1 to 5" },
                note: { type: "string" },
              },
              required: ["axis", "score", "note"],
              additionalProperties: false,
            },
          },
          body: { type: "string" },
        },
        required: ["id", "skip"],
        additionalProperties: false,
      },
    },
  },
  required: ["entries"],
  additionalProperties: false,
};

const response = await client.beta.messages.create({
  model: "claude-opus-5",
  max_tokens: 16000,
  system: SYSTEM,
  // Higher effort than write-reasons: this is a judgement task (is it a move
  // at all, and how big), not a short writing task.
  output_config: { effort: "high", format: { type: "json_schema", schema } },
  thinking: { type: "adaptive" },
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  messages: [
    {
      role: "user",
      content: `Assess each candidate.\n\n${JSON.stringify(candidates, null, 2)}`,
    },
  ],
});

// Check before reading content: a refusal returns HTTP 200 with empty or
// partial content, and indexing into it blind would throw.
if (response.stop_reason === "refusal") {
  console.error(
    `Model declined (${response.stop_details?.category ?? "unknown"}). No drafts written.`,
  );
  process.exit(0);
}

const payload = response.content.find((b) => b.type === "text")?.text;
if (!payload) {
  console.error("No text block in response. No drafts written.");
  process.exit(0);
}

const { entries } = JSON.parse(payload);

if (!SELF_TEST) mkdirSync(HELD, { recursive: true });

let written = 0;
let skipped = 0;
let rejected = 0;

for (const entry of entries) {
  const candidate = candidates.find((c) => c.id === entry.id);
  if (!candidate) continue;

  if (entry.skip) {
    skipped++;
    console.log(`  skip   ${candidate.headline}`);
    console.log(`         ${entry.skipReason ?? "no reason given"}`);
    continue;
  }

  const problems = problemsWith(entry, candidate);

  // Held, not discarded: a rejected draft is still a signal that something
  // happened, and it may only need one line fixing by hand.
  const held = problems.length > 0;

  const date = candidate.published || new Date().toISOString().slice(0, 10);
  const slug = `${date.slice(0, 7)}-${entry.slug}`;
  // The model picks which of ESPN's tagged clubs are actually party to the
  // move; problemsWith has already checked they're a subset, so there is
  // nothing invented here.
  const teams = entry.teams ?? [];

  const sensitive =
    isSensitive(`${entry.summary} ${entry.body}`) ||
    isSensitive(`${candidate.headline} ${candidate.description}`);

  const mdx = `---
title: ${entry.title}
slug: ${slug}
type: moves
summary: ${entry.summary}
reviewed: false
lastUpdated: ${new Date().toISOString().slice(0, 10)}
move:
  date: "${date}"
  kind: ${entry.kind}
  teams: [${teams.join(", ")}]
  bigness: ${entry.bigness}
  # Machine-written from a single headline. verified stays false until a human
  # has read it against the reporting linked below.
  verified: false
  sensitive: ${sensitive}
  sources:
    - label: ESPN
      url: ${candidate.url}
  people: [${(candidate.players ?? [])
    .map((pl) => pl.id)
    .filter(Boolean)
    .map((id) => `"${id}"`)
    .join(", ")}]
  rubric:
${(entry.rubric ?? [])
  .map(
    (r) =>
      `    - axis: ${r.axis}\n      score: ${r.score}\n      note: >-\n${yamlFold(r.note)}`,
  )
  .join("\n")}
---

${entry.body.trim()}
`;

  if (SELF_TEST) {
    written++;
    console.log(
      `  would ${held ? "HOLD" : "publish"} ${slug}.mdx  (self-test: not written)`,
    );
    if (held) for (const p of problems) console.log(`         ${p}`);
    console.log(`\n${mdx}`);
    continue;
  }

  if (held) {
    writeFileSync(`${HELD}/${slug}.mdx`, mdx);
    rejected++;
    console.log(`  HELD    ${slug}.mdx`);
    for (const p of problems) console.log(`          ${p}`);
    continue;
  }

  writeFileSync(`${PUBLISHED}/${slug}.mdx`, mdx);
  written++;
  console.log(`  publish ${slug}.mdx${sensitive ? "  (sensitive)" : ""}`);
}

console.log(
  `\n${written} published, ${skipped} skipped by the model, ${rejected} held for review.`,
);
// Logged because write-reasons.mjs logs it and this one didn't, which made the
// spend impossible to attribute between them. This is the pricier of the two:
// high effort plus adaptive thinking, and thinking bills as output.
console.log(
  `tokens: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`,
);
if (rejected > 0) {
  console.log(`Held entries are in ${HELD}/ and are NOT on the site. npm run drafts lists them.`);
}

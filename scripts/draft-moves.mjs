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
import { MODELS, generateJson, hasKey } from "./lib/claude.mts";
import { isSensitive, problemsWith } from "./lib/draft-validation.mjs";
import { buildMoveFile, moveFileProblems } from "./lib/move-file.mjs";
import { sanitiseSlug, targetFor } from "./lib/move-output.mjs";
import { chunk } from "./lib/prose-cache.mts";
import { MAX_ATTEMPTS, addGivenUp, attemptedIn, recordAttempts } from "./lib/move-worklist.mjs";

/**
 * Candidates per request.
 *
 * All of them used to go in one request with a 16k-token budget: forty
 * candidates, each answer carrying six rubric notes and a body, could not fit,
 * and nothing checked whether the answer had been cut off. Six fits with
 * room to spare, and one bad batch costs six candidates an attempt, not all.
 */
const BATCH_SIZE = 6;
/**
 * Batches per run, to bound a day's spend after a long outage. What doesn't
 * fit waits for tomorrow — it stays on the worklist, it isn't dropped.
 */
const MAX_BATCHES = 4;

const CANDIDATES = "src/data/move-candidates.json";
/**
 * Detection deliberately leaves candidates unseen (see detect-moves.mjs), so
 * this script owns retiring them. A candidate is seen once it has an outcome —
 * published, held, or judged not a move. If this script never runs, nothing is
 * retired and the candidate comes back tomorrow, which is the behaviour that
 * was missing when the API balance ran out and Aaron Donald's signing was
 * quietly dropped.
 */
const SEEN = "src/data/seen-news.json";
const SEEN_LIMIT = 500;
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
if (!hasKey()) {
  console.log("No ANTHROPIC_API_KEY — no drafts written.");
  process.exit(0);
}

let candidates;
let worklistFile = { candidates: [], givenUp: [] };
if (SELF_TEST) {
  console.log("Self-test: calling the API with a fixture. Nothing will be written.\n");
  candidates = FIXTURE;
} else {
  if (!existsSync(CANDIDATES)) {
    console.log("No candidates file. Run detect-moves.mjs first.");
    process.exit(0);
  }
  worklistFile = { candidates: [], givenUp: [], ...JSON.parse(readFileSync(CANDIDATES, "utf8")) };
  candidates = worklistFile.candidates;
  if (candidates.length === 0) {
    console.log("No candidates to draft.");
    process.exit(0);
  }
}

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

const batches = chunk(candidates, BATCH_SIZE);
const thisRun = batches.slice(0, MAX_BATCHES);
if (batches.length > thisRun.length) {
  const waiting = batches.slice(MAX_BATCHES).flat();
  console.log(`${waiting.length} candidate(s) wait for the next run (cap of ${MAX_BATCHES} batches per run).`);
}

/** Every entry the model returned, across batches. */
const entries = [];
/**
 * Candidates the model actually answered for and left without an outcome —
 * see attemptedIn for why a failed request doesn't count.
 */
const attempted = new Set();
const usage = { input: 0, output: 0 };

for (const [i, batch] of thisRun.entries()) {
  try {
    const { data, usage: u } = await generateJson({
      label: `draft-moves ${i + 1}/${thisRun.length}`,
      model: MODELS.moveDrafts,
      system: SYSTEM,
      user: `Assess each candidate.\n\n${JSON.stringify(batch, null, 2)}`,
      schema,
      maxTokens: 16000,
      // Higher effort than write-reasons: this is a judgement task (is it a
      // move at all, and how big), not a short writing task.
      effort: "high",
      thinking: true,
    });
    usage.input += u.input;
    usage.output += u.output;
    const ids = new Set(batch.map((c) => c.id));
    const answered = (data.entries ?? []).filter((e) => ids.has(e.id));
    entries.push(...answered);
    const missing = attemptedIn(batch, { answered: new Set(answered.map((e) => e.id)) });
    for (const id of missing) attempted.add(id);
    for (const c of batch.filter((c) => missing.includes(c.id))) {
      console.log(`  no answer for ${c.id} — ${c.headline}`);
    }
  } catch (err) {
    // Truncated, overloaded, timed out or a network failure: no attempt is
    // counted, and the batch simply waits for tomorrow. Only a refusal
    // counts, since that is an answer. A rejected key never reaches here —
    // generateJson exits the process, so it fails the job loudly.
    for (const id of attemptedIn(batch, { error: err })) attempted.add(id);
    console.error(`  batch ${i + 1} failed: ${err.message}`);
  }
}

// The self-test exists to prove the call works; a failed call must not pass.
if (SELF_TEST && entries.length === 0) {
  console.error("Self-test: the API call produced no entries.");
  process.exit(1);
}

if (!SELF_TEST) mkdirSync(HELD, { recursive: true });

let written = 0;
let skipped = 0;
let rejected = 0;
/** Candidate ids that reached an outcome and should not come back. */
const decided = [];

for (const entry of entries) {
  const candidate = candidates.find((c) => c.id === entry.id);
  if (!candidate) continue;

  if (entry.skip) {
    skipped++;
    decided.push(candidate.id);
    console.log(`  skip   ${candidate.headline}`);
    console.log(`         ${entry.skipReason ?? "no reason given"}`);
    continue;
  }

  // Held, not discarded: a rejected draft is still a signal that something
  // happened, and it may only need one line fixing by hand.
  const problems = problemsWith(entry, candidate);

  const date = candidate.published || new Date().toISOString().slice(0, 10);
  // Sanitised before any path is built: the model's slug is checked by
  // problemsWith (a bad one is held), but it must never reach the filesystem
  // as given — a "/" in it used to crash the run before anything was saved.
  const slug = `${date.slice(0, 7)}-${sanitiseSlug(entry.slug)}`;
  // The model picks which of ESPN's tagged clubs are actually party to the
  // move; problemsWith has already checked they're a subset, so there is
  // nothing invented here.
  const teams = entry.teams ?? [];

  const sensitive =
    isSensitive(`${entry.summary} ${entry.body}`) ||
    isSensitive(`${candidate.headline} ${candidate.description}`);

  const mdx = buildMoveFile({
    entry,
    candidate,
    slug,
    date,
    teams,
    sensitive,
    today: new Date().toISOString().slice(0, 10),
  });
  // Read the file back exactly as the build will. Anything the build would
  // reject is held, never published — one bad file used to fail every page.
  problems.push(...moveFileProblems(mdx, slug));
  // Never overwrite: a slug already published (committed, or written earlier
  // this run) is held under a free name instead of failing the job.
  const target = targetFor({ slug, held: problems.length > 0, publishedDir: PUBLISHED, heldDir: HELD });
  if (target.reason) problems.push(target.reason);
  const held = target.held;

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
    writeFileSync(target.file, mdx);
    rejected++;
    decided.push(candidate.id);
    console.log(`  HELD    ${target.file}`);
    for (const p of problems) console.log(`          ${p}`);
    continue;
  }

  writeFileSync(target.file, mdx);
  written++;
  decided.push(candidate.id);
  console.log(`  publish ${target.file}${sensitive ? "  (sensitive)" : ""}`);
}

let gaveUp = [];
if (!SELF_TEST) {
  // Retire what got an outcome; count an attempt for what was sent and came
  // back with nothing; give up at the cap rather than retrying for ever.
  const { remaining, givenUp } = recordAttempts(candidates, {
    decided: new Set(decided),
    attempted,
  });
  gaveUp = givenUp;
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    CANDIDATES,
    `${JSON.stringify(
      { ...worklistFile, candidates: remaining, givenUp: addGivenUp(worklistFile.givenUp ?? [], givenUp, today) },
      null,
      2,
    )}\n`,
  );
  // Given-up candidates are seen too, so detection doesn't re-propose them.
  const retired = [...decided, ...givenUp.map((c) => c.id)];
  if (retired.length > 0) {
    const seen = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, "utf8")) : [];
    const next = [...new Set([...retired, ...seen])].slice(0, SEEN_LIMIT);
    writeFileSync(SEEN, `${JSON.stringify(next, null, 2)}\n`);
  }
}

console.log(
  `\n${written} published, ${skipped} skipped by the model, ${rejected} held for review.`,
);
for (const c of gaveUp) {
  console.log(`  GAVE UP after ${MAX_ATTEMPTS} attempts: ${c.headline}`);
}
// Logged because write-reasons.mjs logs it and this one didn't, which made the
// spend impossible to attribute between them. This is the pricier of the two:
// high effort plus adaptive thinking, and thinking bills as output.
console.log(`tokens: ${usage.input} in, ${usage.output} out`);
if (rejected > 0) {
  console.log(`Held entries are in ${HELD}/ and are NOT on the site. npm run drafts lists them.`);
}

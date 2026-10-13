/**
 * Validation for Claude-drafted move entries.
 *
 * Split out of draft-moves.mjs so it can be tested without an API key. The
 * guardrails here are the only thing standing between a generated draft and a
 * confidently wrong statement about a real person, so they get a test.
 */

export const KINDS = [
  "trade", "signing", "contract", "release", "role", "injury", "coaching",
];

export const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

/**
 * Subjects where getting it wrong harms a real person, not just the rubric.
 *
 * These entries still publish — they're the news — but they carry a louder
 * badge and they have to clear the fairness rule below.
 */
const SENSITIVE = new RegExp(
  [
    // "charge" needs legal context. Bare \bcharges\b matched "the early-year
    // charges are modest" — a CAP charge — and held a routine contract
    // extension. Cap charge is core vocabulary on this site; the Garrett entry
    // uses it too.
    "criminal charges?",
    "felony charges?",
    "charged with",
    "facing (?:\\w+ )?charges",
    "press(?:ed|ing) charges",
    "drop(?:ped)? the charges",
    // Everything below is unambiguous on its own.
    "felony",
    "felonies",
    "arrest(?:ed)?",
    "indict\\w*",
    "lawsuit",
    "\\bsued\\b",
    "allegations?",
    "alleged\\w*",
    "assault",
    "domestic violence",
    "misconduct",
    "under investigation",
    "suspend(?:ed|s)?",
    "suspension",
    "\\bbanned\\b",
    "\\bDUI\\b",
    "convicted",
    "pleaded (?:not )?guilty",
  ].join("|"),
  "i",
);

/** Words that mean the accusation is answered or unproven. */
const BALANCING =
  /\b(denie[sd]|denial|not guilty|pleaded not guilty|pled not guilty|innocen\w+|unproven|not been convicted|no conviction|disputes?|contests?|awaiting trial|has not been charged|presumed innocent)\b/i;

export function isSensitive(text) {
  return SENSITIVE.test(String(text ?? ""));
}

/**
 * An accusation must not travel without the answer to it.
 *
 * The first real draft this pipeline produced said a player had "criminal
 * charges hanging over him" and stopped there. The reporting said he had
 * pleaded not guilty and denied it. Publishing the first half alone is unfair
 * to a real person, and no "unverified" badge fixes that — the badge says
 * nobody checked, when the problem is that the account is one-sided.
 *
 * So: if a draft raises an accusation, it must also carry the response. This
 * is a content rule, not a review gate — it costs the reader nothing and it
 * keeps a human out of the critical path.
 */
export function fairnessProblem(prose, sourceText) {
  if (!isSensitive(prose)) return null;
  if (BALANCING.test(prose)) return null;
  const sourceHasBalance = BALANCING.test(String(sourceText ?? ""));
  return sourceHasBalance
    ? "raises an accusation without the denial that is in the source"
    : "raises an accusation and neither it nor the source says it is unproven";
}

/** Numbers as a reader meets them: 67.5, 20, 2027. */
export function numbersIn(text) {
  return (String(text ?? "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * Sentence count that doesn't trip on "$67.5 million" or "A.J. Terrell Jr."
 *
 * Names are the common case in football writing and every period in one looked
 * like a full stop. That threw away seven perfectly good unit notes in a single
 * run — every rejection contained an initial or a suffix.
 */
export function sentenceCount(text) {
  return String(text ?? "")
    .replace(/\$?\d+(\.\d+)?/g, "N")
    // A period after a lone capital is an initial, never a full stop:
    // "A.J.", "C.J.", "J.J.". The word boundary keeps "LA." safe, since the
    // A there isn't at a boundary.
    .replace(/(\b[A-Z])\./g, "$1")
    // Suffixes and titles that carry a period mid-sentence.
    .replace(/\b(Jr|Sr|St|Mr|Mrs|Dr|vs|No|Inc)\./g, "$1")
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Everything wrong with a drafted entry, as a list of strings. Empty means it
 * can be written to _drafts/.
 *
 * The first check is the one that matters. The model is given a headline and a
 * description and nothing else, so any number in its output that isn't in that
 * text was invented — a fabricated contract figure or draft pick is exactly
 * the failure CLAUDE.md §1 and §3 exist to prevent, and unlike tone or
 * judgement it can be checked mechanically.
 */
export function problemsWith(entry, candidate) {
  const problems = [];

  const sourceNumbers = new Set(
    numbersIn(`${candidate.headline ?? ""} ${candidate.description ?? ""}`),
  );
  const prose = [
    entry.summary,
    entry.body,
    ...(entry.rubric ?? []).map((r) => r.note),
  ].join(" ");
  const invented = numbersIn(prose).filter((n) => !sourceNumbers.has(n));
  if (invented.length > 0) {
    problems.push(`invented figures not in the source: ${invented.join(", ")}`);
  }

  if (!entry.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.slug)) {
    problems.push(`bad slug: ${entry.slug}`);
  }
  if (!entry.title?.trim()) problems.push("no title");
  if (!KINDS.includes(entry.kind)) problems.push(`kind "${entry.kind}" is not valid`);
  if (!entry.summary || sentenceCount(entry.summary) !== 1) {
    problems.push("summary must be exactly one sentence");
  }
  if (!Number.isInteger(entry.bigness) || entry.bigness < 1 || entry.bigness > 5) {
    problems.push(`bigness ${entry.bigness} outside 1–5`);
  }

  const rubric = entry.rubric ?? [];
  if (rubric.length !== AXES.length) {
    problems.push(`${rubric.length} axes, need ${AXES.length}`);
  } else if (rubric.map((r) => r.axis).join("|") !== AXES.join("|")) {
    problems.push("axes out of §7 order");
  }
  for (const r of rubric) {
    // Enforced here rather than in the JSON schema: structured outputs reject
    // minimum/maximum on an integer, so this is the only thing checking it.
    if (!Number.isInteger(r.score) || r.score < 1 || r.score > 5) {
      problems.push(`${r.axis}: score ${r.score} outside 1–5`);
    }
    if (sentenceCount(r.note) > 2) {
      problems.push(`${r.axis}: over the two-sentence budget`);
    }
    if (sentenceCount(r.note) === 0) problems.push(`${r.axis}: empty note`);
  }

  if (!entry.body?.trim()) problems.push("empty body");

  // Teams must be a subset of what ESPN tagged, so nothing is invented — and
  // capped, because ESPN tags every club that gave a player a visit. The first
  // real draft came out with five teams for a two-team signing.
  const tagged = new Set(candidate.teamIds ?? []);
  const teams = entry.teams ?? [];
  if (teams.length === 0) problems.push("no teams");
  if (teams.length > 3) problems.push(`${teams.length} teams — a move involves two or three`);
  const untagged = teams.filter((t) => !tagged.has(t));
  if (untagged.length > 0) {
    problems.push(`teams not tagged on the source article: ${untagged.join(", ")}`);
  }

  const source = `${candidate.headline ?? ""} ${candidate.description ?? ""}`;
  const unfair = fairnessProblem(prose, source);
  if (unfair) problems.push(unfair);

  return problems;
}

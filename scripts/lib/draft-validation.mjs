/**
 * Validation for Claude-drafted move entries.
 *
 * Split out of draft-moves.mjs so it can be tested without an API key. The
 * guardrails here are the only thing standing between a generated draft and a
 * confidently wrong statement about a real person, so they get a test.
 */

export const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

/** Numbers as a reader meets them: 67.5, 20, 2027. */
export function numbersIn(text) {
  return (String(text ?? "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/** Sentence count that doesn't trip on "$67.5 million". */
export function sentenceCount(text) {
  return String(text ?? "")
    .replace(/\$?\d+(\.\d+)?/g, "N")
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

  return problems;
}

/** Wrap prose under a `>-` folded scalar at a readable width. */
export function yamlFold(text, indent = "        ") {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > 68) {
      lines.push(line.trim());
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.map((l) => `${indent}${l}`).join("\n");
}

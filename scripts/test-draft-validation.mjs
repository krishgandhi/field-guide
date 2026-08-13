/**
 * Prove the guardrails on Claude-drafted moves actually reject bad drafts.
 *
 * draft-moves.mjs can't run without an API key, so without this the most
 * safety-critical code in the project would ship unexercised. The check that
 * matters most is the fabricated-number one: the model sees only a headline
 * and a description, so any figure it produces that isn't in that text was
 * invented, and an invented contract figure about a real player is precisely
 * the "confidently wrong" outcome CLAUDE.md §1 exists to prevent.
 *
 *   npm run test:drafts
 */

import { problemsWith, sentenceCount, yamlFold } from "./lib/draft-validation.mjs";

let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  " + detail : ""}`);
}

const candidate = {
  id: "1",
  headline: "Patriots TE Hunter Henry signs extension worth up to $20M",
  description:
    "New England and the tight end agreed to a 2 year deal on Monday.",
};

const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

/** A draft that uses only figures present in the source: 20 and 2. */
function goodEntry(overrides = {}) {
  return {
    id: "1",
    skip: false,
    slug: "henry-extension",
    title: "Patriots extend Hunter Henry",
    summary: "New England kept a reliable target rather than let him leave.",
    bigness: 2,
    teams: ["NE"],
    rubric: AXES.map((axis) => ({
      axis,
      score: 3,
      note: "A steady contributor rather than a star. The deal runs 2 years.",
    })),
    body: "A quiet extension worth up to $20 million.",
    ...overrides,
  };
}

check("a clean draft passes", problemsWith(goodEntry(), candidate).length === 0,
  problemsWith(goodEntry(), candidate).join("; "));

// --- the one that matters --------------------------------------------------
const fabricatedCap = goodEntry({
  body: "A quiet extension worth up to $20 million, with $13.5 million guaranteed.",
});
const capProblems = problemsWith(fabricatedCap, candidate);
check(
  "invented contract figure in the body is rejected",
  capProblems.some((p) => p.includes("invented figures")),
  capProblems.join("; "),
);

const fabricatedPick = goodEntry({
  rubric: goodEntry().rubric.map((r, i) =>
    i === 2 ? { ...r, note: "New England also sent a 2028 fourth round pick." } : r,
  ),
});
check(
  "invented draft pick in a rubric note is rejected",
  problemsWith(fabricatedPick, candidate).some((p) => p.includes("invented figures")),
);

const fabricatedAge = goodEntry({
  summary: "At 31 he is past his best, but New England kept him anyway.",
});
check(
  "invented age in the summary is rejected",
  problemsWith(fabricatedAge, candidate).some((p) => p.includes("invented figures")),
);

// A figure that IS in the source must not trip the check — otherwise the rule
// is useless, because every real cap story would be rejected.
const sourcedFigure = goodEntry({
  summary: "New England kept him on a deal worth up to $20 million.",
});
check(
  "a figure taken from the source is allowed",
  !problemsWith(sourcedFigure, candidate).some((p) => p.includes("invented figures")),
  problemsWith(sourcedFigure, candidate).join("; "),
);

// --- structural checks -----------------------------------------------------
check(
  "five axes is rejected",
  problemsWith(goodEntry({ rubric: goodEntry().rubric.slice(0, 5) }), candidate).some(
    (p) => p.includes("5 axes"),
  ),
);
check(
  "axes out of §7 order is rejected",
  problemsWith(
    goodEntry({ rubric: [...goodEntry().rubric].reverse() }),
    candidate,
  ).some((p) => p.includes("out of §7 order")),
);
check(
  "a three-sentence axis note is rejected",
  problemsWith(
    goodEntry({
      rubric: goodEntry().rubric.map((r, i) =>
        i === 0 ? { ...r, note: "One. Two. Three." } : r,
      ),
    }),
    candidate,
  ).some((p) => p.includes("two-sentence budget")),
);
check(
  "a two-sentence summary is rejected",
  problemsWith(goodEntry({ summary: "One thing. Another thing." }), candidate).some(
    (p) => p.includes("exactly one sentence"),
  ),
);
// The JSON schema used to carry minimum/maximum on these integers, until the
// API rejected those keywords outright. problemsWith is now the only guard.
check(
  "a rubric score outside 1-5 is rejected",
  problemsWith(
    goodEntry({
      rubric: goodEntry().rubric.map((r, i) => (i === 3 ? { ...r, score: 7 } : r)),
    }),
    candidate,
  ).some((p) => p.includes("outside 1–5")),
);
check(
  "a non-integer rubric score is rejected",
  problemsWith(
    goodEntry({
      rubric: goodEntry().rubric.map((r, i) => (i === 1 ? { ...r, score: 2.5 } : r)),
    }),
    candidate,
  ).some((p) => p.includes("outside 1–5")),
);
check(
  "bigness outside 1-5 is rejected",
  problemsWith(goodEntry({ bigness: 9 }), candidate).some((p) =>
    p.includes("outside 1–5"),
  ),
);
check(
  "an empty body is rejected",
  problemsWith(goodEntry({ body: "  " }), candidate).some((p) =>
    p.includes("empty body"),
  ),
);
check(
  "a bad slug is rejected",
  problemsWith(goodEntry({ slug: "Henry Extension!" }), candidate).some((p) =>
    p.includes("bad slug"),
  ),
);

// --- helpers ---------------------------------------------------------------
check("sentenceCount ignores decimals", sentenceCount("Worth $67.5 million now.") === 1);
check(
  "yamlFold wraps and indents",
  yamlFold("word ".repeat(40).trim())
    .split("\n")
    .every((l) => l.startsWith("        ") && l.length <= 78),
);

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);

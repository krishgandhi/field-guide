/**
 * The per-entry rules for a move file that the zod schema can't express:
 * §5's word budget, §7's rubric shape, the filename/date agreement, source
 * links, people ids.
 *
 * One copy, used by tests/moves.test.ts (which checks every committed entry)
 * and by draft-moves.mjs (which checks a generated entry BEFORE publishing
 * it). They used to differ: the pipeline could publish a file the test suite
 * then failed — and the data workflow runs the tests before it commits, so
 * one such file would have blocked every data refresh.
 */

export const KINDS = ["trade", "signing", "contract", "release", "role", "injury", "coaching"];

export const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

/** Sentence count that doesn't trip on "$67.5 million" or "No. 29". */
export function sentences(text) {
  return text
    .replace(/\$?\d+(\.\d+)?/g, "N")
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/** YAML reads an unquoted 2026-06-02 as a Date; compare as the written text. */
const asDateText = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

/** Every rule one entry breaks, as strings; empty means it passes. */
export function moveRuleProblems({ file, fm, move, body }) {
  const problems = [];
  const fail = (m) => problems.push(m);
  if (!move) return ["no move: block"];

    // Filename and slug have to agree, or links built from one miss the other.
    if (`${fm.slug}.mdx` !== file) fail(`slug "${fm.slug}" doesn't match the filename`);

    // The filename's date and move.date are two sources of truth that can
    // drift. The slug carries YYYY-MM and the date carries the full day, so
    // require the former to be a prefix of the latter: 2026-03-linderbaum ↔
    // "2026-03-12" passes, a slug saying June when the date says March fails.
    const prefix = (String(fm.slug).match(/^\d{4}(-\d{2})?/) ?? [])[0];
    if (!prefix) {
      fail("filename should start with the date, e.g. 2026-06-");
    } else if (!asDateText(move.date).startsWith(prefix)) {
      fail(`filename says ${prefix} but move.date is ${asDateText(move.date)}`);
    }

    // Every entry declares what kind of change it is; the card chip and the
    // list filter both key off it.
    if (!KINDS.includes(move.kind)) {
      fail(`kind "${move.kind}" is not one of ${KINDS.join(", ")}`);
    }

    // The rubric is built for things where a team chose to pay a price. It has
    // nothing to say about a coach being fired or a knee giving way, and those
    // two may score nothing — but a trade with no rubric is unfinished.
    const rubricOptional = ["coaching", "injury"].includes(move.kind);
    if (!rubricOptional && (move.rubric ?? []).length === 0) {
      fail(`kind "${move.kind}" must score the six axes`);
    }

    // Profile cards key off these. Malformed ids fail silently as a missing
    // card, so catch them here instead.
    for (const id of move.people ?? []) {
      if (!/^\d+$/.test(String(id))) fail(`people id "${id}" is not an ESPN athlete id`);
    }
    // Coaching changes have no player data to fetch, by design. Everything
    // else is about someone, and an entry with nobody named renders no card.
    if (move.kind !== "coaching" && (move.people ?? []).length === 0) {
      fail(`kind "${move.kind}" names nobody — add people: [espnId]`);
    }

    // §9: always link to the source.
    const sources = move.sources ?? [];
    for (const src of sources) {
      if (!src.label) fail("a source has no label");
      if (!/^https:\/\/\S+\.\S+/.test(String(src.url ?? ""))) {
        fail(`source url isn't a well-formed https link: ${src.url}`);
      }
    }
    if (move.verified === true && sources.length === 0) {
      fail("verified: true but no sources — §9 requires linking out");
    }

    // §5: a move's summary is the one-line "why care".
    if (sentences(String(fm.summary)) > 1) {
      fail(`summary is ${sentences(String(fm.summary))} sentences, should be one`);
    }

    const axes = move.rubric ?? [];
    if (axes.length !== 0 && axes.length !== 6) {
      fail(`${axes.length} rubric axes — must be all six or none`);
    }

    if (axes.length === 6) {
      // §7 lists the axes in a specific order and the page renders them in
      // file order, so a shuffled file would silently reorder the reasoning.
      const got = axes.map((a) => a.axis);
      if (got.join("|") !== AXES.join("|")) fail(`axes out of §7 order: ${got.join(", ")}`);
      for (const a of axes) {
        if (!(a.score >= 1 && a.score <= 5)) fail(`${a.axis}: score ${a.score} outside 1–5`);
        const n = sentences(String(a.note ?? ""));
        // §5: "Two sentences each, max."
        if (n > 2) fail(`${a.axis}: ${n} sentences, §5 allows two`);
        if (n === 0) fail(`${a.axis}: empty note`);
      }
      // A rubric where everything scores the same isn't reasoning, it's a mood.
      const scores = axes.map((a) => a.score);
      if (Math.max(...scores) - Math.min(...scores) === 0) {
        fail("all six axes scored identically");
      }
    }

    if (!body.trim()) fail("empty body — the 'so what' is missing");

  return problems;
}

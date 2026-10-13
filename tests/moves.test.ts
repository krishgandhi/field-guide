/**
 * Checks the move entries against the rules in CLAUDE.md that a type system
 * can't express.
 *
 * The zod schema already enforces shape — six axes or none, scores 1–5, no
 * unknown keys. What it can't check is whether the prose obeys §5's word
 * budget ("two sentences each, max") or whether the rubric is actually
 * discriminating rather than rating everything a 4.
 *
 * Source links are checked only on request, because a 404 is real rot but not
 * something to discover on every run:  CHECK_LINKS=1 npm test -- moves
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";

const DIR = "content/moves";

const KINDS = ["trade", "signing", "contract", "release", "role", "injury", "coaching"];

const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

type Axis = { axis: string; score: number; note?: string };
type Source = { label?: string; url?: string };
type Move = {
  date: unknown;
  kind: string;
  bigness: number;
  verified?: boolean;
  sources?: Source[];
  people?: unknown[];
  rubric?: Axis[];
};

/** Sentence count that doesn't trip on "$67.5 million" or "No. 29". */
function sentences(text: string) {
  return text
    .replace(/\$?\d+(\.\d+)?/g, "N")
    .split(/[.!?]+(?:\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/** YAML reads an unquoted 2026-06-02 as a Date; compare as the written text. */
const asDateText = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v);

const files = readdirSync(DIR).filter((f) => f.endsWith(".mdx"));
const entries = files.map((file) => {
  const { data, content } = matter(readFileSync(path.join(DIR, file), "utf8"));
  return { file, fm: data, move: data.move as Move | undefined, body: content };
});

it("finds move files", () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(entries)("$file", ({ file, fm, move, body }) => {
  /** Every rule for one entry, reported together so one run lists them all. */
  it("obeys CLAUDE.md §5 and §7", () => {
    const problems: string[] = [];
    const fail = (m: string) => problems.push(m);

    if (!move) {
      expect(["no move: block"]).toEqual([]);
      return;
    }

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

    expect(problems).toEqual([]);
  });
});

describe("across all moves", () => {
  const bigness = entries
    .filter((e) => e.move)
    .map((e) => [String(e.fm.slug), e.move!.bigness] as const);

  // §7's whole point is that positional value discriminates. If every move
  // lands on the same bigness the rubric isn't doing any work.
  it("bigness takes at least three distinct values", () => {
    expect(new Set(bigness.map(([, b]) => b)).size).toBeGreaterThanOrEqual(3);
  });

  it("a record contract for an interior lineman scores below the Garrett trade", () => {
    const linderbaum = bigness.find(([s]) => s.includes("linderbaum"));
    const garrett = bigness.find(([s]) => s.includes("garrett"));
    if (!linderbaum || !garrett) return;
    // §7 says positional value should sink it.
    expect(linderbaum[1]).toBeLessThan(garrett[1]);
  });
});

describe.skipIf(!process.env.CHECK_LINKS)("source links resolve", () => {
  const sources = entries.flatMap((e) =>
    (e.move?.sources ?? []).map((s) => ({ file: e.file, label: s.label, url: String(s.url) })),
  );
  it.each(sources)("$file — $label", async ({ url }) => {
    let status = 0;
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "Mozilla/5.0 (field-guide link check)" },
        signal: AbortSignal.timeout(15000),
      });
      status = res.status;
    } catch {
      status = 0;
    }
    expect(status >= 200 && status < 400, `dead (${status || "no response"}): ${url}`).toBe(true);
  }, 20000);
});

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
import { moveRuleProblems } from "../scripts/lib/move-rules.mjs";

const DIR = "content/moves";

type Move = { bigness: number; sources?: { label?: string; url?: string }[] };

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
    // The rules live in scripts/lib/move-rules.mjs so draft-moves applies
    // exactly the same ones before it publishes.
    const problems: string[] = moveRuleProblems({ file, fm, move, body });

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

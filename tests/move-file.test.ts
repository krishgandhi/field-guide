/**
 * Generated move files: serialised by a YAML library, then read back through
 * gray-matter and the app's zod schema before they may be published.
 */

import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { buildMoveFile, moveFileProblems } from "../scripts/lib/move-file.mjs";

const AXES = [
  "Player quality",
  "Positional value",
  "Cost paid",
  "Cap mechanics",
  "Competitive windows",
  "Narrative violation",
];

const entry = (over: Record<string, unknown> = {}) => ({
  title: 'Bills: what now? "A #1 problem"',
  summary: "Buffalo's move: it matters — here's why, with a 'quote'.",
  kind: "trade",
  bigness: 3,
  rubric: AXES.map((axis, i) => ({ axis, score: 1 + (i % 5), note: "One sentence: with a colon.  Two." })),
  body: "First paragraph.\n\nSecond: paragraph.",
  ...over,
});

const candidate = {
  url: "https://www.espn.com/nfl/story/_/id/1/x",
  players: [{ id: "3918298" }, { id: 4379399 }],
};

const build = (over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  buildMoveFile({
    entry: entry(over),
    candidate,
    slug: "2026-10-bills-trade",
    date: "2026-10-12",
    teams: ["BUF", "MIA"],
    sensitive: false,
    today: "2026-10-13",
    ...extra,
  });

describe("buildMoveFile", () => {
  it("round-trips titles and summaries that would break hand-written YAML", () => {
    const text = build();
    const { data, content } = matter(text, { cache: false } as never);
    expect(data.title).toBe('Bills: what now? "A #1 problem"');
    expect(data.summary).toBe("Buffalo's move: it matters — here's why, with a 'quote'.");
    expect(data.move.people).toEqual(["3918298", "4379399"]);
    expect(content.trim()).toBe("First paragraph.\n\nSecond: paragraph.");
    expect(moveFileProblems(text, "2026-10-bills-trade")).toEqual([]);
  });
});

describe("moveFileProblems", () => {
  it("rejects what tests/moves.test.ts would fail", () => {
    const flat = build({ rubric: AXES.map((axis) => ({ axis, score: 3, note: "Fine." })) });
    expect(moveFileProblems(flat, "2026-10-bills-trade")).toContain("all six axes scored identically");
  });

  it("rejects what the zod schema rejects", () => {
    const problems = moveFileProblems(build({ kind: "rumour" }), "2026-10-bills-trade");
    expect(problems.join(" ")).toMatch(/move\.kind/);
  });

  it("rejects a missing source link", () => {
    const text = buildMoveFile({
      entry: entry(),
      candidate: { url: "", players: [] },
      slug: "2026-10-bills-trade",
      date: "2026-10-12",
      teams: ["BUF"],
      sensitive: false,
      today: "2026-10-13",
    });
    expect(moveFileProblems(text, "2026-10-bills-trade").join(" ")).toMatch(/sources/);
  });

  it("rejects an unknown team and a slug that disagrees with the filename", () => {
    const text = build({}, { teams: ["WAS"] });
    const problems = moveFileProblems(text, "2026-09-other");
    expect(problems.join(" ")).toMatch(/WAS/);
    expect(problems.join(" ")).toMatch(/doesn't match the filename/);
  });

  it("reports broken YAML instead of throwing", () => {
    const broken = "---\ntitle: Bills: what now?\nslug: x\n---\nbody\n";
    expect(moveFileProblems(broken, "x")[0]).toMatch(/YAML/);
  });
});

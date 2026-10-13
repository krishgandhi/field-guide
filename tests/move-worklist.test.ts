import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS,
  addGivenUp,
  mergeWorklist,
  recordAttempts,
} from "../scripts/lib/move-worklist.mjs";

const c = (id: string, published: string, attempts?: number) => ({ id, published, headline: id, attempts });

describe("mergeWorklist", () => {
  it("keeps the carried attempt count when the feed re-serves a candidate", () => {
    const { worklist } = mergeWorklist([c("a", "2026-10-12")], [c("a", "2026-10-12", 2)], new Set());
    expect(worklist[0].attempts).toBe(2);
  });

  it("drops carried candidates that already have an outcome", () => {
    const { worklist } = mergeWorklist([], [c("a", "2026-10-12"), c("b", "2026-10-11")], new Set(["a"]));
    expect(worklist.map((x) => x.id)).toEqual(["b"]);
  });

  it("returns the oldest overflow instead of losing it silently", () => {
    const carried = [c("old", "2026-09-01"), c("mid", "2026-10-01")];
    const { worklist, dropped } = mergeWorklist([c("new", "2026-10-12")], carried, new Set(), 2);
    expect(worklist.map((x) => x.id)).toEqual(["new", "mid"]);
    expect(dropped.map((x) => x.id)).toEqual(["old"]);
  });
});

describe("recordAttempts", () => {
  const list = [c("done", "x", 0), c("missed", "x", 0), c("last", "x", MAX_ATTEMPTS - 1), c("unsent", "x", 1)];

  it("removes decided candidates, counts attempts, gives up at the cap", () => {
    const { remaining, givenUp } = recordAttempts(list, {
      decided: new Set(["done"]),
      attempted: new Set(["done", "missed", "last"]),
    });
    expect(remaining.map((x) => [x.id, x.attempts])).toEqual([
      ["missed", 1],
      ["unsent", 1],
    ]);
    expect(givenUp.map((x) => [x.id, x.attempts])).toEqual([["last", MAX_ATTEMPTS]]);
    expect(givenUp[0].reason).toMatch(/attempts/);
  });
});

describe("addGivenUp", () => {
  it("puts new records first, de-duplicates and stamps the date", () => {
    const out = addGivenUp([{ id: "a", givenUpOn: "2026-10-01" }], [{ id: "b" }, { id: "a" }], "2026-10-13");
    expect(out.map((x) => [x.id, x.givenUpOn])).toEqual([
      ["b", "2026-10-13"],
      ["a", "2026-10-13"],
    ]);
  });
});

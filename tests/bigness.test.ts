import { describe, expect, it } from "vitest";
import { SIZE_FILTERS, bignessLabel, bignessWord, matchesSize } from "@/lib/moves/bigness";

describe("bigness words", () => {
  it("names every score from 1 to 5", () => {
    expect([5, 4, 3, 2, 1].map(bignessWord)).toEqual(["Huge", "Big", "Notable", "Minor", "Minor"]);
    expect(bignessLabel(5)).toBe("Huge · 5");
  });

  it("each filter's label is the word its scores are called", () => {
    for (const f of SIZE_FILTERS) {
      const scores = [1, 2, 3, 4, 5].filter((n) => matchesSize(n, f.value));
      expect(scores.length).toBeGreaterThan(0);
      for (const n of scores) expect(bignessWord(n)).toBe(f.label);
    }
  });

  it("the filters cover every score exactly once", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(SIZE_FILTERS.filter((f) => matchesSize(n, f.value))).toHaveLength(1);
    }
    expect(matchesSize(3, "all")).toBe(true);
  });
});

/**
 * The prose cache: keying, and the rule that a line is replaced only by one
 * that validates.
 */

import { describe, expect, it } from "vitest";
import {
  chunk,
  MAX_ATTEMPTS,
  needsWriting,
  proseKey,
  settle,
  stableStringify,
  type ProseSection,
} from "../scripts/lib/prose-cache.mjs";

const ok = () => null;
const noDigits = (t: string) => (/\d/.test(t) ? "contains a number" : null);

describe("proseKey", () => {
  it("ignores object key order", () => {
    expect(proseKey(1, { a: 1, b: [1, { c: 2, d: 3 }] })).toBe(
      proseKey(1, { b: [1, { d: 3, c: 2 }], a: 1 }),
    );
  });

  it("changes with the prompt version", () => {
    expect(proseKey(1, { a: 1 })).not.toBe(proseKey(2, { a: 1 }));
  });

  it("changes with the inputs", () => {
    expect(proseKey(1, { tier: "top quarter" })).not.toBe(proseKey(1, { tier: "middle" }));
  });

  it("treats an undefined field as absent", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe("needsWriting", () => {
  const section: ProseSection = {
    hit: { text: "Same inputs.", key: "k1" },
    stale: { text: "Old inputs.", key: "old" },
    tried: { text: "", key: null, rejectedKey: "k3", attempts: MAX_ATTEMPTS },
  };

  it("asks only for missing, stale and not-yet-rejected subjects", () => {
    const todo = needsWriting(section, [
      { subject: "hit", key: "k1" },
      { subject: "stale", key: "k2" },
      { subject: "tried", key: "k3" },
      { subject: "new", key: "k4" },
    ]);
    expect(todo.map((t) => t.subject)).toEqual(["stale", "new"]);
  });

  it("retries a rejected subject once its inputs move", () => {
    expect(needsWriting(section, [{ subject: "tried", key: "k5" }])).toHaveLength(1);
  });
});

describe("settle", () => {
  it("keeps a hit untouched, even with no result", () => {
    const { section } = settle({ a: { text: "Line.", key: "k" } }, [{ subject: "a", key: "k" }], new Map(), ok);
    expect(section.a).toEqual({ text: "Line.", key: "k" });
  });

  it("replaces a stale line with a valid new one", () => {
    const { section, log } = settle(
      { a: { text: "Old.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map([["a", " New line. "]]),
      ok,
    );
    expect(section.a).toEqual({ text: "New line.", key: "new" });
    expect(log.written).toEqual(["a"]);
  });

  it("keeps the old line when the new one fails, if the old still validates", () => {
    const { section, log } = settle(
      { a: { text: "Old and fine.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map([["a", "Has 12 numbers."]]),
      noDigits,
    );
    expect(section.a.text).toBe("Old and fine.");
    expect(section.a.key).toBe("old");
    expect(section.a.rejectedKey).toBe("new");
    expect(log.rejected).toHaveLength(1);
    expect(log.keptStale).toEqual(["a"]);
  });

  it("keeps the old line when nothing came back (no key, API down)", () => {
    const { section } = settle(
      { a: { text: "Old and fine.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map(),
      noDigits,
    );
    expect(section.a).toEqual({ text: "Old and fine.", key: "old" });
  });

  it("drops an old line that no longer validates against current evidence", () => {
    const { section, log } = settle(
      { a: { text: "Says 12.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map(),
      noDigits,
    );
    expect(section.a).toBeUndefined();
    expect(log.dropped).toHaveLength(1);
  });

  it("remembers a rejected key even when there was no old line, and counts the tries", () => {
    const { section } = settle({}, [{ subject: "a", key: "k" }], new Map([["a", "Bad 1."]]), noDigits);
    expect(section.a).toEqual({ text: "", key: null, rejectedKey: "k", attempts: 1 });
  });

  it("retries a blank subject up to MAX_ATTEMPTS times per key, then stops", () => {
    let section: ProseSection = {};
    const wanted = [{ subject: "a", key: "k" }];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(needsWriting(section, wanted)).toHaveLength(1);
      ({ section } = settle(section, wanted, new Map([["a", "Bad 1."]]), noDigits));
    }
    expect(section.a.attempts).toBe(MAX_ATTEMPTS);
    expect(needsWriting(section, wanted)).toEqual([]);
  });

  it("does not retry a rejected key while an older line is still showing", () => {
    const { section } = settle(
      { a: { text: "Old and fine.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map([["a", "Has 12 numbers."]]),
      noDigits,
    );
    expect(needsWriting(section, [{ subject: "a", key: "new" }])).toEqual([]);
  });

  it("uses the stricter stale check on an out-of-date line, and removes it when that fails", () => {
    const mentionsOldStarter = (t: string) => (t.includes("McCarthy") ? "names McCarthy" : null);
    const { section, log } = settle(
      { "MIN:offence": { text: "Runs through J.J. McCarthy.", key: "old" } },
      [{ subject: "MIN:offence", key: "new" }],
      new Map(),
      ok,
      mentionsOldStarter,
    );
    expect(section["MIN:offence"]).toBeUndefined();
    expect(log.dropped).toEqual(["MIN:offence: names McCarthy"]);
  });

  it("does not hold back a retry after the stale line was dropped and the new one rejected", () => {
    const { section } = settle(
      { a: { text: "Old 7.", key: "old" } },
      [{ subject: "a", key: "new" }],
      new Map([["a", "New 9."]]),
      noDigits,
    );
    expect(section.a.text).toBe("");
    expect(needsWriting(section, [{ subject: "a", key: "new" }])).toHaveLength(1);
  });

  it("never applies the stale check to new text", () => {
    const { section } = settle(
      {},
      [{ subject: "a", key: "k" }],
      new Map([["a", "Fine."]]),
      ok,
      () => "would fail",
    );
    expect(section.a).toEqual({ text: "Fine.", key: "k" });
  });

  it("prunes subjects nobody wants any more", () => {
    const { section, log } = settle(
      { gone: { text: "Last week.", key: "k" }, here: { text: "This week.", key: "k" } },
      [{ subject: "here", key: "k" }],
      new Map(),
      ok,
    );
    expect(Object.keys(section)).toEqual(["here"]);
    expect(log.pruned).toEqual(["gone"]);
  });
});

it("chunk splits into fixed-size batches", () => {
  expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
});

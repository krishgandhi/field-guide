/**
 * Game-reason keying: tomorrow's article must not rewrite today's sentence,
 * and an ESPN news outage must not take a good sentence down.
 */

import { describe, expect, it } from "vitest";
import { pickPreviews, reasonKey } from "../scripts/lib/reason-previews.mjs";

const art = (id: string, published: string) => ({ id, published, headline: id });

describe("pickPreviews", () => {
  const monday = [art("a", "2026-10-05T12:00:00Z"), art("b", "2026-10-06T12:00:00Z"), art("c", "2026-10-07T12:00:00Z")];

  it("takes the earliest three, so new coverage does not change the set", () => {
    const tuesday = [art("d", "2026-10-08T12:00:00Z"), ...monday]; // ESPN lists newest first
    expect(pickPreviews(monday).map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(pickPreviews(tuesday).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("drops duplicates (both teams' feeds carry the same preview)", () => {
    expect(pickPreviews([...monday, monday[0]]).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });
});

describe("reasonKey", () => {
  const existing = { text: "A sentence naming the rookie from the preview.", key: "old" };

  it("keeps the written key when the news fetch failed", () => {
    expect(reasonKey({ computed: "new", newsFailed: true, existing })).toBe("old");
  });

  it("uses the new key when the news arrived", () => {
    expect(reasonKey({ computed: "new", newsFailed: false, existing })).toBe("new");
  });

  it("uses the new key when there is nothing to keep", () => {
    expect(reasonKey({ computed: "new", newsFailed: true, existing: undefined })).toBe("new");
    expect(reasonKey({ computed: "new", newsFailed: true, existing: { text: "", key: null } })).toBe("new");
  });
});

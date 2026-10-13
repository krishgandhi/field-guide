import { describe, expect, it } from "vitest";
import { daysStale, isStale } from "@/lib/staleness";

const now = Date.parse("2026-10-13T12:00:00Z");

describe("staleness", () => {
  it("counts whole days since the fetch", () => {
    expect(daysStale("2026-10-12T20:05:35Z", now)).toBe(0);
    expect(daysStale("2026-10-08T12:00:00Z", now)).toBe(5);
  });
  it("warns only past three days", () => {
    expect(isStale("2026-10-10T12:00:00Z", now)).toBe(false);
    expect(isStale("2026-10-09T11:00:00Z", now)).toBe(true);
  });
  it("treats an unreadable stamp as stale rather than fresh", () => {
    expect(isStale("not a date", now)).toBe(true);
  });
});

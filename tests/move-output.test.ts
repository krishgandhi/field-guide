/**
 * Where draft-moves writes: never over an existing file, never outside the
 * two directories, and never in a way that can fail the job.
 */

import { describe, expect, it } from "vitest";
import { sanitiseSlug, targetFor } from "../scripts/lib/move-output.mjs";

const dirs = { publishedDir: "content/moves", heldDir: "content/moves/_drafts" };
const disk = (...files: string[]) => {
  const set = new Set(files);
  return (f: string) => set.has(f);
};

describe("sanitiseSlug", () => {
  it("makes a model's slug path-safe", () => {
    expect(sanitiseSlug("bills/sign ../ Von Miller")).toBe("bills-sign-von-miller");
    expect(sanitiseSlug("Tua's Release!")).toBe("tua-s-release");
    expect(sanitiseSlug("Señor-Back")).toBe("senor-back");
  });

  it("is never empty", () => {
    expect(sanitiseSlug("///")).toBe("untitled");
    expect(sanitiseSlug(undefined)).toBe("untitled");
  });

  it("caps the length without a trailing hyphen", () => {
    const s = sanitiseSlug(`${"a".repeat(59)} b`);
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("targetFor", () => {
  it("publishes to a free slug", () => {
    expect(targetFor({ slug: "2026-10-x", held: false, ...dirs, exists: disk() })).toEqual({
      file: "content/moves/2026-10-x.mdx",
      held: false,
      reason: null,
    });
  });

  it("holds, with a reason, instead of overwriting a published entry", () => {
    const t = targetFor({ slug: "2026-06-garrett", held: false, ...dirs, exists: disk("content/moves/2026-06-garrett.mdx") });
    expect(t.held).toBe(true);
    expect(t.file).toBe("content/moves/_drafts/2026-06-garrett.mdx");
    expect(t.reason).toMatch(/already exists/);
  });

  it("never overwrites a held draft either — the second of a pair gets a suffix", () => {
    const exists = disk("content/moves/_drafts/2026-10-x.mdx", "content/moves/_drafts/2026-10-x-2.mdx");
    expect(targetFor({ slug: "2026-10-x", held: true, ...dirs, exists }).file).toBe(
      "content/moves/_drafts/2026-10-x-3.mdx",
    );
  });

  it("a duplicate slug in one run: the second is held once the first is on disk", () => {
    const written = new Set<string>();
    const exists = (f: string) => written.has(f);
    const first = targetFor({ slug: "2026-10-dup", held: false, ...dirs, exists });
    written.add(first.file);
    const second = targetFor({ slug: "2026-10-dup", held: false, ...dirs, exists });
    expect(first.held).toBe(false);
    expect(second.held).toBe(true);
    expect(second.file).not.toBe(first.file);
  });
});

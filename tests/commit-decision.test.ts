import { describe, expect, it } from "vitest";
import { changedPaths, decide } from "../scripts/lib/commit-decision.mjs";

const now = new Date("2026-10-13T11:00:00Z");
const recent = { slate: "2026-10-12T11:00:00Z", people: "2026-10-12T11:00:00Z" };
const old = { slate: "2026-10-12T11:00:00Z", people: "2026-10-10T11:00:00Z" };

describe("changedPaths", () => {
  it("reads git's porcelain format, untracked files included", () => {
    expect(changedPaths(" M src/data/slate.json\n?? content/moves/2026-10-x.mdx\n")).toEqual([
      "src/data/slate.json",
      "content/moves/2026-10-x.mdx",
    ]);
  });
});

describe("decide", () => {
  it("commits when any real data changed", () => {
    expect(decide(["src/data/meta.json", "src/data/slate.json"], recent, now)).toBe("content");
    expect(decide(["content/moves/2026-10-x.mdx"], recent, now)).toBe("content");
  });

  it("does not commit when only the clock moved, recently", () => {
    expect(decide(["src/data/meta.json"], recent, now)).toBe("none");
  });

  it("commits meta alone once its oldest stamp is two days old", () => {
    expect(decide(["src/data/meta.json"], old, now)).toBe("heartbeat");
  });

  it("does nothing when nothing changed", () => {
    expect(decide([], old, now)).toBe("none");
  });

  it("treats a missing committed meta.json as stale", () => {
    expect(decide(["src/data/meta.json"], {}, now)).toBe("heartbeat");
  });
});

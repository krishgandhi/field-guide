import { describe, expect, it } from "vitest";
import { changedPaths, decide, staleFetchers } from "../scripts/lib/commit-decision.mjs";

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

  it("commits meta alone once its newest stamp is two days old", () => {
    const quiet = { slate: "2026-10-11T10:00:00Z", people: "2026-10-10T11:00:00Z" };
    expect(decide(["src/data/meta.json"], quiet, now)).toBe("heartbeat");
  });

  it("a dead fetcher's old stamp does not make every run a heartbeat", () => {
    // people stopped working days ago; slate is current.
    expect(decide(["src/data/meta.json"], old, now)).toBe("none");
  });

  it("does nothing when nothing changed", () => {
    expect(decide([], old, now)).toBe("none");
  });

  it("treats a missing committed meta.json as stale", () => {
    expect(decide(["src/data/meta.json"], {}, now)).toBe("heartbeat");
  });
});

describe("staleFetchers", () => {
  it("names fetchers with no successful run in three days", () => {
    const meta = {
      slate: "2026-10-13T11:00:00Z",
      people: "2026-10-09T11:00:00Z",
      teamDetail: "garbage",
    };
    expect(staleFetchers(meta, now)).toEqual(["people", "teamDetail"]);
  });

  it("is empty when everything ran recently", () => {
    expect(staleFetchers(recent, now)).toEqual([]);
  });
});

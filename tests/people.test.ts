/**
 * fetch-people's failure path: a partial ESPN failure keeps yesterday's
 * record whole, rather than writing a profile with no awards that reads as a
 * thin résumé and moves the profile line's cache key.
 */

import { describe, expect, it } from "vitest";
import { fetchEvidence, refreshPerson } from "../scripts/lib/people.mjs";

const yesterday = {
  id: "3918298",
  name: "Josh Allen",
  team: "Buffalo Bills",
  awards: [{ name: "NFL MVP", count: "1x", seasons: ["2024"] }],
  career: { "Rushing Touchdowns": "86" },
  headshot: "/players/3918298.png",
};

const fetchPerson = async () => ({ id: "3918298", name: "Josh Allen", team: "Buffalo Bills" });
const saveHeadshot = async () => "cached";

describe("fetchEvidence", () => {
  it("zips career labels to values", async () => {
    const get = async () => ({
      awards: [{ name: "NFL MVP", displayCount: "1x", seasons: ["2024"] }],
      statistics: {
        displayNames: ["Rushing Touchdowns", "Rushing Yards"],
        splits: [{ displayName: "Career", stats: ["86", "4,839"] }],
      },
    });
    expect(await fetchEvidence("1", get, "base")).toEqual({
      awards: [{ name: "NFL MVP", count: "1x", seasons: ["2024"] }],
      career: { "Rushing Touchdowns": "86", "Rushing Yards": "4,839" },
    });
  });

  it("throws when the fetch fails, instead of returning an empty résumé", async () => {
    const get = async () => {
      throw new Error("ESPN 503");
    };
    await expect(fetchEvidence("1", get, "base")).rejects.toThrow("ESPN 503");
  });
});

describe("refreshPerson", () => {
  it("keeps yesterday's record whole when only the evidence call fails", async () => {
    const result = await refreshPerson("3918298", yesterday, {
      fetchPerson,
      fetchEvidence: async () => {
        throw new Error("timeout");
      },
      saveHeadshot,
    });
    expect(result.record).toBe(yesterday);
    expect(result.error).toBeInstanceOf(Error);
    expect(String(result.error)).toMatch(/timeout/);
  });

  it("returns nothing for someone new whose fetch fails", async () => {
    const result = await refreshPerson("1", undefined, {
      fetchPerson: async () => {
        throw new Error("down");
      },
      fetchEvidence: async () => ({ awards: [], career: {} }),
      saveHeadshot,
    });
    expect(result.record).toBeNull();
  });

  it("writes today's record when every step succeeds", async () => {
    const result = await refreshPerson("3918298", yesterday, {
      fetchPerson,
      fetchEvidence: async () => ({ awards: [], career: { Sacks: "0" } }),
      saveHeadshot,
    });
    expect(result.error).toBeNull();
    expect(result.record).toMatchObject({ name: "Josh Allen", career: { Sacks: "0" }, headshot: "/players/3918298.png" });
  });
});

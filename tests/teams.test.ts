/**
 * The one team registry. §13: abbreviations differ across sources, so they are
 * normalised once — and this checks the normalising actually happens.
 */

import { describe, expect, it } from "vitest";
import {
  NFL_TEAMS,
  division,
  isDivisional,
  team,
  teamBySlug,
  teamId,
  teamsInDivision,
} from "@/lib/teams";

describe("team registry", () => {
  it("has all 32 teams, each in exactly one division of four", () => {
    expect(NFL_TEAMS).toHaveLength(32);
    const groups = new Map<string, number>();
    for (const t of NFL_TEAMS) {
      const key = `${t.conference} ${t.division}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    expect([...groups.values()]).toEqual(Array(8).fill(4));
  });

  it("maps WAS to ESPN's WSH, in any case", () => {
    expect(teamId("WAS")).toBe("WSH");
    expect(teamId("was")).toBe("WSH");
    expect(team("WAS")?.name).toBe("Commanders");
  });

  it("passes unknown ids through rather than guessing", () => {
    expect(teamId("XYZ")).toBe("XYZ");
    expect(team("XYZ")).toBeUndefined();
  });

  it("finds a team by its page slug", () => {
    expect(teamBySlug("washington-commanders")?.id).toBe("WSH");
    expect(teamBySlug("buffalo-bills")?.displayName).toBe("Buffalo Bills");
  });

  it("lists a division in display order", () => {
    expect(teamsInDivision("AFC", "East").map((t) => t.id)).toEqual(["BUF", "MIA", "NE", "NYJ"]);
  });

  it("answers division questions through either spelling", () => {
    expect(division("WAS")).toBe("NFC East");
    expect(isDivisional("WAS", "DAL")).toBe(true);
    expect(isDivisional("BUF", "KC")).toBe(false);
  });
});

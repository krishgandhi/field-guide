/**
 * The two hand-kept §8 lists: rivalries, and quarterbacks who have won MVP.
 */

import { describe, expect, it } from "vitest";
import rivalries from "@/lib/slate/rivalries.json";
import starQuarterbacks from "@/lib/slate/star-quarterbacks.json";
import { hasStarQb, isRivalry, isStarQb } from "@/lib/slate/context";
import { team } from "@/lib/teams";

const ALLEN = { id: "3918298", name: "Josh Allen" };
const BACKUP = { id: "1", name: "Somebody Else" };

describe("rivalries.json", () => {
  it("names only real teams, by ESPN id", () => {
    const bad = rivalries.pairs.flat().filter((id) => team(id)?.id !== id);
    expect(bad).toEqual([]);
  });
  it("is symmetric and accepts aliases", () => {
    expect(isRivalry("BUF", "KC")).toBe(true);
    expect(isRivalry("KC", "BUF")).toBe(true);
    expect(isRivalry("WAS", "DAL")).toBe(true);
    expect(isRivalry("BUF", "JAX")).toBe(false);
  });
});

describe("star quarterbacks", () => {
  it("lists each player once, with at least one MVP season", () => {
    const ids = starQuarterbacks.players.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of starQuarterbacks.players) expect(p.mvp.length).toBeGreaterThan(0);
  });

  it("follows the player, not the team", () => {
    expect(hasStarQb("BUF", { starter: () => ALLEN, injuries: () => [] })).toBe(true);
    expect(hasStarQb("BUF", { starter: () => BACKUP, injuries: () => [] })).toBe(false);
    // The same player traded elsewhere still counts.
    expect(hasStarQb("NYJ", { starter: () => ALLEN, injuries: () => [] })).toBe(true);
  });

  it("does not count a starter ruled out this week", () => {
    const out = () => [{ player: "Josh Allen", status: "Out" }];
    const questionable = () => [{ player: "Josh Allen", status: "Questionable" }];
    expect(hasStarQb("BUF", { starter: () => ALLEN, injuries: out })).toBe(false);
    expect(hasStarQb("BUF", { starter: () => ALLEN, injuries: questionable })).toBe(true);
  });

  it("is false with no depth chart", () => {
    expect(hasStarQb("BUF", { starter: () => null })).toBe(false);
  });

  it("checks ids, not names", () => {
    expect(isStarQb(ALLEN.id)).toBe(true);
    expect(isStarQb("Josh Allen")).toBe(false);
  });
});

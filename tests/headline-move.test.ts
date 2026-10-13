/**
 * The home screen's move card follows the calendar, not just the ranking.
 * Taking the head of the biggest-first list kept June's Garrett trade there
 * forever.
 */

import { describe, expect, it } from "vitest";
import { getMoves, getMovesByDate, headlineMove, type Move } from "@/lib/moves";

const move = (slug: string, date: string, bigness: number) =>
  ({ slug, date, bigness }) as Move;

const now = Date.parse("2026-10-13T12:00:00Z");

describe("headlineMove", () => {
  it("takes the biggest move of the last month", () => {
    const moves = [
      move("old-giant", "2026-06-02", 5),
      move("recent-small", "2026-10-10", 2),
      move("recent-big", "2026-09-20", 4),
    ];
    expect(headlineMove(now, moves)).toEqual({
      move: moves[2],
      title: "Biggest recent move",
    });
  });

  it("falls back to the newest, and calls it latest, when nothing is recent", () => {
    const moves = [move("old-giant", "2026-06-02", 5), move("newer", "2026-08-01", 2)];
    expect(headlineMove(now, moves)).toEqual({ move: moves[1], title: "Latest move" });
  });

  it("ignores a move dated in the future", () => {
    const moves = [move("future", "2026-12-01", 5), move("now", "2026-10-12", 1)];
    expect(headlineMove(now, moves)?.move.slug).toBe("now");
  });

  it("returns null with no moves", () => {
    expect(headlineMove(now, [])).toBeNull();
  });
});

describe("getMovesByDate", () => {
  it("is newest first and holds the same moves as getMoves", () => {
    const byDate = getMovesByDate();
    expect(byDate.map((m) => m.date)).toEqual([...byDate.map((m) => m.date)].sort().reverse());
    expect(byDate.length).toBe(getMoves().length);
  });
});

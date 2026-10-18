/**
 * Monday night's game must stop being "upcoming" once it kicks off — the bug
 * was the home screen still selling BUF at LAR as a must-watch on Wednesday.
 */

import { describe, expect, it } from "vitest";
import { GAME_LENGTH_MS, gamePhase, nextUnplayed } from "@/lib/game-phase";

const MNF = "2026-10-13T00:15Z"; // Mon Oct 12, 8:15 PM Eastern
const at = (iso: string) => Date.parse(iso);

describe("gamePhase", () => {
  it("is upcoming before kickoff", () => {
    expect(gamePhase(MNF, at("2026-10-12T22:00Z"))).toBe("upcoming");
  });

  it("is live from kickoff for the length of a game", () => {
    expect(gamePhase(MNF, at(MNF))).toBe("live");
    expect(gamePhase(MNF, at(MNF) + GAME_LENGTH_MS - 1)).toBe("live");
  });

  it("is played after that — the Wednesday case", () => {
    expect(gamePhase(MNF, at(MNF) + GAME_LENGTH_MS)).toBe("played");
    expect(gamePhase(MNF, at("2026-10-14T16:00Z"))).toBe("played");
  });

  it("treats an unreadable kickoff as upcoming rather than hiding the game", () => {
    expect(gamePhase("TBD", at("2026-10-14T16:00Z"))).toBe("upcoming");
  });
});

describe("nextUnplayed", () => {
  const games = [
    { id: "mon", kickoff: MNF },
    { id: "thu", kickoff: "2026-10-16T00:15Z" },
  ];

  it("skips games that have kicked off", () => {
    expect(nextUnplayed(games, at("2026-10-14T16:00Z"))?.id).toBe("thu");
  });

  it("is null when the whole week is done", () => {
    expect(nextUnplayed(games, at("2026-10-20T16:00Z"))).toBeNull();
  });
});

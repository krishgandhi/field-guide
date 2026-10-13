/**
 * The shared ESPN client: how it reads the season calendar, and that it
 * retries the failures worth retrying and nothing else.
 *
 * The calendar fixture is a trimmed copy of the real bare-scoreboard response
 * from 12 October 2026, so the week lookup is tested against ESPN's actual
 * shape rather than a guess at it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import board from "./fixtures/espn-scoreboard-2026.json";
import {
  EspnError,
  OFFSEASON,
  POSTSEASON,
  PRESEASON,
  REGULAR_SEASON,
  getJson,
  phaseFromScoreboard,
  regularSeasonWeek,
  resetBreaker,
  BREAKER_LIMIT,
  slateCandidates,
  scoreboardUrl,
  standingsUrl,
} from "../scripts/lib/espn.mjs";

const at = (iso: string) => phaseFromScoreboard(board, Date.parse(iso));

describe("phaseFromScoreboard", () => {
  it("reads the regular-season week from the calendar", () => {
    expect(at("2026-10-12T15:00:00Z")).toEqual({
      season: 2026,
      seasonType: REGULAR_SEASON,
      week: 5,
      label: "Week 5",
    });
  });

  it("rolls over on ESPN's Wednesday boundary, not ours", () => {
    expect(at("2026-10-14T06:00:00Z").week).toBe(5);
    expect(at("2026-10-14T08:00:00Z").week).toBe(6);
  });

  it("knows week 1 started before opening night", () => {
    expect(at("2026-09-07T12:00:00Z")).toMatchObject({ seasonType: REGULAR_SEASON, week: 1 });
  });

  it("recognises the preseason", () => {
    expect(at("2026-08-20T12:00:00Z")).toMatchObject({ seasonType: PRESEASON, week: 3 });
  });

  it("recognises the playoffs, and keeps the season's year", () => {
    expect(at("2027-01-16T18:00:00Z")).toEqual({
      season: 2026,
      seasonType: POSTSEASON,
      week: 1,
      label: "Wild Card",
    });
    expect(at("2027-02-08T00:00:00Z")).toMatchObject({ seasonType: POSTSEASON, label: "Super Bowl" });
  });

  it("recognises the off season", () => {
    expect(at("2027-04-01T00:00:00Z")).toMatchObject({ seasonType: OFFSEASON, week: null });
  });

  it("falls back to ESPN's own week when the calendar has nothing", () => {
    expect(phaseFromScoreboard({ ...board, leagues: [{ ...board.leagues[0], calendar: [] }] }))
      .toMatchObject({ season: 2026, seasonType: REGULAR_SEASON, week: 5 });
  });

  it("refuses a response with no season at all", () => {
    expect(() => phaseFromScoreboard({})).toThrow(/season year/);
  });
});

describe("regularSeasonWeek", () => {
  const phase = (seasonType: number, week: number | null) =>
    ({ season: 2026, seasonType, week, label: null });

  it("passes a regular-season week straight through", () => {
    expect(regularSeasonWeek(phase(REGULAR_SEASON, 7))).toBe(7);
  });
  it("shows week 1 during the preseason", () => {
    expect(regularSeasonWeek(phase(PRESEASON, 3))).toBe(1);
  });
  it("holds at week 18 through the playoffs and the off season", () => {
    expect(regularSeasonWeek(phase(POSTSEASON, 2))).toBe(18);
    expect(regularSeasonWeek(phase(OFFSEASON, null))).toBe(18);
  });
});

describe("slateCandidates", () => {
  const phase = (season: number, seasonType: number, week: number | null) =>
    ({ season, seasonType, week, label: null });

  it("tries exactly one week in season", () => {
    expect(slateCandidates(phase(2026, REGULAR_SEASON, 5))).toEqual([{ season: 2026, week: 5 }]);
    expect(slateCandidates(phase(2026, PRESEASON, 2))).toEqual([{ season: 2026, week: 1 }]);
  });

  it("falls back to last season's week 18 once ESPN rolls the year over", () => {
    expect(slateCandidates(phase(2027, OFFSEASON, null))).toEqual([
      { season: 2027, week: 18 },
      { season: 2026, week: 18 },
    ]);
    expect(slateCandidates(phase(2026, POSTSEASON, 1))[1]).toEqual({ season: 2025, week: 18 });
  });
});

describe("URLs always ask for the regular season (§13)", () => {
  it("scoreboard", () => {
    expect(scoreboardUrl(2026, 5)).toContain("seasontype=2");
  });
  it("standings", () => {
    expect(standingsUrl(2025)).toContain("season=2025&seasontype=2");
  });
});

describe("retries", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetBreaker();
  });

  const respond = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), { status });

  it("retries a 503 and returns the eventual success", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);

    const pending = getJson("https://example.test/x");
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 — that is an answer, not a blip", async () => {
    const fetch = vi.fn().mockResolvedValue(respond(404));
    vi.stubGlobal("fetch", fetch);

    const err = await getJson("https://example.test/missing").catch((e) => e);
    expect(err).toBeInstanceOf(EspnError);
    expect(err.status).toBe(404);
    expect(err.message).toBe("404 https://example.test/missing");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget on a network error", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);

    const pending = getJson("https://example.test/down", { retries: 2 }).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = await pending;
    expect(err.status).toBeNull();
    expect(err.message).toMatch(/^network/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("opens the circuit after repeated outages, and a success closes it", async () => {
    const fetch = vi.fn().mockResolvedValue(respond(503));
    vi.stubGlobal("fetch", fetch);

    for (let i = 0; i < BREAKER_LIMIT; i++) {
      await getJson("https://example.test/down", { retries: 0 }).catch(() => {});
    }
    expect(fetch).toHaveBeenCalledTimes(BREAKER_LIMIT);

    const err = await getJson("https://example.test/down", { retries: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(EspnError);
    expect(err.message).toMatch(/circuit open/);
    expect(fetch).toHaveBeenCalledTimes(BREAKER_LIMIT); // no network call

    resetBreaker();
    fetch.mockResolvedValue(respond(200, { ok: true }));
    await expect(getJson("https://example.test/up")).resolves.toEqual({ ok: true });
  });

  it("does not count a 404 towards the breaker", async () => {
    const fetch = vi.fn().mockResolvedValue(respond(404));
    vi.stubGlobal("fetch", fetch);
    for (let i = 0; i < BREAKER_LIMIT + 2; i++) {
      await getJson("https://example.test/missing").catch(() => {});
    }
    expect(fetch).toHaveBeenCalledTimes(BREAKER_LIMIT + 2);
  });
});

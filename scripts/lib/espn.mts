/**
 * The one way scripts talk to ESPN.
 *
 * Every fetcher used to carry its own copy of `getJson`: different user
 * agents, a 20-second timeout in some and none at all in others, and no retry
 * anywhere — so one dropped connection at 11:00 UTC cost a whole day's data.
 * This module is the single copy.
 *
 * Node builtins only, on purpose. The data workflows run the fetchers before
 * `npm ci`, so a broken dependency can never stop a refresh. Node 24 runs this
 * TypeScript file directly by stripping the types — no build step, no tsx.
 *
 * Endpoint notes live in CLAUDE.md §9. The ones this module enforces:
 *   - ESPN serves PRESEASON by default. Scoreboard and standings URLs built
 *     here always carry `seasontype=2` (§13).
 *   - The current season and week come from ESPN's own calendar, not from a
 *     date constant that has to be edited every August.
 */

export const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
/** Standings live on a different path from the rest of the site api. */
export const SITE_V2 = "https://site.api.espn.com/apis/v2/sports/football/nfl";
export const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
/** Player profiles; `/{id}` for bio, `/{id}/overview` for awards and stats. */
export const ATHLETES = "https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes";

/** ESPN's season types. 2 is the only one most of this site cares about. */
export const PRESEASON = 1;
export const REGULAR_SEASON = 2;
export const POSTSEASON = 3;
export const OFFSEASON = 4;

/** The last regular-season week. */
export const REGULAR_SEASON_WEEKS = 18;

const USER_AGENT = "field-guide (personal, non-commercial)";

export type FetchOptions = {
  /** Per attempt, not total. */
  timeoutMs?: number;
  /** Extra attempts after the first, for network errors, 429 and 5xx only. */
  retries?: number;
};

/**
 * A failed ESPN request. The message starts with the status (or "network")
 * so a log line reads "404 https://..." and callers can branch on `status`.
 */
export class EspnError extends Error {
  status: number | null;
  url: string;

  constructor(status: number | null, url: string, cause?: unknown) {
    const why = status ?? `network${cause instanceof Error ? ` (${cause.message})` : ""}`;
    super(`${why} ${url}`);
    this.name = "EspnError";
    this.status = status;
    this.url = url;
  }
}

/** Worth trying again: a blip, not an answer. A 404 is an answer. */
const retryable = (status: number | null) => status === null || status === 429 || status >= 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET with a timeout, a fixed user agent, and retry with backoff (1s, 3s, 9s…).
 * Resolves only with an OK response; anything else throws EspnError.
 */
export async function espnFetch(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, retries = 2 } = options;

  for (let attempt = 0; ; attempt++) {
    let status: number | null = null;
    let cause: unknown;
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      status = res.status;
      // Drain the body so the connection can be reused.
      await res.body?.cancel();
    } catch (err) {
      cause = err;
    }

    if (attempt >= retries || !retryable(status)) throw new EspnError(status, url, cause);
    await sleep(1000 * 3 ** attempt);
  }
}

/** Parsed JSON. ESPN's payloads are untyped, so callers get `any` and read defensively. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getJson<T = any>(url: string, options?: FetchOptions): Promise<T> {
  const res = await espnFetch(url, options);
  return (await res.json()) as T;
}

/** Raw bytes, for logos and headshots. */
export async function getBytes(url: string, options?: FetchOptions): Promise<Buffer> {
  const res = await espnFetch(url, options);
  return Buffer.from(await res.arrayBuffer());
}

/** Core api `$ref` links come back as http://; follow them over https. */
export const followRef = (ref: string) => ref.replace(/^http:/, "https:");

/** One week of regular-season games. `seasontype=2` is load-bearing (§13). */
export function scoreboardUrl(season: number, week: number, base: string = SITE): string {
  return `${base}/scoreboard?dates=${season}&seasontype=${REGULAR_SEASON}&week=${week}`;
}

/**
 * League standings. Without `seasontype=2` August returns preseason results
 * and the whole league renders 1-0.
 */
export function standingsUrl(season: number, base: string = SITE_V2): string {
  return `${base}/standings?season=${season}&seasontype=${REGULAR_SEASON}`;
}

export type SeasonPhase = {
  /** The season's year — the 2026 season's playoffs are still 2026. */
  season: number;
  /** PRESEASON, REGULAR_SEASON, POSTSEASON or OFFSEASON. */
  seasonType: number;
  /** Week within that season type (Wild Card is week 1 of the postseason); null off season. */
  week: number | null;
  /** ESPN's label: "Week 5", "Wild Card", "Super Bowl". */
  label: string | null;
};

type CalendarEntry = { label?: string; value?: string; startDate?: string; endDate?: string };
type CalendarSection = CalendarEntry & { entries?: CalendarEntry[] };

const within = (now: number, e: CalendarEntry) =>
  Boolean(e.startDate && e.endDate) &&
  now >= Date.parse(e.startDate as string) &&
  now <= Date.parse(e.endDate as string);

/**
 * Where in the season `now` falls, from the calendar ESPN ships with the
 * scoreboard.
 *
 * The bare scoreboard carries `leagues[0].calendar`: one section per season
 * type (preseason, regular season, postseason, off season), each with dated
 * week entries. Verified 2026-10-12: 18 regular-season weeks running
 * Wednesday to Wednesday, then Wild Card, Divisional, Conference and Super
 * Bowl. Reading the dates ourselves rather than trusting the top-level
 * `week` keeps this correct even if ESPN's default view lags a day.
 */
export function phaseFromScoreboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  board: any,
  now: number = Date.now(),
): SeasonPhase {
  const league = board?.leagues?.[0];
  const season = Number(league?.season?.year ?? board?.season?.year);
  if (!Number.isInteger(season)) {
    throw new Error("ESPN scoreboard carried no season year");
  }

  const sections: CalendarSection[] = league?.calendar ?? [];
  for (const section of sections) {
    if (!within(now, section)) continue;
    const entry = (section.entries ?? []).find((e) => within(now, e));
    return {
      season,
      seasonType: Number(section.value),
      week: entry ? Number(entry.value) : null,
      label: entry?.label ?? section.label ?? null,
    };
  }

  // No calendar, or a gap between sections: fall back to what ESPN says it
  // is currently showing.
  const seasonType = Number(board?.season?.type ?? league?.season?.type?.type);
  if (!Number.isInteger(seasonType)) {
    throw new Error("ESPN scoreboard carried neither a calendar nor a season type");
  }
  const week = Number(board?.week?.number);
  return {
    season,
    seasonType,
    week: Number.isInteger(week) ? week : null,
    label: null,
  };
}

/** The current season, season type and week, read live from ESPN. */
export async function currentPhase(base: string = SITE): Promise<SeasonPhase> {
  return phaseFromScoreboard(await getJson(`${base}/scoreboard`));
}

/**
 * The regular-season week a slate should show for a phase.
 *
 * Preseason maps to Week 1, the next thing worth watching. The postseason and
 * the off season hold at Week 18: the slate is shaped for the regular season
 * only, and rendering playoff games needs its own data shape (refactor plan,
 * phase 5) — until then the last regular-season week is the honest fallback,
 * which is what the old date arithmetic did too.
 */
export function regularSeasonWeek(phase: SeasonPhase): number {
  if (phase.seasonType === PRESEASON) return 1;
  if (phase.seasonType === REGULAR_SEASON && phase.week) {
    return Math.min(REGULAR_SEASON_WEEKS, Math.max(1, phase.week));
  }
  return REGULAR_SEASON_WEEKS;
}

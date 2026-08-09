/**
 * Pull the week's games and injuries from ESPN into src/data/slate.json.
 *
 * Run by .github/workflows/refresh-slate.yml once a day; the commit it makes
 * triggers a Vercel deploy. Pages read the committed JSON and never call ESPN
 * at request time (CLAUDE.md §4). When ESPN changes or breaks — and §9 warns
 * these endpoints are undocumented — the site keeps serving the last good file.
 *
 * This script writes FACTS ONLY. Watchability scoring lives in
 * src/lib/watchability.ts so the rubric can change without a refetch, and so
 * the committed data stays a faithful record of what ESPN said rather than a
 * mixture of source data and our judgement.
 *
 * Usage:
 *   node scripts/fetch-slate.mjs            # current week, derived from today
 *   WEEK=11 node scripts/fetch-slate.mjs    # a specific week
 *   SLATE_BASE=http://bad node scripts/...  # failure drill
 */

import { writeFile, mkdir, readFile } from "node:fs/promises";

const BASE = process.env.SLATE_BASE ?? "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const OUT = "src/data/slate.json";

/** Regular season opens Wed 9 Sep 2026; weeks run Wednesday to Tuesday. */
const SEASON = 2026;
const WEEK_ONE_START = Date.UTC(2026, 8, 9); // month is 0-indexed
const WEEKS = 18;

/**
 * Derive the regular-season week from today's date.
 *
 * Deliberately NOT read from ESPN's default scoreboard: right now that returns
 * `season.type: 1` — preseason — and would silently hand back preseason games
 * as if they were the real slate.
 */
function currentWeek() {
  if (process.env.WEEK) {
    const w = Number(process.env.WEEK);
    if (!Number.isInteger(w) || w < 1 || w > WEEKS) {
      throw new Error(`WEEK must be 1–${WEEKS}, got "${process.env.WEEK}"`);
    }
    return w;
  }
  const days = (Date.now() - WEEK_ONE_START) / 86_400_000;
  return Math.min(WEEKS, Math.max(1, Math.floor(days / 7) + 1));
}

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "field-guide" } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.json();
}

/** "SEA -3.5" → the margin as a positive number, plus who's favoured. */
function readSpread(competition) {
  const odds = competition.odds?.[0];
  if (!odds) return { spread: null, favourite: null, overUnder: null };

  const home = odds.homeTeamOdds?.favorite === true;
  const away = odds.awayTeamOdds?.favorite === true;
  const raw = typeof odds.spread === "number" ? Math.abs(odds.spread) : null;

  return {
    spread: raw,
    favourite: home ? "home" : away ? "away" : null,
    overUnder: typeof odds.overUnder === "number" ? odds.overUnder : null,
  };
}

/** Positions a newcomer would recognise as mattering. */
const NOTABLE = new Set(["QB", "RB", "WR", "TE", "LT", "EDGE", "DE", "CB", "LB"]);

async function fetchInjuries() {
  const data = await getJson(`${BASE}/injuries`);
  const byTeam = {};

  // Grouped off each athlete's own team rather than the enclosing group: the
  // group object carries only `id` and `displayName`, no abbreviation, so
  // keying off it produced "Atlanta Falcons" where every other part of the app
  // says "ATL". §13 warns about exactly this — normalise at the boundary.
  for (const group of data.injuries ?? []) {
    for (const item of group.injuries ?? []) {
      // Questionable is noise this far out; Out and Doubtful change a game.
      if (!["Out", "Doubtful"].includes(item.status)) continue;

      const position = item.athlete?.position?.abbreviation;
      if (!NOTABLE.has(position)) continue;

      const abbr = item.athlete?.team?.abbreviation;
      if (!abbr) continue;

      (byTeam[abbr] ??= []).push({
        player: item.athlete?.displayName ?? "Unknown",
        position,
        status: item.status,
      });
    }
  }

  // Quarterbacks first — one missing QB matters more than four missing anyone
  // else — then cap it, because this is a companion, not a depth chart.
  for (const abbr of Object.keys(byTeam)) {
    byTeam[abbr] = byTeam[abbr]
      .sort((a, b) => (a.position === "QB" ? -1 : 0) - (b.position === "QB" ? -1 : 0))
      .slice(0, 4);
  }

  return byTeam;
}

async function main() {
  const week = currentWeek();
  const board = await getJson(
    `${BASE}/scoreboard?dates=${SEASON}&seasontype=2&week=${week}`,
  );

  const events = board.events ?? [];
  if (events.length === 0) {
    throw new Error(`Week ${week} returned no games. Refusing to overwrite good data.`);
  }

  const games = events.map((event) => {
    const c = event.competitions[0];
    const home = c.competitors.find((t) => t.homeAway === "home");
    const away = c.competitors.find((t) => t.homeAway === "away");
    const { spread, favourite, overUnder } = readSpread(c);

    return {
      id: event.id,
      kickoff: event.date,
      home: home.team.abbreviation,
      away: away.team.abbreviation,
      spread,
      favourite,
      overUnder,
      // ESPN gives an array of arrays; flatten to the names people say out loud.
      broadcast:
        c.broadcasts?.flatMap((b) => b.names ?? []).filter(Boolean).join(", ") || null,
      venue: c.venue?.fullName ?? null,
      neutralSite: c.neutralSite === true,
    };
  });

  // Byes are absent from the response rather than flagged, so derive them.
  const playing = new Set(games.flatMap((g) => [g.home, g.away]));
  const allTeams = JSON.parse(
    await readFile("src/lib/teams/nfl-teams.json", "utf8"),
  ).map((t) => t.id);
  const byes = allTeams.filter((id) => !playing.has(id)).sort();

  // Sanity gate before anything is written. 32 teams are either playing or on
  // a bye; if that doesn't hold, the response is malformed and last week's
  // committed file is better than whatever this is.
  const accounted = playing.size + byes.length;
  if (accounted !== 32) {
    throw new Error(
      `Only ${accounted} of 32 teams accounted for in week ${week}. Refusing to write.`,
    );
  }
  const missingSpread = games.filter((g) => g.spread === null).length;

  const slate = {
    season: SEASON,
    week,
    fetchedAt: new Date().toISOString(),
    games,
    byes,
    injuries: await fetchInjuries(),
  };

  await mkdir("src/data", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(slate, null, 2)}\n`);

  console.log(
    `week ${week}: ${games.length} games, ${byes.length} on bye, ` +
      `${games.length - missingSpread}/${games.length} with a spread, ` +
      `${Object.keys(slate.injuries).length} teams with notable injuries`,
  );
}

main().catch((err) => {
  // Exit non-zero and write nothing. The workflow fails visibly, the previous
  // slate.json stays committed, and the site serves slightly stale data — which
  // §4 says is the whole point of this architecture.
  console.error(`fetch-slate failed: ${err.message}`);
  process.exit(1);
});

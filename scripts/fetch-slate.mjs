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
 *   node scripts/fetch-slate.mjs            # current week, read from ESPN's calendar
 *   WEEK=11 node scripts/fetch-slate.mjs    # a specific week of the current season
 *   SLATE_BASE=http://bad node scripts/...  # failure drill
 */

import { writeFile, mkdir } from "node:fs/promises";
import {
  REGULAR_SEASON_WEEKS,
  SITE,
  currentPhase,
  getJson,
  scoreboardUrl,
  slateCandidates,
} from "./lib/espn.mts";
import { TEAM_IDS } from "./lib/teams.mts";
import { stamp } from "./lib/meta.mts";

const BASE = process.env.SLATE_BASE ?? SITE;
const OUT = "src/data/slate.json";

/**
 * The season and regular-season weeks to try, in order.
 *
 * Read from ESPN's calendar rather than counted from a hardcoded opening day,
 * which had to be edited every August. Preseason maps to Week 1 and the
 * playoffs hold at Week 18 — see regularSeasonWeek() and slateCandidates()
 * for why, including the off-season fallback to last season's Week 18. The
 * scoreboard request itself always carries seasontype=2, so the preseason
 * games ESPN serves by default can never pose as the real slate.
 */
async function weeksToTry() {
  const phase = await currentPhase(BASE);
  if (process.env.WEEK) {
    const w = Number(process.env.WEEK);
    if (!Number.isInteger(w) || w < 1 || w > REGULAR_SEASON_WEEKS) {
      throw new Error(`WEEK must be 1–${REGULAR_SEASON_WEEKS}, got "${process.env.WEEK}"`);
    }
    return { phase, tries: [{ season: phase.season, week: w }] };
  }
  return { phase, tries: slateCandidates(phase) };
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
  const { phase, tries } = await weeksToTry();
  let season, week, events = [];
  for (const t of tries) {
    const board = await getJson(scoreboardUrl(t.season, t.week, BASE));
    events = board.events ?? [];
    ({ season, week } = t);
    if (events.length > 0) break;
    console.log(`${t.season} week ${t.week}: no games on ESPN.`);
  }

  if (events.length === 0) {
    if (tries.length > 1) {
      // Off season, schedule not out yet: nothing new is correct, not an error.
      console.log("Nothing to show yet — keeping the committed slate.");
      return;
    }
    throw new Error(
      `${season} week ${week} returned no games (phase type ${phase.seasonType}). ` +
        "Refusing to overwrite good data.",
    );
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
  const byes = TEAM_IDS.filter((id) => !playing.has(id)).sort();

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
    season,
    week,
    games,
    byes,
    injuries: await fetchInjuries(),
  };

  await mkdir("src/data", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(slate, null, 2)}\n`);
  stamp("slate");

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

/**
 * Pull every team's record from ESPN into src/data/standings.json.
 *
 * Runs daily alongside fetch-slate.mjs. Separate script on the same reasoning
 * that split out the prose step: single-purpose and independently failable, so
 * a standings outage can never cost us the week's games.
 *
 * THE SEASON-NOT-STARTED PROBLEM, handled here rather than in the UI:
 * ESPN happily returns 2026 standings today — all 32 teams at 0-0, because no
 * games have been played. Rendering that puts "0-0" on every page and looks
 * broken. So if the current season has no completed games, this falls back to
 * last season's finals and sets `isPreviousSeason`. The UI just reads the flag
 * and labels it; the switch happens by itself in September with no code change.
 *
 * Usage:
 *   node scripts/fetch-standings.mjs
 *   STANDINGS_BASE=http://bad node scripts/fetch-standings.mjs   # failure drill
 */

import { writeFile, mkdir } from "node:fs/promises";
import { SITE_V2, currentPhase, getJson, standingsUrl } from "./lib/espn.mts";
import { TEAM_IDS } from "./lib/teams.mts";
import { stamp } from "./lib/meta.mts";

const BASE = process.env.STANDINGS_BASE ?? SITE_V2;
const OUT = "src/data/standings.json";

/** ESPN nests conference → division → entries; flatten to one row per team. */
function readStandings(payload) {
  const rows = [];
  for (const conference of payload.children ?? []) {
    // Some responses group by division, some return entries on the conference.
    for (const group of conference.children?.length
      ? conference.children
      : [conference]) {
      for (const entry of group.standings?.entries ?? []) {
        const stat = Object.fromEntries(
          (entry.stats ?? []).map((s) => [s.name, s]),
        );
        const num = (k) =>
          typeof stat[k]?.value === "number" ? stat[k].value : null;

        rows.push({
          id: entry.team?.abbreviation,
          wins: num("wins") ?? 0,
          losses: num("losses") ?? 0,
          ties: num("ties") ?? 0,
          pointDifferential: num("pointDifferential"),
          /** Feeds the offence and defence ratings on a team page. */
          pointsFor: num("pointsFor"),
          pointsAgainst: num("pointsAgainst"),
          /**
           * ESPN calls this playoffSeed, but in final standings it ranks all
           * 16 teams in the conference, not just the qualifiers — the 3-14 Jets
           * come back as "seed 15". Stored under its true meaning so nothing
           * downstream reads a losing season as a playoff berth.
           */
          conferenceRank: num("playoffSeed") ?? 0,
        });
      }
    }
  }
  return rows.filter((r) => r.id);
}

/**
 * Has the regular season actually started?
 *
 * This is now a second line of defence. The real fix is `seasontype=2` on the
 * request: the bare endpoint defaults to whatever is being played, so through
 * August it returns PRESEASON results.
 *
 * The earlier version of this guard reasoned that a stray exhibition game
 * couldn't fool a "most of the league has played" test. That was wrong — by
 * mid-August every team has played one, so all 32 carried a record and the
 * site showed the entire league at 1-0. With seasontype=2 the same request
 * returns 32 teams and zero records, which is the truth, and this correctly
 * falls back to last season.
 */
function seasonHasStarted(rows) {
  const withGames = rows.filter((r) => r.wins + r.losses + r.ties > 0).length;
  return withGames >= rows.length / 2;
}

const teamGames = (rows) => rows.reduce((n, r) => n + r.wins + r.losses + r.ties, 0);

async function main() {
  // The season ESPN's calendar says we're in. standingsUrl always adds
  // seasontype=2, which is load-bearing: without it ESPN serves preseason
  // through August and the whole league renders 1-0.
  const { season: current } = await currentPhase();
  let season = current;
  let rows = readStandings(await getJson(standingsUrl(season, BASE)));

  // Nothing meaningful played yet — last season's finals are what's useful.
  let isPreviousSeason = false;
  if (!seasonHasStarted(rows)) {
    season = current - 1;
    rows = readStandings(await getJson(standingsUrl(season, BASE)));
    isPreviousSeason = true;
  }

  // Sanity gate before anything is written. Anything other than a complete
  // league means the response is malformed, and the committed file is better
  // than whatever this is.
  if (rows.length !== 32) {
    throw new Error(`Got ${rows.length} teams, expected 32. Refusing to write.`);
  }
  if (!seasonHasStarted(rows)) {
    throw new Error(
      `Season ${season} hasn't started either. Refusing to write 32 zeroes.`,
    );
  }

  const known = new Set(TEAM_IDS);
  const unknown = rows.filter((r) => !known.has(r.id)).map((r) => r.id);
  if (unknown.length) {
    throw new Error(`Unrecognised team ids: ${unknown.join(", ")}`);
  }

  const standings = {
    season,
    isPreviousSeason,
    teams: Object.fromEntries(rows.map(({ id, ...rest }) => [id, rest])),
  };

  await mkdir("src/data", { recursive: true });
  await writeFile(OUT, `${JSON.stringify(standings, null, 2)}\n`);
  stamp("standings");

  // Seven per conference qualify.
  const playoff = rows.filter((r) => r.conferenceRank >= 1 && r.conferenceRank <= 7).length;
  console.log(
    `${season}${isPreviousSeason ? " (last season — this one hasn't started)" : ""}: ` +
      `32 teams, ${teamGames(rows)} team-games recorded, ${playoff} made the playoffs`,
  );
}

main().catch((err) => {
  // Exit non-zero, write nothing. The workflow fails visibly and the previous
  // standings.json stays committed — §4's reason for this whole architecture.
  console.error(`fetch-standings failed: ${err.message}`);
  process.exit(1);
});

/**
 * Who plays for each team, who coaches them, and how good each unit is.
 *
 * A team page told you nothing about the roster. This fills the two questions a
 * newcomer actually has — who is on this team, and are they any good.
 *
 * Endpoint notes, all learned the hard way:
 *   - Depth charts come from the CORE api. The site api's /depthchart returns
 *     200 with an empty object, which looks like "no data" rather than "wrong
 *     endpoint".
 *   - Names come from the team ROSTER, one request per team, rather than
 *     resolving each athlete $ref on the depth chart individually. That is the
 *     difference between 32 requests and about 400.
 *   - Coaches DO exist, on the core api. An earlier session checked only the
 *     site api and recorded "ESPN has no coach data" as fact. It carries the
 *     head coach only — no coordinators, no title field.
 *   - Formations differ by team: a 3-4 defence lists `nt`, a 4-3 lists
 *     `ldt`/`rdt`. Groups are classified by what's in them, never by name.
 *
 * Node builtins only, like the other fetchers.
 *
 *   node scripts/fetch-team-detail.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ATHLETE_OVERVIEW =
  "https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes";
const OUT = "src/data/team-detail.json";
const SEASON = 2026;

const TEAMS = JSON.parse(readFileSync("src/lib/teams/nfl-teams.json", "utf8"));
const STANDINGS = JSON.parse(readFileSync("src/data/standings.json", "utf8"));

/**
 * The slots worth showing, and what to call them.
 *
 * Not the full chart — that's 28 names and a wall of text on a phone. These
 * are the positions a newcomer watches, weighted by what §7 says actually
 * decides games: quarterback first, then the edge and the corners.
 *
 * Every key here exists in both the 3-4 and 4-3 layouts.
 */
const KEY_SLOTS = {
  offence: [
    ["qb", "QB", 1],
    ["rb", "RB", 1],
    ["wr", "WR", 2],
    ["te", "TE", 1],
    ["lt", "LT", 1],
  ],
  defence: [
    ["lde", "DE", 1],
    ["rde", "DE", 1],
    ["slb", "LB", 1],
    ["lcb", "CB", 1],
    ["rcb", "CB", 1],
  ],
  specialTeams: [
    ["pk", "K", 1],
    ["kr", "KR", 1],
  ],
};

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "field-guide (personal, non-commercial)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

/** id → { name, position } for everyone on a roster, in one request. */
async function rosterIndex(abbr) {
  const d = await getJson(`${SITE}/teams/${abbr.toLowerCase()}/roster`);
  const out = new Map();
  for (const group of d.athletes ?? []) {
    for (const a of group.items ?? [group]) {
      if (a?.id) {
        out.set(String(a.id), {
          name: a.fullName ?? a.displayName ?? null,
          position: a.position?.abbreviation ?? null,
        });
      }
    }
  }
  return out;
}

/** Classify by contents: names vary with the scheme, contents don't. */
function classify(positions) {
  const keys = new Set(Object.keys(positions));
  if (keys.has("qb")) return "offence";
  if (keys.has("pk")) return "specialTeams";
  return "defence";
}

async function depthChart(espnId, roster) {
  const d = await getJson(`${CORE}/seasons/${SEASON}/teams/${espnId}/depthcharts`);
  const units = { offence: [], defence: [], specialTeams: [] };

  for (const item of d.items ?? []) {
    const positions = item.positions ?? {};
    const unit = classify(positions);
    for (const [slot, label, take] of KEY_SLOTS[unit] ?? []) {
      const entry = positions[slot];
      if (!entry) continue;
      const ranked = [...(entry.athletes ?? [])].sort(
        (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
      );
      for (const athlete of ranked.slice(0, take)) {
        // The $ref carries the id; the roster already has the name.
        const id = String(athlete.athlete?.$ref ?? "").match(/athletes\/(\d+)/)?.[1];
        const person = id ? roster.get(id) : null;
        if (!person?.name) continue;
        // On offence and defence the player's own listed position beats my
        // slot guess: ESPN slots interior linemen at `rde`, and "DT" is what a
        // fan would call him.
        //
        // Special teams is the opposite. The ROLE is the point — the kick
        // returner's day job is irrelevant, and listing him as "RB" under
        // Special teams reads like a mistake. ESPN also calls the kicker "PK",
        // where everyone else says "K".
        const useRole = unit === "specialTeams";
        units[unit].push({
          id,
          name: person.name,
          label: useRole ? label : person.position ?? label,
        });
      }
    }
  }
  return units;
}

async function headCoach(espnId) {
  const list = await getJson(`${CORE}/seasons/${SEASON}/teams/${espnId}/coaches`);
  const ref = (list.items ?? [])[0]?.$ref;
  if (!ref) return null;
  const c = await getJson(ref.replace(/^http:/, "https:"));
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return name
    ? { name, experience: typeof c.experience === "number" ? c.experience : null }
    : null;
}

/**
 * The stats that reveal what kind of team this is, per unit.
 *
 * A rank alone can only ever produce "fourth-best for points scored". What
 * makes a team recognisable is the shape underneath: Buffalo ran the ball more
 * often than anyone in the league last season (rushing attempts rank 1) while
 * throwing it less than most (passing attempts rank 25). That is "a run-first
 * team", and it is a fact rather than an impression.
 */
const UNIT_STATS = {
  // Raw attempt and yardage totals are gathered for the pass-rate maths but
  // deliberately NOT handed to the model: volume ranks conflate philosophy with
  // game script, and reading them as identity is how "rushing attempts rank 1"
  // became "Buffalo are a run-first team". Efficiency and scoring don't suffer
  // that confound, so those stay.
  offence: [
    ["rushing", "Rushing Attempts", "_runAttempts"],
    ["passing", "Passing Attempts", "_passAttempts"],
    ["passing", "Total Sacks", "_sacks"],
    ["rushing", "Yards Per Rush Attempt", "yards per carry"],
    ["passing", "Yards Per Pass Attempt", "yards per pass"],
    ["rushing", "Rushing Touchdowns", "rushing touchdowns"],
    ["passing", "Passing Touchdowns", "passing touchdowns"],
    ["miscellaneous", "Total Giveaways", "turnovers given away"],
  ],
  defence: [
    ["defensive", "Sacks", "sacks"],
    ["miscellaneous", "Total Takeaways", "takeaways"],
  ],
  specialTeams: [["kicking", "Field Goal Percentage", "field goal percentage"]],
};

/** Labelled value+rank pairs, so the model never sees a bare number. */
function unitStats(categories) {
  const out = {};
  for (const [unit, wanted] of Object.entries(UNIT_STATS)) {
    out[unit] = {};
    for (const [cat, name, label] of wanted) {
      const c = categories.find((x) => x.name === cat);
      const stat = (c?.stats ?? []).find((x) => x.displayName === name);
      if (stat && typeof stat.rank === "number") {
        out[unit][label] = { value: stat.displayValue, rank: stat.rank };
      }
    }
  }
  return out;
}

/**
 * How often a team actually chose to pass, once the noise is removed.
 *
 * Raw attempt counts cannot tell philosophy from circumstance, and reading
 * them as identity produces confident nonsense. Buffalo ranked FIRST in the
 * league in rushing attempts last season, which looks like a run-first team
 * and isn't:
 *
 *   - 112 of those 547 carries were Josh Allen's own. A scrambling quarterback
 *     turns pass plays into rushing attempts in the box score.
 *   - Sacks are pass plays that the pass column never sees. Buffalo took 40.
 *   - They went 12-5. Teams that lead run the clock out, which inflates
 *     carries without revealing a thing about intent.
 *
 * Adjusting for the first two: 535 dropbacks against 435 designed runs, a 55%
 * pass rate — mid-pack, not the most run-heavy team in football.
 */
function passRate({ rushAttempts, passAttempts, sacks, qbRushAttempts }) {
  if (!rushAttempts || !passAttempts) return null;
  const dropbacks = passAttempts + (sacks ?? 0);
  const designedRuns = Math.max(0, rushAttempts - (qbRushAttempts ?? 0));
  const plays = dropbacks + designedRuns;
  if (!plays) return null;
  return Math.round((dropbacks / plays) * 1000) / 10;
}

/** The starting quarterback's own carries, so they can be taken back out. */
async function qbRushing(athleteId) {
  if (!athleteId) return null;
  try {
    const d = await getJson(`${ATHLETE_OVERVIEW}/${athleteId}/overview`);
    const stats = d.statistics ?? {};
    const labels = stats.displayNames ?? [];
    const row = (stats.splits ?? []).find((x) => x.displayName === "Regular Season");
    if (!row?.stats) return null;
    const at = labels.indexOf("Rushing Attempts");
    if (at === -1) return null;
    const n = Number(String(row.stats[at]).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Field goal percentage — the VALUE, not ESPN's rank.
 *
 * ESPN's own rank on this stat is wrong: it returns rank 1 for teams at 92.7%,
 * 94.3% AND 88.5%. Trusting it put five different teams top of the league at
 * kicking. The value is fine, so the rank is computed here across the 32, the
 * same way points scored and allowed already are.
 */
async function teamStats(espnId, season) {
  try {
    const d = await getJson(
      `${CORE}/seasons/${season}/types/2/teams/${espnId}/statistics`,
    );
    const cats = d.splits?.categories ?? [];
    const kicking = cats.find((c) => c.name === "kicking");
    const pct = (kicking?.stats ?? []).find(
      (s) => s.displayName === "Field Goal Percentage",
    );
    return {
      fieldGoalPct: typeof pct?.value === "number" ? pct.value : null,
      stats: unitStats(cats),
    };
  } catch {
    return { fieldGoalPct: null, stats: {} };
  }
}

// --- ratings ---------------------------------------------------------------

/**
 * Rank out of 32 → the same 1–5 the rest of the site uses (§7, §8).
 *
 * Six bands rather than an even split, so "top six in the league" reads as a 5
 * and the bottom sixth reads as a 1.
 */
export function scoreFromRank(rank) {
  if (!rank) return null;
  if (rank <= 6) return 5;
  if (rank <= 13) return 4;
  if (rank <= 19) return 3;
  if (rank <= 26) return 2;
  return 1;
}

/** 1 → 1st, 2 → 2nd, 12 → 12th, 32 → 32nd. */
function ordinal(n) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * The sentence, templated rather than generated.
 *
 * "Fourth in the league for points scored last season" is formulaic by nature,
 * and there are ninety-six of them a season. A template costs nothing, can't
 * hallucinate, and can never contradict the number beside it.
 *
 * Phrasing is derived from the SCORE, not from the rank directly. Deriving it
 * separately let Buffalo's defence show four dots out of five next to the
 * words "middle of the league" — the meter and the sentence disagreeing about
 * the same team.
 */
export function noteFor(unit, rank, previousSeason) {
  if (!rank) return "No ranking yet for this season.";
  const when = previousSeason ? "last season" : "so far this season";
  const what = {
    offence: "for points scored",
    defence: "for points allowed",
    specialTeams: "at kicking field goals",
  }[unit];

  const score = scoreFromRank(rank);
  const place = `${ordinal(rank)} of 32`;
  if (score === 5) return `Among the best in the league ${what} ${when} — ${place}.`;
  if (score === 4) return `Better than most ${what} ${when}, ${place}.`;
  if (score === 3) return `Middle of the league ${what} ${when}, ${place}.`;
  if (score === 2) return `Below average ${what} ${when}, ${place}.`;
  return `Among the worst in the league ${what} ${when} — ${place}.`;
}

/** Rank across the 32, highest value first unless `asc`. */
function rankBy(values, id, asc = false) {
  const sorted = [...values.entries()]
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (asc ? a[1] - b[1] : b[1] - a[1]));
  const at = sorted.findIndex(([k]) => k === id);
  return at === -1 ? null : at + 1;
}

// --- main ------------------------------------------------------------------

const rows = STANDINGS.teams ?? {};
const previousSeason = Boolean(STANDINGS.isPreviousSeason);
const statsSeason = STANDINGS.season;

const pointsFor = new Map(
  Object.entries(rows).map(([k, v]) => [k, v.pointsFor ?? null]),
);
const pointsAgainst = new Map(
  Object.entries(rows).map(([k, v]) => [k, v.pointsAgainst ?? null]),
);

// Pass one: gather. The special-teams rank can't be computed until every
// team's field goal percentage is known.
const gathered = new Map();
const fieldGoals = new Map();
const passRates = new Map();
let failed = 0;

for (const team of TEAMS) {
  try {
    const roster = await rosterIndex(team.id);
    const [units, coach, stats] = await Promise.all([
      depthChart(team.espnId, roster),
      headCoach(team.espnId).catch(() => null),
      teamStats(team.espnId, statsSeason),
    ]);
    const qbId = (units.offence ?? []).find((p) => p.label === "QB")?.id;
    const qbCarries = await qbRushing(qbId);

    const raw = stats.stats?.offence ?? {};
    const num = (k) =>
      raw[k] ? Number(String(raw[k].value).replace(/,/g, "")) : null;
    const rate = passRate({
      rushAttempts: num("_runAttempts"),
      passAttempts: num("_passAttempts"),
      sacks: num("_sacks"),
      qbRushAttempts: qbCarries,
    });

    gathered.set(team.id, { units, coach, stats: stats.stats, qbCarries, rate });
    fieldGoals.set(team.id, stats.fieldGoalPct);
    passRates.set(team.id, rate);
  } catch (err) {
    failed++;
    console.error(`  ${team.id}: ${err.message}`);
  }
}

// Pass two: rank and write.
const teams = {};
for (const team of TEAMS) {
  const got = gathered.get(team.id);
  if (!got) continue;
  {
    const { units, coach, stats, qbCarries, rate } = got;
    const ranks = {
      offence: rankBy(pointsFor, team.id),
      defence: rankBy(pointsAgainst, team.id, true),
      specialTeams: rankBy(fieldGoals, team.id),
    };

    teams[team.id] = {
      coach,
      statsSeason,
      previousSeason,
      units: Object.fromEntries(
        ["offence", "defence", "specialTeams"].map((u) => [
          u,
          {
            players: units[u],
            rank: ranks[u],
            score: scoreFromRank(ranks[u]),
            note: noteFor(u, ranks[u], previousSeason),
            /** Evidence for write-unit-notes.mjs; never rendered directly. */
            stats: stats?.[u] ?? {},
            ...(u === "offence"
              ? {
                  /**
                   * The honest run/pass split. Raw attempt ranks conflate
                   * philosophy with game script and with a scrambling
                   * quarterback — see passRate() above.
                   */
                  passPlayShare: rate,
                  passPlayShareRank: rankBy(passRates, team.id),
                  quarterbackCarries: qbCarries,
                }
              : {}),
          },
        ]),
      ),
    };

    const counts = ["offence", "defence", "specialTeams"]
      .map((u) => units[u].length)
      .join("/");
    console.log(
      `  ${team.id.padEnd(4)} ${(coach?.name ?? "no coach").padEnd(20)} ` +
        `players ${counts}  ranks o${ranks.offence ?? "-"} d${ranks.defence ?? "-"} st${ranks.specialTeams ?? "-"}`,
    );
  }
}

mkdirSync("src/data", { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify(
    { fetchedAt: new Date().toISOString(), statsSeason, previousSeason, teams },
    null,
    2,
  )}\n`,
);
console.log(
  `\nWrote ${Object.keys(teams).length} teams to ${OUT}${failed ? `, ${failed} failed` : ""}.`,
);

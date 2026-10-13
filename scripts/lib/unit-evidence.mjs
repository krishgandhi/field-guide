/**
 * The evidence a unit note is written from — deliberately coarse.
 *
 * The note says what KIND of unit this is. That doesn't change when a sack
 * rank moves from 11th to 12th, but the old evidence carried raw values and
 * ranks, so its hash moved every game day and all 96 notes were rewritten each
 * time. Everything here is bucketed: ranks into thirds-ish tiers, the run/pass
 * split into below / close to / above the league median, the quarterback's own
 * carries into "a lot" or not.
 *
 * The model is shown exactly this and nothing finer, so the note cannot quote
 * a figure that later drifts without the evidence (and so the cache key)
 * moving too.
 */

/** A 1–32 rank as words. "Top" means ESPN ranked them nearest 1st. */
export function tier(rank) {
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  if (rank <= 8) return "top quarter of the league";
  if (rank >= 25) return "bottom quarter of the league";
  return "middle of the league";
}

export function median(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Percentage points either side of the median that still count as "close".
 * Across the 2026 data the 32 teams spread from about 48% to 69% pass plays
 * around a median near 60; ±4 puts roughly a quarter of the league on each
 * side, which matches the prompt's "most teams are unremarkable here".
 */
export const PASS_SHARE_BAND = 4;

export function passLean(share, leagueMedian) {
  if (typeof share !== "number" || typeof leagueMedian !== "number") return null;
  if (share < leagueMedian - PASS_SHARE_BAND) return "passes noticeably less than the league median";
  if (share > leagueMedian + PASS_SHARE_BAND) return "passes noticeably more than the league median";
  return "close to the league median";
}

/** League-wide context the per-unit evidence is judged against. */
export function leagueContext(teams) {
  const offences = Object.entries(teams ?? {}).map(([id, t]) => [id, t.units?.offence ?? {}]);
  const medianPassShare = median(offences.map(([, u]) => u.passPlayShare));
  // Quarterback carries ranked across the league, most first.
  const byCarries = offences
    .filter(([, u]) => typeof u.quarterbackCarries === "number")
    .sort(([, a], [, b]) => b.quarterbackCarries - a.quarterbackCarries)
    .map(([id]) => id);
  return { medianPassShare, qbCarriesRank: new Map(byCarries.map((id, i) => [id, i + 1])) };
}

/**
 * One unit's evidence.
 *
 * `moves` is this site's own sourced prose about the team. Underscore stat
 * keys are inputs to the pass-rate maths, never evidence: "rushing attempts
 * rank 1" invites exactly the wrong conclusion about Buffalo.
 */
export function unitEvidence(teamId, team, unit, league, moves = []) {
  const u = team.units[unit];
  const statTiers = Object.fromEntries(
    Object.entries(u.stats ?? {})
      .filter(([k]) => !k.startsWith("_"))
      .map(([k, s]) => [k, tier(s?.rank)]),
  );
  const qbRank = league.qbCarriesRank.get(teamId);
  return {
    unit,
    overallTier: tier(u.rank),
    statTiers,
    ...(unit === "offence"
      ? {
          /** Adjusted for the quarterback's own carries and for sacks. */
          passPlayShare: passLean(u.passPlayShare, league.medianPassShare),
          quarterbackRunsALot: typeof qbRank === "number" && qbRank <= 8,
        }
      : {}),
    keyPlayers: (u.players ?? []).map((p) => ({
      position: p.label,
      name: p.name,
      // "(CAR)" on a player now in Buffalo is a sourced hint that he came from
      // elsewhere. It does NOT say when, and the brief forbids guessing.
      drafted: p.draftedBy ?? null,
      // Which season this is for him, counting from 1. ESPN's own field uses 0
      // for a rookie and then counts inclusively — a 2025 pick reads 2 in 2026
      // — so it is handed over normalised. Reading the draft year as "this
      // year" made the model call ten second-year players rookies.
      seasonInTheLeague: p.experience === 0 ? 1 : (p.experience ?? null),
    })),
    headCoach: team.coach?.name ?? null,
    // ESPN counts seasons as an NFL head coach ANYWHERE, not with this club, so
    // 0 proves the man is new and any other number proves nothing either way —
    // Vrabel reads 7 in his second year at New England.
    headCoachSeasonsAsHeadCoach: team.coach?.experience ?? null,
    recentMovesInvolvingThisTeam: moves,
  };
}

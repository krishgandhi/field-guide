/**
 * One person's refresh for fetch-people.mjs, split out so the failure path
 * can be tested without ESPN.
 *
 * The rule that matters: a partial failure keeps yesterday's record whole.
 * fetchEvidence used to catch its own errors and return no awards and no
 * career. That record then looked like a real one with a thin résumé — the
 * profile evidence moved, the cache key moved, and write-profiles was free to
 * replace "one of the best quarterbacks alive" with "yet to establish
 * himself" because one ESPN call timed out.
 */

/** Zip ESPN's overview into awards and career totals. Throws on a failed fetch. */
export async function fetchEvidence(id, get, athleteBase) {
  const body = await get(`${athleteBase}/${id}/overview`);

  const awards = (body.awards ?? []).map((a) => ({
    name: a.name ?? null,
    count: a.displayCount ?? null,
    seasons: a.seasons ?? [],
  }));

  // Columns are position-aware: passing and rushing for a quarterback,
  // tackles and sacks for a cornerback. Zip labels to values so the model
  // never has to guess what a bare number means.
  const stats = body.statistics ?? {};
  const labels = stats.displayNames ?? [];
  const split = (name) => {
    const row = (stats.splits ?? []).find((s) => s.displayName === name);
    if (!row?.stats) return {};
    return Object.fromEntries(labels.map((l, i) => [l, row.stats[i]]).filter(([, v]) => v != null));
  };

  // Career only. This season's split moved every game day and nothing reads
  // it any more — profile lines are written from awards and career totals.
  return { awards, career: split("Career") };
}

/**
 * Fetch everything for one person, or fall back to the existing record.
 *
 * Returns { record, error }. Any step failing — profile, evidence — keeps
 * `existing` as it was rather than mixing today's partial answer into it.
 * The headshot is not a step that can fail the record: a missing picture is
 * cosmetic and already handled.
 */
export async function refreshPerson(id, existing, { fetchPerson, fetchEvidence, saveHeadshot }) {
  try {
    const person = await fetchPerson(id);
    const evidence = await fetchEvidence(id);
    const shot = await saveHeadshot(id);
    return {
      record: { ...person, ...evidence, headshot: shot === "missing" ? null : `/players/${id}.png` },
      shot,
      error: null,
    };
  } catch (error) {
    return { record: existing ?? null, shot: null, error };
  }
}

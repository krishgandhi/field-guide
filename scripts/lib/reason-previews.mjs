/**
 * Which preview articles a game reason is written from — and so keyed on.
 *
 * The cache key hashes the article ids the model saw. Two ways that went
 * wrong:
 *   - The newest three were taken. ESPN publishes about a team every day, so
 *     the set — and the key — moved daily and every game's sentence was
 *     rewritten daily for no reason a reader would notice.
 *   - A failed news fetch returned an empty list. The key moved to "no
 *     reporting", the sentence was rewritten from bare facts, and the old,
 *     specific one was checked against reporting that wasn't there and
 *     dropped. An ESPN outage made the slate worse.
 *
 * Now the earliest qualifying articles are taken, so new coverage doesn't
 * displace what was used until it ages out of the window; and a game whose
 * news fetch failed keeps the key it was written for.
 */

/**
 * Up to `limit` distinct articles, earliest first.
 * @template {{ id?: unknown, published?: string }} T
 * @param {T[]} found
 * @returns {T[]}
 */
export function pickPreviews(found, limit = 3) {
  const seen = new Set();
  return found
    .filter((a) => {
      const id = String(a?.id ?? "");
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((a, i) => ({ a, i, t: new Date(a.published ?? 0).getTime() || 0 }))
    .sort((x, y) => x.t - y.t || x.i - y.i)
    .slice(0, limit)
    .map(({ a }) => a);
}

/**
 * The key to want for one game. When either team's news fetch failed, an
 * existing sentence keeps its own key — so it counts as current, is neither
 * rewritten nor re-checked against reporting we couldn't fetch, and stays up.
 */
export function reasonKey({ computed, newsFailed, existing }) {
  if (newsFailed && existing?.text && existing.key) return existing.key;
  return computed;
}

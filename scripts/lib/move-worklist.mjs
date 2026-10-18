/**
 * The move-candidate worklist: what is waiting to be drafted, how often each
 * has been tried, and what was given up on.
 *
 * Lives in src/data/move-candidates.json as { candidates, givenUp }.
 * detect-moves adds to it; draft-moves takes from it. Split out so the rules
 * are tested without a network or an API key.
 *
 * Two failures this exists to stop:
 *   - A candidate the model silently left out of its answer came back the
 *     next day, and the next, for ever. Each candidate now counts its
 *     attempts and is given up after MAX_ATTEMPTS.
 *   - The worklist was trimmed to the newest 40 with no word about what fell
 *     off. Nothing is dropped silently now: overflow and give-ups both land in
 *     `givenUp`, which `npm run drafts` lists.
 */

/** Tries per candidate before it is given up and listed for a human. */
export const MAX_ATTEMPTS = 3;
/** Candidates kept waiting at once. */
export const WORKLIST_LIMIT = 40;
/** Given-up records kept for `npm run drafts`. */
export const GIVEN_UP_LIMIT = 100;

const byNewest = (a, b) => String(b.published ?? "").localeCompare(String(a.published ?? ""));

/**
 * Fold today's fresh candidates into the carried worklist.
 *
 * A fresh copy of a carried candidate keeps the carried attempt count — the
 * feed re-serving an article must not reset its retries. Anything in `seen`
 * has an outcome and drops out. Over the limit, the OLDEST go, and are
 * returned so the caller can log and record them.
 */
export function mergeWorklist(fresh, carried, seen, limit = WORKLIST_LIMIT) {
  const previous = new Map(carried.filter((c) => c?.id).map((c) => [c.id, c]));
  const merged = new Map();
  for (const c of fresh) {
    merged.set(c.id, { ...c, attempts: previous.get(c.id)?.attempts ?? c.attempts ?? 0 });
  }
  for (const c of carried) {
    if (!c?.id || seen.has(c.id) || merged.has(c.id)) continue;
    merged.set(c.id, { ...c, attempts: c.attempts ?? 0 });
  }
  const all = [...merged.values()].sort(byNewest);
  return { worklist: all.slice(0, limit), dropped: all.slice(limit) };
}

/**
 * After a drafting run: remove what got an outcome, count an attempt for what
 * was sent and came back with nothing, and give up on anything at the cap.
 */
export function recordAttempts(worklist, { decided, attempted }, cap = MAX_ATTEMPTS) {
  const remaining = [];
  const givenUp = [];
  for (const c of worklist) {
    if (decided.has(c.id)) continue;
    const attempts = (c.attempts ?? 0) + (attempted.has(c.id) ? 1 : 0);
    if (attempts >= cap) givenUp.push({ ...c, attempts, reason: `no usable answer after ${attempts} attempts` });
    else remaining.push({ ...c, attempts });
  }
  return { remaining, givenUp };
}

/**
 * Which of a batch's candidates count an attempt.
 *
 * Only a real answer counts: the model replied with parseable JSON and left
 * the candidate out, or declined the batch outright. A 5xx, a 529, a timeout
 * or a reply cut off at max_tokens says nothing about the candidates — it's
 * the API or our request size — and used to count against all six, so three
 * bad days gave them up for good.
 *
 * `outcome` is { answered: Set<id> } for a parsed reply, or { error }.
 */
export function attemptedIn(batch, outcome) {
  if (outcome.error) {
    return outcome.error?.name === "ClaudeRefusal" ? batch.map((c) => c.id) : [];
  }
  return batch.filter((c) => !outcome.answered.has(c.id)).map((c) => c.id);
}

/** Append to the given-up list, newest first, capped. */
export function addGivenUp(existing, more, at) {
  const stamped = more.map((c) => ({ ...c, givenUpOn: c.givenUpOn ?? at }));
  const seen = new Set(stamped.map((c) => c.id));
  return [...stamped, ...existing.filter((c) => !seen.has(c.id))].slice(0, GIVEN_UP_LIMIT);
}

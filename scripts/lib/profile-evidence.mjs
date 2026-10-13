/**
 * Profile lines: the evidence they are written from, and the guard on them.
 *
 * Split out of write-profiles.mjs so both can be tested without an API key.
 *
 * The evidence is coarse for the same reason unit notes are
 * (unit-evidence.mjs). The old hash covered this season's stat line, which
 * moves every game day, so every active player's line was "out of date" weekly
 * — and fetch-people deleted it on the spot, before any replacement existed.
 * Now:
 *   - this season's splits are not used at all;
 *   - career totals are floored to one significant figure ("at least 4000
 *     rushing yards"), which still earns "runs a lot" and changes a few times
 *     a career rather than every Sunday.
 * The model is shown exactly what is hashed.
 */

import { numbersIn, sentenceCount } from "./draft-validation.mjs";

/** 4721 → 4000, 138.5 → 100, 27 → 20, 0.8 → 0. A floor, so "more than" stays true. */
export function floorToLeadingDigit(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 1) return null;
  const scale = 10 ** Math.floor(Math.log10(n));
  return Math.floor(n / scale) * scale;
}

/** Career totals as "at least" figures; zero and unparseable columns dropped. */
export function careerAtLeast(career = {}) {
  return Object.fromEntries(
    Object.entries(career)
      .map(([label, v]) => [label, floorToLeadingDigit(v)])
      .filter(([, v]) => v !== null),
  );
}

/** What the model sees for one person — and what the cache key hashes. */
export function profileEvidence(person, context = []) {
  return {
    id: person.id,
    position: person.position ?? null,
    age: person.age ?? null,
    height: person.height ?? null,
    weight: person.weight ?? null,
    experience: person.experience ?? null,
    draft: person.draft ?? null,
    college: person.college ?? null,
    currentTeam: person.team ?? null,
    awards: (person.awards ?? []).map((a) => ({ name: a.name, count: a.count, seasons: a.seasons })),
    careerTotalsAtLeast: careerAtLeast(person.career),
    mentionedOnSiteAs: context,
  };
}

/**
 * Everything wrong with a line, or null.
 *
 * Figures may come from the evidence the model saw, from the person's full
 * current record (a line migrated from before this change may quote an exact
 * career total; that stays fine for as long as it is still true), or from the
 * site's own already-sourced prose.
 */
export function problemWithBlurb(text, person, context = []) {
  const trimmed = String(text ?? "").trim();
  const words = trimmed.split(/\s+/).length;
  // Two sentences: one placing him, one saying what kind of player he is.
  if (words < 25 || words > 80) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  const sentences = sentenceCount(trimmed);
  if (sentences > 3) return `${sentences} sentences, expected two`;

  const allowed = new Set(
    numbersIn(
      [
        person.draft,
        person.age,
        person.experience,
        person.height,
        person.weight,
        JSON.stringify(person.awards ?? []),
        JSON.stringify(person.career ?? {}),
        JSON.stringify(careerAtLeast(person.career)),
        ...context,
      ]
        .filter(Boolean)
        .join(" ")
        // "4,721" in ESPN's strings reads as 4 and 721 otherwise.
        .replace(/(\d),(\d{3})/g, "$1$2"),
    ),
  );
  const invented = numbersIn(trimmed.replace(/(\d),(\d{3})/g, "$1$2")).filter((n) => !allowed.has(n));
  if (invented.length > 0) return `invented figures: ${invented.join(", ")}`;

  if (person.name && trimmed.includes(person.name.split(" ").at(-1))) {
    return "repeats his name, which the card already shows";
  }
  return null;
}

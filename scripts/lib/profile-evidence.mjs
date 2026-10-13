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
import { NFL_TEAMS } from "./teams.mts";

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

const wordIn = (text, word) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);

/**
 * Which clubs a line names, and whether his current club is among them.
 *
 * A place two clubs share ("Los Angeles", "New York") counts for the current
 * one only, so a Rams line saying "Los Angeles" is not read as naming the
 * Chargers.
 */
export function teamsNamed(text, person) {
  const t = String(text ?? "");
  const current = NFL_TEAMS.find((x) => x.id === person?.teamId || x.displayName === person?.team);
  const namesCurrent = Boolean(current && (wordIn(t, current.location) || wordIn(t, current.name)));
  const others = NFL_TEAMS.filter(
    (x) =>
      x !== current &&
      (wordIn(t, x.name) || (wordIn(t, x.location) && x.location !== current?.location)),
  ).map((x) => x.displayName);
  return { namesCurrent, others };
}

/**
 * The stricter check for a line written for an older record.
 *
 * A trade changes his team, which moves the key — and until a replacement
 * validates, the old line stays up if it passes. problemWithBlurb only looks
 * at figures and his name, so "Cleveland's best defender" sailed through for
 * a man the record now has in Los Angeles. A line may still name a former
 * club — "traded from Cleveland to the Rams" is the useful version — but only
 * alongside his current one, which is what shows it was written knowing where
 * he is now.
 */
export function problemWithStaleBlurb(text, person, context = []) {
  const problem = problemWithBlurb(text, person, context);
  if (problem) return problem;
  const { namesCurrent, others } = teamsNamed(text, person);
  if (others.length > 0 && !namesCurrent) {
    return `names ${others.join(", ")} but not his current team (${person.team ?? "unknown"})`;
  }
  return null;
}

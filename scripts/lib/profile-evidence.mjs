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
import { approximations, spelledToDigits } from "./number-words.mjs";
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
export function problemWithBlurb(text, person, context = [], now = new Date()) {
  const trimmed = String(text ?? "").trim();
  const words = trimmed.split(/\s+/).length;
  // Two sentences: one placing him, one saying what kind of player he is.
  if (words < 25 || words > 80) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  const sentences = sentenceCount(trimmed);
  if (sentences > 3) return `${sentences} sentences, expected two`;

  // "4,721" in ESPN's strings reads as 4 and 721 otherwise; and the brief asks
  // for figures spelled out, which numbersIn cannot see without conversion.
  const digits = (s) => spelledToDigits(s).replace(/(\d),(\d{3})/g, "$1$2");

  // Exact figures: his record and the site's own prose. A floor is added only
  // to `allowed` — "more than 80" of a floored 80 is true, "nearly 80" is not.
  const exact = new Set(
    numbersIn(
      digits(
        [
          person.draft,
          person.age,
          person.experience,
          person.height,
          person.weight,
          JSON.stringify(person.awards ?? []),
          JSON.stringify(person.career ?? {}),
          ...context,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    ),
  );
  // A half-sack total floors to a whole one: "more than 125" of 125.5 is true.
  const allowed = new Set([
    ...exact,
    ...[...exact].map(Math.floor),
    ...numbersIn(JSON.stringify(careerAtLeast(person.career))),
  ]);

  const line = digits(trimmed);
  const invented = numbersIn(line).filter((n) => !allowed.has(n));
  if (invented.length > 0) return `invented figures: ${invented.join(", ")}`;

  const vague = approximations(line).filter(({ value }) => !exact.has(value));
  if (vague.length > 0) {
    return `approximates a figure the record does not have: ${vague.map((v) => `${v.hedge} ${v.value}`).join(", ")}`;
  }

  // "Still only 25" must be his age, not a figure that happens to be nearby.
  const age = line.match(/\b(?:still only|aged|age of)\s+(\d+)\b|\b(\d+)[\s-]years?[\s-]old\b/i);
  if (age && Number(age[1] ?? age[2]) !== Number(person.age)) {
    return `gives his age as ${age[1] ?? age[2]}; the record says ${person.age ?? "nothing"}`;
  }

  // "Reigning MVP" is a claim about last season. ESPN's awards carry seasons,
  // and Josh Allen's MVP is 2024's — the reigning one is 2025's.
  const reigning = trimmed.match(/\b(reigning|defending)\b/i);
  if (reigning) {
    const last = String(lastCompletedSeason(now));
    const current = (person.awards ?? []).some((a) => (a.seasons ?? []).map(String).includes(last));
    if (!current) return `calls him "${reigning[0]}" with no award from the ${last} season`;
  }

  if (person.name && trimmed.includes(person.name.split(" ").at(-1))) {
    return "repeats his name, which the card already shows";
  }
  return null;
}

/**
 * The most recent season whose awards have been handed out. Awards are
 * announced the week of the Super Bowl in February, so until March the one
 * before last still holds the titles.
 */
export function lastCompletedSeason(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 2 ? year - 1 : year - 2;
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

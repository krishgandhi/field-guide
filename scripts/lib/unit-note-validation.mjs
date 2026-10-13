/**
 * Validation for the Claude-written "what kind of unit is this" lines.
 *
 * Split out of write-unit-notes.mjs for the same reason draft-validation.mjs
 * was split out of draft-moves.mjs: the script calls the API at import time,
 * so nothing inside it could be tested without a key, and these guards are the
 * only thing standing between a generated line and a confident falsehood about
 * a real team. See tests/unit-note-validation.test.ts.
 */

import { numbersIn, sentenceCount } from "./draft-validation.mjs";
import { NFL_TEAMS } from "./teams.mts";

/**
 * Phrases that assert a transfer. The draft field cannot support any of them:
 * it says who drafted a player, not who he last played for. Left unchecked,
 * this produced "Bradley Chubb, who came from Denver" for a player Denver
 * drafted eight years ago — across 29 of 96 notes.
 */
export const ARRIVAL =
  /\b(came from|arrived from|joined from|signed from|acquired from|newly signed|new signing|just signed|traded for|brought in from)\b/i;

/**
 * Phrases that assert the head coach changed. Same shape of error as ARRIVAL:
 * the evidence used to carry only a name, and the model filled the rest in
 * from memory — "new head coach Klint Kubiak", "Jeff Hafley is new". Both
 * happened to be true, which is worse, not better: nothing in what we supplied
 * made them true, so the next one could just as easily be wrong.
 */
export const COACH_CHANGE =
  /\b(new head coach|new coach|newly appointed|takes? over|took over|is new|arriv\w+ to|new staff|previous staff|old staff|previous regime|old regime|since (?:been )?fired|was fired|replaced|inherit\w+)\b/i;

/**
 * How long a player has been in the league, as the note claims it. The model
 * inferred this from the draft year and called ten second-year players rookies
 * — the newest draft class in the data is not necessarily this year's.
 */
const TENURE = [
  [/\brookie\b/i, 1],
  [/\b(second[- ]year|sophomore)\b/i, 2],
  [/\bthird[- ]year\b/i, 3],
];

/**
 * Capitalised runs of two or more words — near enough to "a person's name".
 *
 * The character class has to admit a period, or "A.J. Terrell" arrives as two
 * fragments. That also means a name ending a sentence swallows the full stop
 * and runs into whatever is capitalised next: "second-year Maxwell Hairston.
 * Joe Brady's promotion" came back as one name and matched nobody, so the
 * guard rejected two notes that were correct. Split where a period follows a
 * real word — an initial is a single letter, so "A.J." survives.
 */
function namesIn(text) {
  return [...text.matchAll(/\b[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)+/g)]
    .flatMap((m) => m[0].split(/(?<=[a-z]{2})\.\s+/))
    .map((n) => n.replace(/[.,;:]+$/, "").trim())
    .filter((n) => n.split(/\s+/).length >= 2);
}

/** What is wrong with one note, or null if it can be published. */
export function problemWithNote(text, evidence) {
  const trimmed = String(text ?? "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words < 8 || words > 50) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  if (sentenceCount(trimmed) > 2) return "more than two sentences";

  // Same guard as everywhere else: a figure must trace to what we supplied.
  const allowed = new Set(numbersIn(JSON.stringify(evidence)));
  const invented = numbersIn(trimmed).filter((n) => !allowed.has(n));
  if (invented.length > 0) return `invented figures: ${invented.join(", ")}`;

  const moves = (evidence.recentMovesInvolvingThisTeam ?? []).join(" ");

  // An arrival may only be asserted when a move entry for this team records
  // it. Everything else is inference from a draft position.
  const arrival = trimmed.match(ARRIVAL);
  if (arrival) {
    const backed = namesIn(trimmed).some((n) => moves.includes(n.split(/\s+/).at(-1)));
    if (!backed) return `claims an arrival ("${arrival[0]}") with no move to support it`;
  }

  // A coaching change may only be asserted when the coach is in his first
  // season anywhere, or a coaching move for this team records it.
  const change = trimmed.match(COACH_CHANGE);
  if (change) {
    const firstSeason = evidence.headCoachSeasonsAsHeadCoach === 0;
    const surname = String(evidence.headCoach ?? "").split(/\s+/).at(-1);
    const inMoves = Boolean(surname) && moves.includes(surname);
    if (!firstSeason && !inMoves) {
      return `claims a coaching change ("${change[0]}") that the evidence does not show`;
    }
  }

  // "Rookie" and "second-year" must match somebody in the unit. Checked against
  // the players actually named in the note, so a note calling one man a rookie
  // while another rookie stands nearby still fails.
  // Straight substring search rather than namesIn: we are asking which of a
  // known list of players the note mentions, and a capitalised word in front
  // of a name ("Rookie Mansoor Delane") defeats any attempt to extract it.
  const mentioned = (evidence.keyPlayers ?? []).filter((p) => trimmed.includes(p.name));
  for (const [pattern, season] of TENURE) {
    if (!pattern.test(trimmed)) continue;
    if (!mentioned.some((p) => p.seasonInTheLeague === season)) {
      return `says "${trimmed.match(pattern)[0]}" of nobody it names who is in season ${season}`;
    }
  }

  return null;
}

/**
 * A style rule, kept apart from problemWithNote's truth rules: the coaching
 * situation is said once per team, in the offence note. The defence and
 * special-teams notes sit directly beneath it on the team page, and all three
 * Buffalo notes once ended "now under new head coach Joe Brady".
 *
 * Separate because it should block a NEW note but not take down an existing
 * one that is merely repetitive — settle() keeps an old line only while it
 * passes the truth rules, and a repeated coach's name is not untrue.
 */
export function repeatsCoaching(text, evidence) {
  if (!evidence?.unit || evidence.unit === "offence") return null;
  const trimmed = String(text ?? "").trim();
  const coach = String(evidence.headCoach ?? "").trim();
  if (/\bhead coach\b/i.test(trimmed) || (coach && trimmed.includes(coach)) || COACH_CHANGE.test(trimmed)) {
    return "mentions the head coach outside the offence note";
  }
  return null;
}

/**
 * Capitalised words that are not people. Checked case-sensitively against
 * single tokens, after possessives are stripped.
 */
const NOT_PEOPLE = new Set(
  (
    "NFL AFC NFC MVP Super Bowl Pro All Bowler Defensive Offensive Player Year Rookie " +
    "Comeback Hall Fame East West North South Conference League Football National American " +
    // Where clubs used to be, which draft-position phrasing still names.
    "Oakland San Diego St Louis " +
    "Jr Sr II III IV I Week Sunday Monday Thursday Saturday Friday " +
    "January February March April May June July August September October November December"
  ).split(" "),
);

/** Words the team registry uses, so "the Rams" or "Kansas City" is never read as a person. */
const TEAM_WORDS = new Set(NFL_TEAMS.flatMap((t) => `${t.location} ${t.name}`.split(/\s+/)));

/** Strip a possessive and trailing punctuation: "O'Connell's," → "O'Connell". */
const bare = (token) =>
  token
    .replace(/^[("“‘']+/, "")
    .replace(/[.,;:!?)"”’]+$/, "")
    .replace(/(?:'s|’s|')$/, "");

/**
 * People a note names who are not in the evidence it is checked against —
 * the unit's key players and the head coach as they stand today.
 *
 * Used on lines written for older evidence. New text is held to the brief's
 * own "never mention a player who is not in the evidence"; an old line was
 * true of a depth chart and a staff that may have changed since. A Vikings
 * note about J.J. McCarthy, kept after Kyler Murray took the job, passes every
 * other check — no figure is invented, nothing claims an arrival — and is
 * simply wrong.
 *
 * Vouched names are blanked out first. Then any capitalised word left that is
 * not a team word or a known non-name ("Super Bowl") is someone we cannot
 * vouch for — except a sentence's first word, which is capitalised whatever it
 * is ("Leans", "Under"), unless the next word is an unknown name too ("Sean
 * McDermott's offence…"). Fails closed: an unrecognised proper noun costs a
 * stale line until the next rewrite, never puts a wrong one up.
 */
export function peopleNotInEvidence(text, evidence) {
  const names = [...(evidence?.keyPlayers ?? []).map((p) => p?.name), evidence?.headCoach]
    .filter((n) => typeof n === "string" && n.trim())
    // Longest first, so "Marvin Harrison Jr." goes before "Marvin Harrison".
    .sort((a, b) => b.length - a.length);
  const vouched = new Set(names.flatMap((n) => n.split(/[\s-]+/).map(bare)));

  let rest = String(text ?? "");
  for (const n of names) rest = rest.split(n).join("someone");

  const unknownToken = (token) => {
    const b = bare(token ?? "");
    return /^[A-Z]/.test(b) && !NOT_PEOPLE.has(b) && !TEAM_WORDS.has(b) && !vouched.has(b);
  };

  const unknown = new Set();
  // Split sentences only after a real word, so "A.J." is not a full stop.
  for (const sentence of rest.split(/(?<=[a-z0-9)]{2}[.!?])\s+/)) {
    // Hyphens split too: "Super Bowl-winning" is two known words and a lowercase one.
    const tokens = sentence.split(/[\s—–-]+/).filter(Boolean);
    tokens.forEach((token, i) => {
      if (!unknownToken(token)) return;
      if (i === 0 && !unknownToken(tokens[1])) return;
      unknown.add(bare(token));
    });
  }
  return [...unknown];
}

/**
 * The stricter check for a line written for evidence that has since changed:
 * everything problemWithNote asks, plus every person it names must still be
 * in the unit or running the team.
 */
export function problemWithStaleNote(text, evidence) {
  const problem = problemWithNote(text, evidence);
  if (problem) return problem;
  const unknown = peopleNotInEvidence(text, evidence);
  if (unknown.length > 0) return `names people the current evidence does not: ${unknown.join(", ")}`;
  return null;
}

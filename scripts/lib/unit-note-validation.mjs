/**
 * Validation for the Claude-written "what kind of unit is this" lines.
 *
 * Split out of write-unit-notes.mjs for the same reason draft-validation.mjs
 * was split out of draft-moves.mjs: the script calls the API at import time,
 * so nothing inside it could be tested without a key, and these guards are the
 * only thing standing between a generated line and a confident falsehood about
 * a real team. See scripts/test-unit-notes.mjs.
 */

import { numbersIn, sentenceCount } from "./draft-validation.mjs";

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

/** Capitalised runs of two or more words — near enough to "a person's name". */
function namesIn(text) {
  return [...text.matchAll(/\b[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)+/g)]
    .map((m) => m[0])
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
  const named = namesIn(trimmed);
  const players = evidence.keyPlayers ?? [];
  for (const [pattern, season] of TENURE) {
    if (!pattern.test(trimmed)) continue;
    const matches = named
      .map((n) => players.find((p) => p.name === n))
      .filter(Boolean)
      .some((p) => p.seasonInTheLeague === season);
    if (!matches) {
      return `says "${trimmed.match(pattern)[0]}" of nobody it names who is in season ${season}`;
    }
  }

  return null;
}

/**
 * Validation for Claude-written game reasons.
 *
 * Split out of write-reasons.mjs so it can be tested without an API key, and
 * because it now carries the name guard — the thing standing between a
 * grounded preview and a confident sentence about a player who isn't playing.
 */

/** Words that mean nothing to a newcomer, which is the entire audience. */
export const BANNED = [
  "leverage", "implication", "seeding", "efficiency", "variance",
  "spread", "matchup", "elite", "storyline", "momentum",
];

/**
 * Proper nouns of two or more capitalised words: "Josh Allen", "J.J. McCarthy".
 *
 * Two words is the useful threshold. A single capitalised word is usually a
 * sentence opener or a team name, both harmless; a player's name is almost
 * always two. Handles initials and hyphenated surnames.
 */
const PROPER_NOUN = /\b([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)+)/g;

/** "Allen's" and "Allen’s" both reduce to "Allen". */
function stripPossessive(s) {
  return s.replace(/['’]s\b/g, "").trim();
}

/**
 * Capitalised words that carry no identity.
 *
 * Without this, a sentence opening "The Bills visit..." reads as the two-word
 * proper noun "The Bills" and gets rejected for not appearing in the article —
 * a false positive that would silently throw away perfectly good sentences.
 */
const NEUTRAL = new Set([
  "the", "a", "an", "and", "but", "if", "when", "while", "with", "for", "at",
  "in", "on", "this", "that", "these", "those", "their", "his", "her", "its",
  "he", "she", "they", "it", "after", "before", "both", "two", "no", "not",
  "every", "one", "there", "here", "you", "your", "watch", "expect",
]);

/**
 * Proper nouns that belong to football rather than to a person, so they need
 * no backing from the reporting.
 */
const COMMON = new Set([
  "nfl", "afc", "nfc", "super", "bowl", "sunday", "monday", "tuesday",
  "wednesday", "thursday", "friday", "saturday", "night", "football",
  "thanksgiving", "christmas", "january", "february", "march", "april", "may",
  "june", "july", "august", "september", "october", "november", "december",
]);

/**
 * Names the sentence may use without the article backing them up: the two
 * teams playing, their cities and nicknames.
 */
function allowedNames(game, teamName) {
  const out = new Set();
  for (const id of [game.home, game.away]) {
    const full = teamName(id);
    if (!full) continue;
    out.add(full.toLowerCase());
    for (const word of full.split(/\s+/)) out.add(word.toLowerCase());
  }
  return out;
}

/**
 * Everything wrong with a generated sentence, or null if it's fine.
 *
 * `sourceText` is the article headlines and descriptions the model was shown.
 * Any two-word proper noun in the sentence must appear there — that's what
 * makes naming players safe. Numbers stay banned outright: they're where
 * fabrication does real damage and the sentence never needs one.
 */
export function problemWith(text, game, { teamName, allTeamNames, sourceText = "" }) {
  const trimmed = String(text ?? "").trim();
  const words = trimmed.split(/\s+/).length;
  if (words < 6 || words > 26) return `${words} words`;
  if (!/[.!?]$/.test(trimmed)) return "no end punctuation";
  if (/\d/.test(trimmed)) return "contains a number";

  const lower = trimmed.toLowerCase();
  const banned = BANNED.find((w) => lower.includes(w));
  if (banned) return `jargon "${banned}"`;

  const ours = new Set([teamName(game.home), teamName(game.away)]);
  const stray = allTeamNames.find((n) => !ours.has(n) && trimmed.includes(n));
  if (stray) return `names "${stray}", who aren't in this game`;

  // The name guard.
  const allowed = allowedNames(game, teamName);
  const haystack = sourceText.toLowerCase();
  for (const match of trimmed.matchAll(PROPER_NOUN)) {
    let words = stripPossessive(match[1]).split(/\s+/).filter(Boolean);
    // Trim neutral words off both ends: "The Bills" → "Bills".
    while (words.length && NEUTRAL.has(words[0].toLowerCase())) words.shift();
    while (words.length && NEUTRAL.has(words.at(-1).toLowerCase())) words.pop();

    // One word left is a team name or a sentence opener, never a player.
    if (words.length < 2) continue;

    const lowered = words.map((w) => w.toLowerCase());
    if (lowered.every((w) => allowed.has(w) || COMMON.has(w))) continue;

    const phrase = words.join(" ");
    if (!haystack.includes(phrase.toLowerCase())) {
      return `names "${phrase}", which isn't in the source reporting`;
    }
  }

  return null;
}

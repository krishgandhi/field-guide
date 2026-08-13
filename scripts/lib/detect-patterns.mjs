/**
 * Which news headlines are worth a second look, and what they probably are.
 *
 * Split out of detect-moves.mjs so it can be tested — that script fetches at
 * import time, so anything left inside it is unreachable from a test. These
 * patterns decide what reaches Claude, and a silent regression here means the
 * pipeline just quietly stops noticing trades.
 *
 * This is a PRE-FILTER, never a decision. It cuts obvious noise; whether
 * something is genuinely a Moves entry is judgement, and that belongs to the
 * model or to a human.
 */

/**
 * Words that suggest a transaction rather than a game story.
 *
 * Cover every inflection, not just the past tense. "Dolphins releasing QB Tua
 * Tagovailoa" was the real headline on the largest cap event of the offseason
 * and an earlier `released?` walked straight past it — reporting uses the
 * present participle for a deal that is still landing, which is exactly when
 * it's news.
 */
export const TRANSACTION =
  /\b(trad(?:e|es|ed|ing)|acquir(?:e|es|ed|ing)|sign(?:s|ed|ing)?|agree(?:s|d)? to terms|extension|extend(?:s|ed|ing)?|releas(?:e|es|ed|ing)|waiv(?:e|es|ed|ing)|cut|franchise tag(?:s|ged)?|restructur\w*|claimed off waivers)\b/i;

/**
 * A starting job changing hands. Not a transaction, but often a bigger deal
 * than one — Minnesota naming Kyler Murray over J.J. McCarthy moved nothing
 * and no money, and it's the story of their season.
 *
 * Written against the five real wordings that story appeared under, because
 * the obvious pattern ("named starter") matched none of them: the actual
 * headlines all say "starting quarterback" or "starting QB".
 */
export const ROLE =
  /\b(?:starting\s+(?:week\s+\d+\s+)?(?:quarterback|qb|job|role)|names?\s+(?:\w+\s+){0,4}?(?:the\s+)?starter|wins?\s+the\s+(?:starting\s+)?job|benched?|demoted|promoted to starter|will start (?:at|over)|depth chart)\b/i;

/**
 * Season-altering injuries only. A newcomer needs to know a team lost its
 * quarterback for the year; he does not need "questionable, ankle".
 */
export const SEASON_ENDING =
  /\b(out for the (?:season|year)|season[- ]ending|torn (?:ACL|Achilles|patellar)|ruptured|placed on injured reserve|done for the (?:season|year)|miss(?:es|ed|ing)? the (?:rest of the )?season)\b/i;

/** Noise that survives the verb filters. Fantasy is the biggest by volume. */
export const NOISE =
  /\b(fantasy|start[\s/]?sit|waiver wire|draft kit|power rankings?|mock draft|betting odds|best bets|prop bets?|survivor pool|injury report|questionable|doubtful|ruled out|expected to miss|practice squad|preseason recap)\b/i;

/**
 * null to skip, otherwise a hint at what kind of entry this would be.
 *
 * Order is load-bearing: a season-ending injury is admitted BEFORE the noise
 * filter runs, because that filter deliberately throws away routine injury
 * coverage and would otherwise take the season-enders with it.
 */
export function classify(text) {
  if (SEASON_ENDING.test(text)) return "injury";
  const transaction = TRANSACTION.test(text);
  const role = ROLE.test(text);
  if (!transaction && !role) return null;
  if (NOISE.test(text)) return null;
  return role && !transaction ? "role" : "transaction";
}

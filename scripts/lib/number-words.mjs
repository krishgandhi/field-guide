/**
 * Figures written as words, for the "no invented figures" guards.
 *
 * numbersIn() only sees digits, and the profile brief tells the model to
 * spell figures out ("more than four thousand career rushing yards"). So
 * every spelled-out number sailed past the check: "nearly eighty career
 * rushing touchdowns" (the record says 86), "still only twenty-five" (he is
 * 26), "nearly ninety starts" (no such figure anywhere in the evidence).
 *
 * spelledToDigits() rewrites cardinal number words as digits so the existing
 * check can see them. approximations() finds "nearly N", "about N" and the
 * like, which the guards hold to a stricter standard: an approximation has to
 * be of a figure actually in the record, not of a floor we derived from it —
 * "nearly 80" of a floored 80 is wrong when the real total is 86.
 *
 * Deliberately left alone:
 *   - a lone "one" ("one of the best quarterbacks") — a pronoun far more often
 *     than a count. "Twenty-one" and "one hundred" are still converted.
 *   - ordinals ("ninth season", "seventh overall"). They describe the draft
 *     and experience fields almost always, and "first" is too idiomatic to
 *     check without false alarms.
 */

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/** Multipliers folded into the figure. */
const SCALES = { hundred: 100, thousand: 1000 };
/**
 * Kept as a word after the digits, because that is how sourced text writes
 * them: "$132 million" reads as 132 to numbersIn, so "a hundred and thirty
 * million" must become "130 million", not 130000000.
 */
const SUFFIXES = new Set(["million", "billion"]);

const WORDS = [...Object.keys(UNITS), ...Object.keys(TENS), ...Object.keys(SCALES), "dozen", ...SUFFIXES];
const WORD = `(?:${WORDS.join("|")})`;
/** A run of number words, optionally led by "a"/"an" and joined by spaces, hyphens or "and". */
// The lookahead keeps an ordinal compound whole: "twenty-fifth overall" is
// an ordinal, and reading its first half as 20 would invent a figure.
const PHRASE = new RegExp(
  `\\b(?:an?\\s+)?${WORD}(?:(?:\\s+and\\s+|[\\s-]+)${WORD})*\\b(?!-(?:first|second|third|\\w+th)\\b)`,
  "gi",
);

/** Parse one run's words into a value; null if it isn't a figure on its own. */
function parse(words) {
  let total = 0;
  let current = 0;
  let suffix = "";
  let seen = false;
  for (const w of words) {
    if (w in UNITS) current += UNITS[w];
    else if (w in TENS) current += TENS[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (w === "dozen") current = (current || 1) * 12;
    else if (SUFFIXES.has(w)) suffix = ` ${w}`;
    seen = true;
  }
  return seen ? `${total + current}${suffix}` : null;
}

/**
 * Split a matched run where "and" joins two separate figures ("two and
 * three") rather than continuing one ("a hundred and twenty").
 */
function figuresOf(run) {
  const tokens = run.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const groups = [[]];
  tokens.forEach((t, i) => {
    if (t === "a" || t === "an") return;
    if (t === "and") {
      if (!SCALES[tokens[i - 1]]) groups.push([]);
      return;
    }
    groups.at(-1).push(t);
  });
  return groups.filter((g) => g.length > 0);
}

/** "more than four thousand" → "more than 4000". */
export function spelledToDigits(text) {
  return String(text ?? "").replace(PHRASE, (run) => {
    const groups = figuresOf(run);
    // A bare "one" — or "a million"-style vagueness with no count — stays.
    if (groups.length === 1 && groups[0].length === 1 && groups[0][0] === "one") return run;
    if (groups.length === 1 && groups[0].every((w) => SUFFIXES.has(w))) return run;
    const parts = groups.map(parse).filter(Boolean);
    return parts.length ? parts.join(" and ") : run;
  });
}

/** Hedges that say "this is roughly a real figure". */
const HEDGE =
  /\b(nearly|almost|about|around|roughly|approximately|close to|just under|just shy of|the best part of)\s+\$?(\d[\d,]*(?:\.\d+)?)/gi;

/** Figures written as approximations: [{ hedge, value }]. Expects digits (run spelledToDigits first). */
export function approximations(text) {
  return [...String(text ?? "").matchAll(HEDGE)].map((m) => ({
    hedge: m[1].toLowerCase(),
    value: Number(m[2].replace(/,/g, "")),
  }));
}

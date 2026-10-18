/**
 * What a move's 1–5 bigness score is called, in one place.
 *
 * The words used to live twice — in BignessPill and in the moves list's size
 * filter — and nothing stopped them drifting apart. Import-free so the client
 * list can use it without pulling content code into the browser.
 *
 * 1 and 2 share "Minor": the filter groups them, and the difference between
 * a footnote and a smaller footnote isn't worth a word of its own.
 */
export type BignessWord = "Huge" | "Big" | "Notable" | "Minor";

export function bignessWord(score: number): BignessWord {
  if (score >= 5) return "Huge";
  if (score === 4) return "Big";
  if (score === 3) return "Notable";
  return "Minor";
}

/** "Huge · 5" — the word first, the number second. */
export function bignessLabel(score: number): string {
  return `${bignessWord(score)} · ${score}`;
}

/** The size filter on /moves, biggest first. `value` is what the filter matches. */
export const SIZE_FILTERS: { value: string; label: BignessWord }[] = [
  { value: "5", label: bignessWord(5) },
  { value: "4", label: bignessWord(4) },
  { value: "3", label: bignessWord(3) },
  { value: "1-2", label: bignessWord(2) },
];

/** Does a score fall in a SIZE_FILTERS value ("all" matches everything)? */
export function matchesSize(score: number, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "1-2") return score <= 2;
  return score === Number(filter);
}

/**
 * A 1–5 watchability score as a jersey numeral (§10).
 *
 * 5 is solid yellow, 4 a yellow outline, 3 a chalk outline, 1–2 quiet — so
 * the eye can sort a page of games before reading a word. Always rendered
 * with its two-word label here and a plain sentence beside it: a bare number
 * is exactly what §1 says this product exists to replace.
 *
 * watchability.ts returns only the number, so the words live here. "Must
 * watch", "Good watch" and "If it's on" come from the approved proposal;
 * "Worth it" is what the previous game card said for a 4, and "Skip it"
 * replaces its "Skippable", which doesn't fit a 48px tile.
 */
export const WATCH_LABELS: Record<number, [string, string]> = {
  5: ["Must", "watch"],
  4: ["Worth", "it"],
  3: ["Good", "watch"],
  2: ["If it's", "on"],
  1: ["Skip", "it"],
};

/** "Must watch" — the label as one phrase, for screen readers and summaries. */
export function watchLabel(score: number): string {
  return WATCH_LABELS[clamp(score)].join(" ");
}

function clamp(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

const TILE: Record<number, { numeral: string; label: string }> = {
  5: { numeral: "bg-yellow text-night", label: "text-yellow" },
  4: { numeral: "ring-2 ring-inset ring-yellow text-yellow", label: "text-yellow" },
  3: { numeral: "ring-2 ring-inset ring-chalk text-chalk", label: "text-chalk" },
  2: { numeral: "bg-surface-2 text-chalk-dim", label: "text-chalk-dim" },
  1: { numeral: "bg-surface-2 text-chalk-dim", label: "text-chalk-dim" },
};

export function RatingTile({ score }: { score: number }) {
  const s = clamp(score);
  const [top, bottom] = WATCH_LABELS[s];
  const style = TILE[s];
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-[3px]">
      <span
        aria-hidden
        className={`grid h-[52px] w-12 place-items-center rounded-[var(--radius-inner)] pt-0.5 font-display text-4xl font-black leading-none ${style.numeral}`}
      >
        {s}
      </span>
      {/* One phrase for assistive tech; the visual stack is split for width. */}
      <span className="sr-only">
        {watchLabel(s)}, {s} out of 5
      </span>
      <span
        aria-hidden
        className={`label-sm text-center ${style.label}`}
      >
        {top}
        <br />
        {bottom}
      </span>
    </div>
  );
}

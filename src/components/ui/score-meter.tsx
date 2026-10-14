/**
 * A 1–5 score as five dots.
 *
 * Used for the move rubric axes (§7). Rounded rather than the hard blocks of
 * the old call-sheet treatment, and yellow only at the top of the range so a 5
 * reads differently from a 3 at a glance.
 *
 * Always rendered next to the sentence that explains it — a bare number with
 * no explanation is exactly what §1 says this product exists to replace.
 */
export function ScoreMeter({
  value,
  max = 5,
  label,
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const filled = Math.max(0, Math.min(max, Math.round(value)));

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < filled
                ? filled >= 4
                  ? "bg-yellow"
                  : "bg-chalk/50"
                : "bg-chalk/15"
            }`}
          />
        ))}
      </span>
      <span className="tnum text-xs font-semibold text-chalk-dim">{filled}</span>
      <span className="sr-only">
        {label}: {filled} out of {max}
      </span>
    </span>
  );
}

/**
 * The headline "how big is this" number, for move cards. Bigger and louder
 * than the per-axis dots, because it's the thing you scan a list by.
 */
export function BignessPill({ value }: { value: number }) {
  const big = value >= 4;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${
        big
          ? "bg-yellow text-night"
          : "border border-line text-chalk-dim"
      }`}
    >
      {value >= 5
        ? "Huge"
        : value === 4
          ? "Big"
          : value === 3
            ? "Notable"
            : "Minor"}
    </span>
  );
}

/**
 * A 1–5 score as five blocks — the call-sheet way of showing a rating (§10:
 * dense, gridded, colour-coded by urgency).
 *
 * Used for both watchability (§8) and the move rubric axes (§7). Amber marks
 * the high end because §10 assigns amber to "watch this".
 *
 * The number is always rendered alongside, and every caller pairs it with a
 * sentence — a bare score with no explanation is the thing §1 rules out.
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
    <span className="inline-flex items-center gap-1.5" title={`${label}: ${filled} of ${max}`}>
      <span aria-hidden className="flex gap-[2px]">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-[6px] ${
              i < filled
                ? filled >= 4
                  ? "bg-amber"
                  : "bg-fg/60"
                : "bg-fg/15"
            }`}
          />
        ))}
      </span>
      <span className="font-data text-xs tabular-nums text-fg/70">
        {filled}
      </span>
      <span className="sr-only">
        {label}: {filled} out of {max}
      </span>
    </span>
  );
}

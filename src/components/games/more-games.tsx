import { ChevronDown } from "lucide-react";

/**
 * The games scoring a 1 — "nothing much riding on this one" is literally
 * what the scoring says about them — folded behind one row, so the page
 * leads with what is worth his time without hiding anything.
 *
 * Native <details>: keyboard, screen reader and no-JavaScript behaviour come
 * free, and there is no state to keep. Presentational only (no data imports),
 * because TimedSlate renders it in the browser once it knows which games are
 * still to come.
 */
export function MoreGames({
  count,
  logos,
  children,
}: {
  count: number;
  /** A few team logos, already rendered, for the summary row. */
  logos: React.ReactNode;
  /** The folded game cards. */
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <details className="group mt-2.5">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3 transition-colors duration-[120ms] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex shrink-0 [&_img+img]:-ml-1 [&>span+span]:-ml-1">
          {logos}
        </span>
        <span className="flex-1 text-[14.5px] leading-[1.35]">
          <b className="font-bold text-chalk">{count} more</b>{" "}
          <span className="text-chalk-dim">with nothing much riding on them</span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden
          className="shrink-0 text-chalk-dim transition-transform duration-[120ms] group-open:rotate-180"
        />
      </summary>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </details>
  );
}

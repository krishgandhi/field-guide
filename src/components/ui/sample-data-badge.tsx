/**
 * The always-visible marker that a screen is showing invented data.
 *
 * Not a dev-only marker. A watchability score that looks authoritative but was
 * placed by hand is precisely the failure this product exists to prevent
 * (CLAUDE.md §1), so it says so on screen, in production, every time.
 *
 * Remove the badge from a screen only when that screen's data is genuinely real.
 */
export function SampleDataBadge({ note }: { note?: string }) {
  return (
    <p className="font-data mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 border-amber bg-amber/10 py-1.5 pl-2 pr-2 text-[0.65rem] uppercase tracking-[0.15em] text-graphite/70">
      <span className="font-semibold text-graphite">Sample data</span>
      {note ? <span className="normal-case tracking-normal">{note}</span> : null}
    </p>
  );
}

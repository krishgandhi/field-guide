import { STANDINGS, finishLabel, inTopSeven, recordFor, recordLabel } from "@/lib/standings";

/**
 * A team's record and how they finished.
 *
 * Says which season it is out loud. Before week 1 these are last season's
 * finals — showing "0-0" for everyone would look broken, and showing last
 * year's numbers without saying so would be worse.
 */
export function RecordStrip({ teamId }: { teamId: string }) {
  const record = recordFor(teamId);
  if (!record) return null;

  const made = inTopSeven(record);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="tnum text-xl font-bold tracking-tight text-fg">
        {recordLabel(record)}
      </span>
      <span
        className={`text-sm ${made ? "text-amber" : "text-fg-dim"}`}
      >
        {finishLabel(teamId)}
      </span>
      <span className="ml-auto text-[0.7rem] uppercase tracking-wider text-fg-dim/70">
        {STANDINGS.isPreviousSeason
          ? `${STANDINGS.season} final`
          : `${STANDINGS.season} season`}
      </span>
    </div>
  );
}

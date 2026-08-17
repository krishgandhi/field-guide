import { ScoreMeter } from "@/components/ui/score-meter";
import { Card } from "@/components/ui/page-header";
import type { Unit } from "@/lib/team-detail";

/**
 * How good a unit is, and who's in it.
 *
 * The rating is a rank out of 32 turned into the same 1–5 the rubric and the
 * watchability score use, so a number on this site always means the same
 * thing. The sentence beside it is derived from the same score, never
 * separately — deriving them apart once produced four dots next to the words
 * "middle of the league".
 *
 * Names are plain text, not links: there are no player pages, and a dead link
 * is worse than no link.
 */
export function UnitCard({ title, unit }: { title: string; unit: Unit }) {
  const hasPlayers = unit.players.length > 0;
  if (!hasPlayers && unit.score === null) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {unit.score !== null ? (
          <ScoreMeter value={unit.score} label={title} />
        ) : null}
      </div>

      {/* The characterisation leads, because "a run-first team built around
          Josh Allen" is what someone actually wants to know. The rank sits
          under it as the caption for the meter — short, and never wrong. */}
      {unit.blurb ? (
        <p className="mt-1.5 text-sm leading-snug text-fg">{unit.blurb}</p>
      ) : null}
      <p
        className={`text-[0.78rem] leading-snug text-fg-dim ${
          unit.blurb ? "mt-1.5" : "mt-1.5 text-sm"
        }`}
      >
        {unit.note}
      </p>

      {hasPlayers ? (
        <ul className="mt-3 space-y-1.5">
          {unit.players.map((player) => (
            <li
              key={`${player.id}-${player.label}`}
              className="flex items-baseline gap-2.5 text-sm"
            >
              <span className="w-8 shrink-0 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-dim">
                {player.label}
              </span>
              <span className="min-w-0 text-fg">{player.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

import type { Metadata } from "next";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import {
  BYE_TEAMS,
  BILLS_BYE_WEEK,
  CURRENT_WEEK,
  slateInViewingOrder,
} from "@/lib/mock/games";
import { shortName } from "@/lib/mock/teams";

export const metadata: Metadata = {
  title: "Games — Field guide",
  description: "What's on this week and which ones are worth your time.",
};

const KICKOFF_LABEL: Record<string, string> = {};

function kickoffLabel(iso: string) {
  if (KICKOFF_LABEL[iso]) return KICKOFF_LABEL[iso];
  const d = new Date(iso);
  // Fixed timezone so the server and the browser agree — otherwise the
  // prerendered HTML and the client render disagree and React complains.
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(d);
  KICKOFF_LABEL[iso] = label;
  return label;
}

/**
 * The slate, ordered for deciding what to turn on (§8): Bills first regardless
 * of score, then by how watchable the game is.
 *
 * Deliberately NOT live scores — §2 rules those out. This screen exists to be
 * read *before* kickoff.
 */
export default function GamesPage() {
  const slate = slateInViewingOrder();

  return (
    <PageShell>
      <PageHeader kicker={`Week ${CURRENT_WEEK}`} title="What to watch" />

      <SampleDataBadge note="Real matchups and times. Ratings and reasons are placeholders." />

      <ul className="mt-4">
        {slate.map((game) => {
          const isBills = game.home === "BUF" || game.away === "BUF";
          return (
            <li
              key={game.id}
              className={`border-b border-graphite/15 ${
                isBills ? "border-l-4 border-l-royal pl-3" : ""
              }`}
            >
              <div className="flex min-h-14 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display condensed text-lg font-semibold">
                    {shortName(game.away)} at {shortName(game.home)}
                  </p>
                  <p className="font-data text-[0.65rem] uppercase tracking-[0.15em] text-graphite/55">
                    {kickoffLabel(game.kickoff)}
                    {game.window ? ` · ${game.window}` : ""}
                  </p>
                </div>
                <ScoreMeter value={game.watchability} label="Worth watching" />
              </div>
              <p className="-mt-1 pb-3 text-sm leading-snug text-graphite/80">
                {game.reason}
              </p>
            </li>
          );
        })}
      </ul>

      {/* §13: a team not playing is not a bug, and the UI must say so. */}
      <div className="mt-8 border-l-2 border-graphite/30 py-2 pl-3">
        <h2 className="font-display condensed text-sm font-semibold uppercase tracking-wide">
          Nobody is on a bye this week
        </h2>
        <p className="mt-1 text-sm leading-snug text-graphite/75">
          {BYE_TEAMS.length === 0
            ? `Every team plays in week ${CURRENT_WEEK}. Byes — weeks where a team doesn't play at all — start in week 5. Buffalo's is week ${BILLS_BYE_WEEK}.`
            : `${BYE_TEAMS.map(shortName).join(", ")} are not playing. That's a bye, not a mistake.`}
        </p>
      </div>
    </PageShell>
  );
}

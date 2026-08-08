import type { Metadata } from "next";
import { GameCard } from "@/components/game-card";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import {
  BILLS_BYE_WEEK,
  BYE_TEAMS,
  CURRENT_WEEK,
  slateInViewingOrder,
} from "@/lib/mock/games";
import { teamName } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Games — Field guide",
  description: "What's on this week and which ones are worth your time.",
};

// Fixed timezone so the prerendered HTML and the browser agree — otherwise
// React reports a hydration mismatch on anyone not in Eastern.
const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/**
 * The slate, ordered for deciding what to turn on (§8): Bills first regardless
 * of score, then by how watchable the game is.
 *
 * Deliberately NOT live scores — §2 rules those out. This screen is read
 * *before* kickoff.
 */
export default function GamesPage() {
  const slate = slateInViewingOrder();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-8 sm:px-6">
      <header>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
          Week {CURRENT_WEEK}
        </p>
        <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-fg">
          What to watch
        </h1>
      </header>

      <SampleDataBadge note="Real matchups and times. Ratings and reasons are placeholders." />

      <div className="mt-5 space-y-3">
        {slate.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            timeLabel={fmt.format(new Date(game.kickoff))}
            highlight={game.home === "BUF" || game.away === "BUF"}
          />
        ))}
      </div>

      {/* §13: a team not playing is not a bug, and the UI must say so. */}
      <section className="mt-6 rounded-2xl border border-line bg-surface/60 p-4">
        <h2 className="text-sm font-semibold text-fg">
          {BYE_TEAMS.length === 0
            ? "Nobody is off this week"
            : "Not playing this week"}
        </h2>
        <p className="mt-1 text-sm leading-snug text-fg-dim">
          {BYE_TEAMS.length === 0
            ? `All 32 teams play in week ${CURRENT_WEEK}. Byes — weeks where a team doesn't play at all — start in week 5. Buffalo's is week ${BILLS_BYE_WEEK}.`
            : `${BYE_TEAMS.map(teamName).join(", ")} are on a bye. That's a scheduled week off, not a mistake.`}
        </p>
      </section>
    </div>
  );
}

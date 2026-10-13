import type { Metadata } from "next";
import { GameCard } from "@/components/game-card";
import { SLATE } from "@/lib/slate";
import { StaleBanner } from "@/components/stale-banner";
import { sortForViewing } from "@/lib/watchability";
import { teamName } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Games — Field guide",
  description: "What's on this week and which ones are worth your time.",
};

// Fixed timezone so the prerendered HTML and the browser agree — otherwise
// React reports a hydration mismatch for anyone outside Eastern.
const time = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});
const day = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "America/New_York",
});

/**
 * The week's real slate, ordered for deciding what to turn on (§8): Bills
 * first regardless of score, then by how watchable the game is.
 *
 * Reads the JSON that GitHub Actions commits — never ESPN at request time (§4).
 * Deliberately NOT live scores; §2 rules those out. This is read before kickoff.
 */
export default function GamesPage() {
  const slate = sortForViewing(SLATE.games, SLATE.week);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-8 sm:px-6">
      <header>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
          Week {SLATE.week}
        </p>
        <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-fg">
          What to watch
        </h1>
        <p className="mt-1.5 text-sm text-fg-dim">
          {SLATE.games.length} games · updated {day.format(new Date(SLATE.fetchedAt))}
        </p>
      </header>

      <StaleBanner fetchedAt={SLATE.fetchedAt} />

      <div className="mt-5 space-y-3">
        {slate.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            week={SLATE.week}
            timeLabel={time.format(new Date(game.kickoff))}
            highlight={game.home === "BUF" || game.away === "BUF"}
          />
        ))}
      </div>

      {/* §13: a team not playing is not a bug, and the UI must say so. */}
      <section className="mt-6 rounded-2xl border border-line bg-surface/60 p-4">
        <h2 className="text-sm font-semibold text-fg">
          {SLATE.byes.length === 0 ? "Nobody is off this week" : "Not playing this week"}
        </h2>
        <p className="mt-1 text-sm leading-snug text-fg-dim">
          {SLATE.byes.length === 0
            ? `All 32 teams play in week ${SLATE.week}.`
            : `${SLATE.byes.map(teamName).join(", ")} are on a bye — a scheduled week off, not a mistake.`}
        </p>
      </section>
    </div>
  );
}

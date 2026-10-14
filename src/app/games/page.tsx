import type { Metadata } from "next";
import { FlagCountButton } from "@/components/flag/flag-count-button";
import { ByeCard } from "@/components/games/bye-card";
import { kickoffLabel } from "@/components/games/format";
import { GameCard } from "@/components/games/game-card";
import { PlayedGameRow, StartedGameCard } from "@/components/games/started-game-card";
import { TeamLogo } from "@/components/games/team-logo";
import { TimedSlate } from "@/components/games/timed";
import { StaleBanner } from "@/components/stale-banner";
import { PageShell } from "@/components/ui/page-header";
import { PageTitle } from "@/components/ui/page-title";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { gamePhase } from "@/lib/game-phase";
import { createExplainer } from "@/lib/glossary/explain";
import { SLATE } from "@/lib/slate";
import { sortForViewing, watchability } from "@/lib/watchability";

export const metadata: Metadata = {
  title: "Games — Field guide",
  description: "What's on this week and which ones are worth your time.",
};

const YOURS = "BUF";

/**
 * The week's real slate, ordered for deciding what to turn on (§8): Bills
 * first regardless of score, then by how watchable the game is. Games the
 * scoring rates a 1 fold into one row at the bottom.
 *
 * Reads the JSON that GitHub Actions commits — never ESPN at request time (§4).
 * Deliberately NOT live scores; §2 rules those out. This is read before kickoff,
 * so a game that has kicked off drops out of the ranking into "Already
 * played" — decided in the browser (TimedSlate), because this page is built
 * once and would otherwise freeze "upcoming" at build time.
 */
export default function GamesPage() {
  const explain = createExplainer();
  const slate = sortForViewing(SLATE.games, SLATE.week);
  const isYours = (g: (typeof slate)[number]) => g.home === YOURS || g.away === YOURS;
  // Scoring a 1 means "nothing much riding on it": those fold into one row.
  const folds = (g: (typeof slate)[number]) =>
    !isYours(g) && watchability(g, SLATE.week).score <= 1;

  const items = slate.map((game) => ({
    id: game.id,
    kickoff: game.kickoff,
    serverPhase: gamePhase(game.kickoff),
    folded: folds(game),
    logos: (
      <>
        <TeamLogo id={game.away} size={24} />
        <TeamLogo id={game.home} size={24} />
      </>
    ),
    card: (
      <GameCard
        game={game}
        week={SLATE.week}
        timeLabel={kickoffLabel(game)}
        yours={isYours(game)}
        explain={explain}
      />
    ),
    live: <StartedGameCard game={game} phase="live" yours={isYours(game)} />,
    played: <PlayedGameRow game={game} yours={isYours(game)} />,
  }));

  return (
    <PageShell>
      <PageTitle
        title="What to watch"
        subtitle={`Week ${SLATE.week} · ${SLATE.games.length} games · Bills always first`}
        action={<FlagCountButton className="lg:hidden" />}
      />

      <StaleBanner fetchedAt={SLATE.fetchedAt} />

      <div className="mt-4">
        <TimedSlate
          items={items}
          playedHeader={<SectionHeader title="Already played" />}
          weekDone={
            <Card tone="quiet">
              <p className="text-[15px] leading-[1.45] text-chalk">
                {`Week ${SLATE.week} is done. `}Next week&rsquo;s games, ranked,
                land here after the daily refresh.
              </p>
            </Card>
          }
        />
      </div>

      {/* §13: a team not playing is not a bug, and the UI must say so. */}
      <div className="mt-2.5">
        <ByeCard byes={SLATE.byes} week={SLATE.week} explain={explain} />
      </div>
    </PageShell>
  );
}

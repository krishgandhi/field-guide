import type { Metadata } from "next";
import { FlagCountButton } from "@/components/flag/flag-count-button";
import { ByeCard } from "@/components/games/bye-card";
import { kickoffLabel } from "@/components/games/format";
import { GameCard } from "@/components/games/game-card";
import { MoreGames } from "@/components/games/more-games";
import { StaleBanner } from "@/components/stale-banner";
import { PageShell } from "@/components/ui/page-header";
import { PageTitle } from "@/components/ui/page-title";
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
 * Deliberately NOT live scores; §2 rules those out. This is read before kickoff.
 */
export default function GamesPage() {
  const explain = createExplainer();
  const slate = sortForViewing(SLATE.games, SLATE.week);
  const isYours = (g: (typeof slate)[number]) => g.home === YOURS || g.away === YOURS;
  const shown = slate.filter((g) => isYours(g) || watchability(g, SLATE.week).score > 1);
  const folded = slate.filter((g) => !shown.includes(g));

  const card = (game: (typeof slate)[number]) => (
    <GameCard
      key={game.id}
      game={game}
      week={SLATE.week}
      timeLabel={kickoffLabel(game)}
      yours={isYours(game)}
      explain={explain}
    />
  );

  return (
    <PageShell>
      <PageTitle
        title="What to watch"
        subtitle={`Week ${SLATE.week} · ${SLATE.games.length} games · Bills always first`}
        action={<FlagCountButton className="lg:hidden" />}
      />

      <StaleBanner fetchedAt={SLATE.fetchedAt} />

      <div className="mt-4 space-y-2.5">{shown.map(card)}</div>

      <MoreGames games={folded}>{folded.map(card)}</MoreGames>

      {/* §13: a team not playing is not a bug, and the UI must say so. */}
      <div className="mt-2.5">
        <ByeCard byes={SLATE.byes} week={SLATE.week} explain={explain} />
      </div>
    </PageShell>
  );
}

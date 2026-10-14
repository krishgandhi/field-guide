import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FlagCountButton } from "@/components/flag/flag-count-button";
import { ByeCard } from "@/components/games/bye-card";
import { FieldCard } from "@/components/games/field-card";
import { GameCard } from "@/components/games/game-card";
import { StartedGameCard } from "@/components/games/started-game-card";
import { PhaseSwitch, UpcomingOnly } from "@/components/games/timed";
import {
  kickoffLabel,
  relativeKickoffLabel,
  teamWeekLine,
  todayLabel,
} from "@/components/games/format";
import { MoveFeed } from "@/components/moves/move-feed";
import { StaleBanner } from "@/components/stale-banner";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/ui/page-header";
import { PageTitle } from "@/components/ui/page-title";
import { SectionHeader } from "@/components/ui/section-header";
import { comingUp } from "@/lib/calendar";
import { gamePhase } from "@/lib/game-phase";
import { createExplainer } from "@/lib/glossary/explain";
import { getMovesByDate, headlineMove } from "@/lib/moves";
import { SLATE } from "@/lib/slate";
import { sortForViewing, watchability } from "@/lib/watchability";

/**
 * "Tonight", "Bills played Monday" and "coming up" depend on today's date, so
 * the page is re-rendered hourly from the committed files rather than frozen
 * at build time. It still reads only repo data (§4) — nothing is fetched.
 */
export const revalidate = 3600;

const YOURS = "BUF";

/** How many moves the home feed shows before "See all". */
const FEED_LENGTH = 3;

/**
 * "This week" — the home screen.
 *
 * Answers "what do I need to know right now", so it's a digest of the other
 * tabs rather than a menu: the Bills game drawn as a field, who isn't playing,
 * the latest moves, anything else worth turning on, and the next date.
 */
export default function ThisWeekPage() {
  // No `now` here: each helper reads the clock itself (default arguments),
  // which keeps render pure; the page re-renders hourly anyway.
  const explain = createExplainer();
  const slate = sortForViewing(SLATE.games, SLATE.week);
  // The slate holds one week, so this is the Bills game of that week —
  // which may already be over. PhaseSwitch decides at view time.
  const yourGame = slate.find((g) => g.home === YOURS || g.away === YOURS);
  // Candidates, best first; UpcomingOnly drops any that have kicked off by
  // the time the page is viewed, then takes two.
  const alsoWatch = slate.filter(
    (g) => g !== yourGame && watchability(g, SLATE.week).score >= 3,
  );

  // The biggest move of the last month leads (headlineMove's rule), then the
  // newest others, so the feed is both "what mattered" and "what's new".
  const headline = headlineMove();
  const feed = [
    ...(headline ? [headline.move] : []),
    ...getMovesByDate().filter((m) => m.slug !== headline?.move.slug),
  ].slice(0, FEED_LENGTH);

  const nextDate = comingUp({ byes: SLATE.byes, week: SLATE.week });
  const weekLine = teamWeekLine(YOURS, yourGame, SLATE.byes);

  return (
    <PageShell>
      <PageTitle
        title={`Week ${SLATE.week}`}
        subtitle={[todayLabel(), weekLine].filter(Boolean).join(" · ")}
        action={<FlagCountButton className="lg:hidden" />}
      />

      <StaleBanner fetchedAt={SLATE.fetchedAt} />

      <div className="mt-[18px] space-y-3">
        {yourGame ? (
          <PhaseSwitch
            kickoff={yourGame.kickoff}
            serverPhase={gamePhase(yourGame.kickoff)}
            upcoming={
              <FieldCard
                game={yourGame}
                week={SLATE.week}
                timeLabel={relativeKickoffLabel(yourGame)}
                explain={explain}
              />
            }
            live={<StartedGameCard game={yourGame} phase="live" yours />}
            played={
              <StartedGameCard
                game={yourGame}
                phase="played"
                yours
                note="That's this week done for Buffalo. Next week's games land here after the daily refresh."
              />
            }
          />
        ) : null}

        {/* §13: a team not playing is not a bug, and the UI must say so. */}
        {SLATE.byes.length > 0 ? (
          <ByeCard byes={SLATE.byes} week={SLATE.week} explain={explain} />
        ) : null}
      </div>

      {feed.length > 0 ? (
        <section aria-labelledby="moves-heading">
          <SectionHeader id="moves-heading" title="Latest moves" aside="See all" href="/moves" />
          <MoveFeed moves={feed} />
        </section>
      ) : null}

      <UpcomingOnly
        limit={2}
        className="space-y-2.5"
        header={<SectionHeader id="watch-heading" title="Also worth a look" />}
        items={alsoWatch.map((game) => ({
          id: game.id,
          kickoff: game.kickoff,
          serverPhase: gamePhase(game.kickoff),
          card: (
            <GameCard
              game={game}
              week={SLATE.week}
              timeLabel={kickoffLabel(game)}
              explain={explain}
            />
          ),
        }))}
        footer={
          <Link
            href="/games"
            className="mt-2.5 flex min-h-12 items-center justify-between rounded-[var(--radius-card)] px-4 text-[14.5px] font-semibold text-chalk-dim ring-1 ring-inset ring-line transition-colors duration-[120ms] hover:text-chalk"
          >
            All {slate.length} games, ranked
            <ChevronRight size={18} aria-hidden />
          </Link>
        }
      />

      {nextDate ? (
        <section aria-labelledby="next-heading">
          <SectionHeader id="next-heading" title="Coming up" />
          <Card className="flex items-start gap-4">
            <span className="label w-14 shrink-0 pt-1 text-chalk">{nextDate.dateLabel}</span>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold text-chalk">{nextDate.label}</h3>
              <p className="mt-1 text-[14.5px] leading-[1.45] text-chalk-dim">
                {explain(nextDate.why)}
              </p>
            </div>
          </Card>
        </section>
      ) : null}
    </PageShell>
  );
}

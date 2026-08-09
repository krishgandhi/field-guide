import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { QueueLink } from "@/components/flag/queue-link";
import { BignessPill } from "@/components/ui/score-meter";
import { Card, PageShell, SectionHeader } from "@/components/ui/page-header";
import { getAllEntries } from "@/lib/content";
import { CALENDAR } from "@/lib/mock/games";
import { SLATE } from "@/lib/slate";
import { sortForViewing } from "@/lib/watchability";
import { MOVES_BY_BIGNESS } from "@/lib/mock/moves";

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

/**
 * "This week" — the companion home screen.
 *
 * Answers "what do I need to know right now", so it's a digest of the other
 * tabs rather than a menu: the Bills game, the two other games worth turning
 * on, the biggest recent move, one date coming up.
 */
export default function ThisWeekPage() {
  const slate = sortForViewing(SLATE.games, SLATE.week);
  const billsGame = slate.find((g) => g.home === "BUF" || g.away === "BUF");
  const alsoWatch = slate.filter((g) => g !== billsGame).slice(0, 2);
  const topMove = MOVES_BY_BIGNESS[0];
  const nextDate = CALENDAR[0];
  const glossaryCount = getAllEntries("glossary").length;

  return (
    <PageShell>
      <header>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
          Week {SLATE.week}
        </p>
        <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-fg">
          This week
        </h1>
      </header>

      {/* Renders only when there's something waiting (§6b). */}
      <QueueLink />

      {billsGame ? (
        <>
          <SectionHeader title="Your game" aside="Bills" />
          <GameCard
            game={billsGame}
            week={SLATE.week}
            timeLabel={fmt.format(new Date(billsGame.kickoff))}
            highlight
          />
        </>
      ) : null}

      <SectionHeader title="Also worth watching" />
      <div className="space-y-3">
        {alsoWatch.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            week={SLATE.week}
            timeLabel={fmt.format(new Date(game.kickoff))}
          />
        ))}
      </div>
      <Link
        href="/games"
        className="mt-3 flex min-h-11 items-center justify-between rounded-xl border border-line px-4 py-3 text-sm font-medium text-fg-dim hover:text-fg"
      >
        All {slate.length} games this week
        <ChevronRight size={16} aria-hidden />
      </Link>

      <SectionHeader title="Biggest recent move" />
      <Link href={`/moves/${topMove.slug}`} className="block">
        <Card className="transition-colors hover:border-fg/20">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-snug text-fg">
              {topMove.headline}
            </h3>
            <BignessPill value={topMove.bigness} />
          </div>
          <p className="mt-2 text-sm leading-snug text-fg-dim">
            {topMove.soWhat}
          </p>
        </Card>
      </Link>

      <SectionHeader title="Coming up" />
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-fg">{nextDate.label}</h3>
          <span className="tnum shrink-0 text-sm font-medium text-amber">
            {nextDate.date}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-snug text-fg-dim">{nextDate.why}</p>
      </Card>

      <SectionHeader title="Look something up" />
      <Link
        href="/glossary"
        className="flex min-h-14 items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 hover:border-fg/20"
      >
        <span>
          <span className="block text-base font-semibold text-fg">Glossary</span>
          <span className="block text-sm text-fg-dim">
            {glossaryCount} terms, explained plainly
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-fg-dim" aria-hidden />
      </Link>
    </PageShell>
  );
}

import Link from "next/link";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageShell, SectionHeader } from "@/components/ui/page-header";
import { getAllEntries } from "@/lib/content";
import { CALENDAR, CURRENT_WEEK, slateInViewingOrder } from "@/lib/mock/games";
import { MOVES_BY_BIGNESS } from "@/lib/mock/moves";
import { shortName } from "@/lib/mock/teams";

/**
 * "This week" — the companion home screen.
 *
 * The question it answers is "what do I need to know right now", so it's a
 * digest of the other tabs rather than a menu: the Bills game, the two other
 * games worth turning on, the biggest recent move, and one date coming up.
 */
export default function ThisWeekPage() {
  const slate = slateInViewingOrder();
  const billsGame = slate.find((g) => g.home === "BUF" || g.away === "BUF");
  const alsoWatch = slate.filter((g) => g !== billsGame).slice(0, 2);
  const topMove = MOVES_BY_BIGNESS[0];
  const nextDate = CALENDAR[0];
  const glossaryCount = getAllEntries("glossary").length;

  return (
    <>
      <header className="bg-turf px-5 py-5 text-chalk sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <p className="font-data text-xs uppercase tracking-[0.2em] text-chalk/70">
            Field guide · Week {CURRENT_WEEK}
          </p>
          <h1 className="font-display condensed mt-1 text-3xl font-semibold sm:text-4xl">
            This week
          </h1>
        </div>
      </header>

      <PageShell>
        {billsGame ? (
          <>
            <SectionHeader title="Your game" aside="Bills" />
            <Link
              href="/games"
              className="mt-2 block min-h-14 border-l-4 border-royal py-3 pl-3 hover:bg-graphite/5"
            >
              <p className="font-display condensed text-2xl font-semibold">
                {shortName(billsGame.away)} at {shortName(billsGame.home)}
              </p>
              <p className="font-data mt-1 text-xs uppercase tracking-wide text-graphite/60">
                Sun 13 Sep · 1:00 PM ET
              </p>
              <p className="mt-2 leading-snug">{billsGame.reason}</p>
            </Link>
          </>
        ) : null}

        <SectionHeader title="Also worth watching" aside="Sample scores" />
        <ul className="mt-1">
          {alsoWatch.map((game) => (
            <li key={game.id} className="border-b border-graphite/15">
              <Link
                href="/games"
                className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-pencil"
              >
                <span className="min-w-0">
                  <span className="font-display condensed block text-lg font-semibold">
                    {shortName(game.away)} at {shortName(game.home)}
                  </span>
                  <span className="block text-sm leading-snug text-graphite/75">
                    {game.reason}
                  </span>
                </span>
                <ScoreMeter value={game.watchability} label="Worth watching" />
              </Link>
            </li>
          ))}
        </ul>
        <SampleDataBadge note="Scores placed by hand — §8 scoring isn't built yet" />

        <SectionHeader title="Biggest recent move" />
        <Link
          href={`/moves/${topMove.slug}`}
          className="mt-2 block min-h-14 py-2 hover:text-pencil"
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-display condensed text-xl font-semibold">
              {topMove.headline}
            </span>
            <ScoreMeter value={topMove.bigness} label="How big" />
          </span>
          <span className="mt-1 block leading-snug text-graphite/80">
            {topMove.soWhat}
          </span>
        </Link>

        <SectionHeader title="Coming up" />
        <div className="mt-2 py-2">
          <p className="font-display condensed text-xl font-semibold">
            {nextDate.label}
          </p>
          <p className="font-data text-xs uppercase tracking-wide text-graphite/60">
            {nextDate.date}
          </p>
          <p className="mt-1 leading-snug text-graphite/80">{nextDate.why}</p>
        </div>

        <SectionHeader title="Look something up" aside={`${glossaryCount} entries`} />
        <Link
          href="/glossary"
          className="mt-1 flex min-h-14 items-center justify-between gap-4 border-b border-graphite/15 py-3 hover:text-pencil"
        >
          <span className="font-display condensed text-lg font-semibold">
            Glossary
          </span>
          <span className="font-data text-xs uppercase tracking-wide text-graphite/60">
            real content
          </span>
        </Link>
      </PageShell>
    </>
  );
}

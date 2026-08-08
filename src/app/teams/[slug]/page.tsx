import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageHeader, PageShell, SectionHeader } from "@/components/ui/page-header";
import { GAMES } from "@/lib/mock/games";
import { MOVES } from "@/lib/mock/moves";
import { TEAMS, getTeam, shortName } from "@/lib/mock/teams";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEAMS.map((t) => ({ slug: t.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeam(slug);
  if (!team) return {};
  return {
    title: `${team.city} ${team.name} — Field guide`,
    description: team.blurb || `${team.city} ${team.name}.`,
  };
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const team = getTeam(slug);
  if (!team) notFound();

  const nextGame = GAMES.find((g) => g.home === team.id || g.away === team.id);
  const teamMoves = MOVES.filter((m) => m.teams.includes(team.id));

  return (
    <PageShell>
      <PageHeader
        backHref="/teams"
        backLabel="Teams"
        kicker={`${team.conference} ${team.division}`}
        title={`${team.city} ${team.name}`}
      />

      {team.blurb ? (
        <>
          <p className="mt-4 text-lg leading-relaxed">{team.blurb}</p>

          <SectionHeader title="One thing to know" />
          <p className="mt-2 border-l-2 border-amber py-1 pl-3 leading-relaxed">
            {team.oneThingToKnow}
          </p>
        </>
      ) : (
        /* §10: empty states are invitations, not apologies. */
        <div className="mt-6 border-l-2 border-fg/30 py-2 pl-3">
          <p className="leading-relaxed text-fg/80">
            Not written up yet. Buffalo is the only team with a real write-up so
            far — the rest are deliberately blank rather than filled with guesses.
          </p>
          <Link
            href="/teams/buffalo-bills"
            className="font-data mt-2 inline-flex min-h-11 items-center text-xs uppercase tracking-[0.15em] text-pencil hover:underline"
          >
            See a finished one →
          </Link>
        </div>
      )}

      {nextGame ? (
        <>
          <SectionHeader title="Next game" aside="Week 1" />
          <div className="mt-2 flex items-baseline justify-between gap-3 py-2">
            <p className="font-display condensed text-xl font-semibold">
              {shortName(nextGame.away)} at {shortName(nextGame.home)}
            </p>
            <ScoreMeter value={nextGame.watchability} label="Worth watching" />
          </div>
          <p className="leading-snug text-fg/80">{nextGame.reason}</p>
        </>
      ) : null}

      {teamMoves.length > 0 ? (
        <>
          <SectionHeader title="Recent moves" />
          <ul className="mt-1">
            {teamMoves.map((move) => (
              <li key={move.slug} className="border-b border-fg/15">
                <Link
                  href={`/moves/${move.slug}`}
                  className="flex min-h-14 items-center justify-between gap-3 py-3 hover:text-pencil"
                >
                  <span className="font-display condensed text-base font-semibold leading-tight">
                    {move.headline}
                  </span>
                  <ScoreMeter value={move.bigness} label="How big" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageShell>
  );
}

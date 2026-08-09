import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { BignessPill } from "@/components/ui/score-meter";
import {
  BackLink,
  Card,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import { SLATE } from "@/lib/slate";
import { MOVES } from "@/lib/mock/moves";
import { TEAMS, getTeam } from "@/lib/mock/teams";
import { teamColor, teamLogo } from "@/lib/teams";
import { createExplainer } from "@/lib/glossary/explain";

export const dynamicParams = false;

export function generateStaticParams() {
  return TEAMS.map((t) => ({ slug: t.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

const fmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

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

  const logo = teamLogo(team.id);
  const color = teamColor(team.id);
  const nextGame = SLATE.games.find((g) => g.home === team.id || g.away === team.id);
  const teamMoves = MOVES.filter((m) => m.teams.includes(team.id));
  const explain = createExplainer();

  return (
    <PageShell flaggable>
      <BackLink href="/teams" label="Teams" />

      {/* The crest does the identifying; the colour is a wash behind it,
          because lifted brand colours can't tell four navy teams apart. */}
      <header className="relative overflow-hidden rounded-2xl border border-line p-5">
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{
            background: `radial-gradient(120% 100% at 0% 0%, ${color}, transparent 70%)`,
          }}
        />
        <div className="relative flex items-center gap-4">
          {logo ? (
            <Image
              src={logo}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
              {team.conference} {team.division}
            </p>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-fg">
              {team.city} {team.name}
            </h1>
            {team.quarterback ? (
              <p className="mt-0.5 text-sm text-fg-dim">{team.quarterback}</p>
            ) : null}
          </div>
        </div>
      </header>

      {team.blurb ? (
        <>
          <p className="mt-5 text-[1.05rem] leading-relaxed text-fg">
            {explain(team.blurb)}
          </p>

          <SectionHeader title="One thing to know" />
          <Card tone="amber">
            <p className="text-sm leading-relaxed text-fg">
              {explain(team.oneThingToKnow)}
            </p>
          </Card>
        </>
      ) : (
        /* §10: empty states are invitations, not apologies. */
        <Card className="mt-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            Not written up yet. Buffalo is the only team with a real write-up so
            far — the rest are deliberately blank rather than filled with guesses.
          </p>
          <Link
            href="/teams/buffalo-bills"
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-amber hover:underline"
          >
            See a finished one
            <ChevronRight size={15} aria-hidden />
          </Link>
        </Card>
      )}

      {nextGame ? (
        <>
          <SectionHeader title="Next game" aside={`Week ${SLATE.week}`} />
          <GameCard
            game={nextGame}
            week={SLATE.week}
            timeLabel={fmt.format(new Date(nextGame.kickoff))}
          />
        </>
      ) : null}

      {teamMoves.length > 0 ? (
        <>
          <SectionHeader title="Recent moves" />
          <div className="space-y-2.5">
            {teamMoves.map((move) => (
              <Link key={move.slug} href={`/moves/${move.slug}`} className="block">
                <Card className="transition-colors hover:border-fg/20">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold leading-snug text-fg">
                      {move.headline}
                    </h3>
                    <BignessPill value={move.bigness} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { GameCard } from "@/components/game-card";
import { MdxContent } from "@/components/mdx-content";
import { RecordStrip } from "@/components/record-strip";
import { BignessPill } from "@/components/ui/score-meter";
import {
  BackLink,
  Card,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import { getEntry } from "@/lib/content";
import { SLATE, injuriesFor } from "@/lib/slate";
import { MOVES } from "@/lib/mock/moves";
import { TEAMS, getTeam } from "@/lib/mock/teams";
import { teamColor, teamLogo } from "@/lib/teams";

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
  const entry = getEntry("teams", slug);
  return {
    title: `${team.city} ${team.name} — Field guide`,
    description: entry?.frontmatter.summary ?? `${team.city} ${team.name}.`,
  };
}

export default async function TeamDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const team = getTeam(slug);
  if (!team) notFound();

  const logo = teamLogo(team.id);
  const color = teamColor(team.id);
  // Write-ups live in content/teams/*.mdx (§5). Absent for most teams so far —
  // the live record still makes the page worth opening.
  const entry = getEntry("teams", slug);
  const nextGame = SLATE.games.find(
    (g) => g.home === team.id || g.away === team.id,
  );
  const knocks = injuriesFor(team.id);
  const teamMoves = MOVES.filter((m) => m.teams.includes(team.id));

  return (
    <PageShell flaggable>
      <BackLink href="/teams" label="Teams" />

      {/* The crest identifies; the colour is a wash behind it, because lifted
          brand colours can't tell four navy teams apart. */}
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
          </div>
        </div>
      </header>

      <RecordStrip teamId={team.id} />

      {entry ? (
        <>
          <p className="mt-5 text-[1.05rem] leading-snug text-amber">
            {entry.frontmatter.summary}
          </p>
          {/* Jargon inside the write-up gets auto-linked (§6a) — the whole
              reason these moved out of TypeScript and into content. */}
          <div className="mt-1">
            <MdxContent source={entry.body} />
          </div>
        </>
      ) : (
        /* §10: empty states are invitations, not apologies. */
        <Card className="mt-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            No write-up yet. The record above is real — what&rsquo;s missing is
            who these are and why they matter.
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

      {knocks.length > 0 ? (
        <>
          <SectionHeader title="Out injured" aside={String(knocks.length)} />
          <Card>
            <ul className="space-y-1.5">
              {knocks.map((k) => (
                <li
                  key={`${k.player}-${k.position}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-fg">{k.player}</span>
                  <span className="shrink-0 text-[0.7rem] uppercase tracking-wider text-fg-dim">
                    {k.position} · {k.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

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

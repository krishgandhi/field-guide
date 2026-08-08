import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageHeader, PageShell, SectionHeader } from "@/components/ui/page-header";
import { MOVES, getMove } from "@/lib/mock/moves";
import { shortName } from "@/lib/mock/teams";

export const dynamicParams = false;

export function generateStaticParams() {
  return MOVES.map((m) => ({ slug: m.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const move = getMove(slug);
  if (!move) return {};
  return { title: `${move.headline} — Field guide`, description: move.soWhat };
}

/**
 * The §7 rubric in full — the reasoning framework a newcomer is missing.
 *
 * Six axes, each scored 1–5 with two sentences. The score never appears without
 * its sentence: the whole point is the explanation, not the number.
 */
export default async function MoveDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const move = getMove(slug);
  if (!move) notFound();

  return (
    <PageShell>
      <PageHeader
        backHref="/moves"
        backLabel="Moves"
        kicker={`${move.date} · ${move.teams.map(shortName).join(" / ")}`}
        title={move.headline}
      />

      <div className="mt-4 flex items-center gap-3">
        <span className="font-data text-xs uppercase tracking-[0.15em] text-fg/60">
          How big
        </span>
        <ScoreMeter value={move.bigness} label="How big" />
      </div>

      <p className="mt-3 text-lg leading-relaxed">{move.soWhat}</p>

      <SampleDataBadge note="Real event. The scores below are judgement calls." />

      {move.rubric.length > 0 ? (
        <>
          <SectionHeader title="Why it's big" aside="Six axes" />
          <ul className="mt-1">
            {move.rubric.map((axis) => (
              <li key={axis.axis} className="border-b border-fg/15 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display condensed text-base font-semibold uppercase tracking-wide">
                    {axis.axis}
                  </h3>
                  <ScoreMeter value={axis.score} label={axis.axis} />
                </div>
                <p className="mt-1 leading-snug text-fg/80">{axis.note}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        /* Honest gap rather than six meaningless scores — see moves.ts. */
        <>
          <SectionHeader title="Why it's big" />
          <p className="mt-2 leading-relaxed text-fg/80">
            The six-axis rubric is built for player trades and signings — it opens
            with &ldquo;player quality&rdquo; and &ldquo;positional value&rdquo;, which have
            nothing useful to say about a coaching change. Scoring this one anyway
            would produce numbers that look meaningful and aren&rsquo;t.
          </p>
        </>
      )}
    </PageShell>
  );
}

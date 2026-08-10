import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MdxContent } from "@/components/mdx-content";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { BignessPill, ScoreMeter } from "@/components/ui/score-meter";
import {
  Card,
  PageHeader,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import { getMove, getMoveSlugs } from "@/lib/moves";
import { createExplainer } from "@/lib/glossary/explain";
import { teamLogo, teamName } from "@/lib/teams";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMoveSlugs().map((slug) => ({ slug }));
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
 * its sentence: the explanation is the point, not the number.
 */
export default async function MoveDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const move = getMove(slug);
  if (!move) notFound();

  // One set for the whole page so a term links on first appearance only (§6a),
  // shared with the MDX body below. It's mutated as the JSX is built, which is
  // why the body renders last — see rehypeGlossaryLinks's `linked` option.
  const linked = new Set<string>();
  const explain = createExplainer(undefined, linked);

  return (
    <PageShell flaggable>
      <PageHeader backHref="/moves" backLabel="Moves" title={move.headline} />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex items-center gap-1.5">
          {move.teams.map((id) => {
            const logo = teamLogo(id);
            return logo ? (
              <Image
                key={id}
                src={logo}
                alt={teamName(id)}
                width={22}
                height={22}
                className="h-[22px] w-[22px] object-contain"
              />
            ) : null;
          })}
        </span>
        <span className="text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
          {move.dateLabel}
        </span>
        <BignessPill value={move.bigness} />
      </div>

      <p className="mt-4 text-[1.05rem] leading-relaxed text-fg">
        {explain(move.soWhat)}
      </p>

      <SampleDataBadge note="Real event. The scores below are judgement calls." />

      {move.rubric.length > 0 ? (
        <>
          <SectionHeader title="Why it's big" aside="Six things that matter" />
          <div className="space-y-2.5">
            {move.rubric.map((axis) => (
              <Card key={axis.axis}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-fg">{axis.axis}</h3>
                  <ScoreMeter value={axis.score} label={axis.axis} />
                </div>
                <p className="mt-1.5 text-sm leading-snug text-fg-dim">
                  {explain(axis.note)}
                </p>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* Honest gap rather than six meaningless scores — see moves.ts. */
        <>
          <SectionHeader title="Why it's big" />
          <Card>
            <p className="text-sm leading-relaxed text-fg-dim">
              The six-point checklist is built for player trades and signings —
              it opens with &ldquo;player quality&rdquo; and &ldquo;positional
              value&rdquo;, which have nothing useful to say about a coaching
              change. Scoring this one anyway would produce numbers that look
              meaningful and aren&rsquo;t.
            </p>
          </Card>
        </>
      )}

      {/* Last on the page on purpose: the closing "what to take from it" reads
          better after the scores, and it keeps §6a's link order matching the
          reading order. */}
      {move.body.trim() ? (
        <>
          <SectionHeader title="What to take from it" />
          <MdxContent source={move.body} linked={linked} />
        </>
      ) : null}
    </PageShell>
  );
}

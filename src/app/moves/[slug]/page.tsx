import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { MdxContent } from "@/components/mdx-content";
import { PersonCard } from "@/components/moves/person-card";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { UncheckedBadge } from "@/components/ui/unchecked-badge";
import { BignessPill, ScoreMeter } from "@/components/ui/score-meter";
import {
  Card,
  PageHeader,
  PageShell,
  SectionHeader,
} from "@/components/ui/page-header";
import { getMove, getMoveSlugs } from "@/lib/moves";
import { createExplainer } from "@/lib/glossary/explain";
import { peopleByIds } from "@/lib/people";
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

  // Absent for a coaching change: ESPN publishes no coach data, so those
  // entries carry no ids and simply render no card.
  const people = peopleByIds(move.people);

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

      {move.verified ? (
        <SampleDataBadge note="Real event. The scores below are judgement calls." />
      ) : (
        <UncheckedBadge sensitive={move.sensitive} full />
      )}

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

      {/* Who these people are, before the closing thought that assumes you
          know. Above MdxContent, so the shared glossary set is claimed in
          reading order (§6a) — see the note on rehypeGlossaryLinks. */}
      {people.length > 0 ? (
        <>
          <SectionHeader
            title={people.length > 1 ? "Who they are" : "Who he is"}
          />
          <div className="space-y-2.5">
            {people.map((person) => (
              <PersonCard key={person.id} person={person} explain={explain} />
            ))}
          </div>
        </>
      ) : null}

      {/* Last on the page on purpose: the closing "what to take from it" reads
          better after the scores, and it keeps §6a's link order matching the
          reading order. */}
      {move.body.trim() ? (
        <>
          <SectionHeader title="What to take from it" />
          <MdxContent source={move.body} linked={linked} />
        </>
      ) : null}

      {/* §9: summarise in original words, never reproduce article text, always
          link to the source. Everything above is my summary; this is where the
          actual reporting lives. */}
      {move.sources.length > 0 ? (
        <>
          <SectionHeader title="Read the reporting" />
          <ul className="space-y-2">
            {move.sources.map((src) => (
              <li key={src.url}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 transition-colors hover:border-fg/20"
                >
                  <span className="text-sm font-medium text-fg">{src.label}</span>
                  <ExternalLink
                    className="h-4 w-4 shrink-0 text-fg-dim"
                    aria-hidden
                  />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageShell>
  );
}

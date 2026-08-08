import type { Metadata } from "next";
import Link from "next/link";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { ScoreMeter } from "@/components/ui/score-meter";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { MOVES_BY_BIGNESS } from "@/lib/mock/moves";
import { shortName } from "@/lib/mock/teams";

export const metadata: Metadata = {
  title: "Moves — Field guide",
  description: "What just happened around the league, and why it mattered.",
};

export default function MovesPage() {
  return (
    <PageShell>
      <PageHeader kicker="2026 offseason" title="Moves" />

      <SampleDataBadge note="Real events. The 1–5 scores are judgement calls, not sourced facts." />

      <ul className="mt-4">
        {MOVES_BY_BIGNESS.map((move) => (
          <li key={move.slug} className="border-b border-fg/15">
            <Link
              href={`/moves/${move.slug}`}
              className="block min-h-14 py-4 hover:text-pencil"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display condensed text-xl font-semibold leading-tight">
                  {move.headline}
                </span>
                <ScoreMeter value={move.bigness} label="How big" />
              </span>
              <span className="font-data mt-1 block text-[0.65rem] uppercase tracking-[0.15em] text-fg/55">
                {move.date} · {move.teams.map(shortName).join(" / ")}
              </span>
              <span className="mt-1.5 block leading-snug text-fg/80">
                {move.soWhat}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

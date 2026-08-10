import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { BignessPill } from "@/components/ui/score-meter";
import { Card, PageHeader, PageShell } from "@/components/ui/page-header";
import { getMoves } from "@/lib/moves";
import { teamLogo, teamName } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Moves — Field guide",
  description: "What just happened around the league, and why it mattered.",
};

/** Small stack of the logos involved — reads faster than the team names. */
function TeamCrests({ ids }: { ids: string[] }) {
  return (
    <span className="flex items-center gap-1.5">
      {ids.map((id) => {
        const logo = teamLogo(id);
        return logo ? (
          <Image
            key={id}
            src={logo}
            alt={teamName(id)}
            width={18}
            height={18}
            className="h-[18px] w-[18px] object-contain"
          />
        ) : null;
      })}
    </span>
  );
}

export default function MovesPage() {
  return (
    <PageShell>
      <PageHeader kicker="2026 offseason" title="Moves" />

      <SampleDataBadge note="Real events. The 1–5 scores are judgement calls, not sourced facts." />

      <div className="mt-5 space-y-3">
        {getMoves().map((move) => (
          <Link key={move.slug} href={`/moves/${move.slug}`} className="block">
            <Card className="transition-colors hover:border-fg/20">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <TeamCrests ids={move.teams} />
                  <span className="text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
                    {move.dateLabel}
                  </span>
                </span>
                <BignessPill value={move.bigness} />
              </div>

              <h2 className="text-[1.05rem] font-semibold leading-snug text-fg">
                {move.headline}
              </h2>
              <p className="mt-1.5 text-sm leading-snug text-fg-dim">
                {move.soWhat}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

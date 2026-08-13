import type { Metadata } from "next";
import { SampleDataBadge } from "@/components/ui/sample-data-badge";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { MovesList, type MoveListItem } from "@/components/moves/moves-list";
import { getMoves } from "@/lib/moves";
import { teamLogo, teamName } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Moves — Field guide",
  description: "What just happened around the league, and why it mattered.",
};

/**
 * Still a server component: it reads the content files at build time and hands
 * the list to a client component that owns only the sort/filter state.
 *
 * Logos and team names are resolved here rather than in the browser, so the
 * client never has to ship src/lib/teams/nfl-teams.json just to render a crest.
 */
export default function MovesPage() {
  const moves: MoveListItem[] = getMoves().map((move) => ({
    slug: move.slug,
    headline: move.headline,
    date: move.date,
    dateLabel: move.dateLabel,
    teams: move.teams,
    bigness: move.bigness,
    kind: move.kind,
    soWhat: move.soWhat,
    crests: move.teams.map((id) => ({
      id,
      name: teamName(id),
      logo: teamLogo(id) ?? null,
    })),
  }));

  return (
    <PageShell>
      <PageHeader kicker="2026 offseason" title="Moves" />

      <SampleDataBadge note="Real events. The 1–5 scores are judgement calls, not sourced facts." />

      <MovesList moves={moves} />
    </PageShell>
  );
}

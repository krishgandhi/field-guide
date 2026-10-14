import type { Metadata } from "next";
import { FlagCountButton } from "@/components/flag/flag-count-button";
import { PageShell } from "@/components/ui/page-header";
import { PageTitle } from "@/components/ui/page-title";
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
    verified: move.verified,
    sensitive: move.sensitive,
    soWhat: move.soWhat,
    crests: move.teams.map((id) => ({
      id,
      name: teamName(id),
      logo: teamLogo(id) ?? null,
    })),
  }));

  return (
    <PageShell>
      {/* The old "Real events." badge said this in a yellow box; it's a fact
          about the whole list, so it's the subtitle now. */}
      <PageTitle
        title="Moves"
        subtitle="Every entry links its reporting. How big each one is, 1 to 5, is a judgement call."
        action={<FlagCountButton className="lg:hidden" />}
      />

      <MovesList moves={moves} />
    </PageShell>
  );
}

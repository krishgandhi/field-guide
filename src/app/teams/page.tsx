import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getSlugs } from "@/lib/content";
import {
  NFL_TEAMS,
  teamLogo,
  teamsInDivision,
  type Conference,
  type DivisionName,
} from "@/lib/teams";
import { recordFor, recordLabel } from "@/lib/standings";

export const metadata: Metadata = {
  title: "Teams — Field guide",
  description: "All 32 teams, by division.",
};

const ORDER: [Conference, DivisionName][] = [
  ["AFC", "East"], ["AFC", "North"], ["AFC", "South"], ["AFC", "West"],
  ["NFC", "East"], ["NFC", "North"], ["NFC", "South"], ["NFC", "West"],
];

/**
 * Grouped by division rather than alphabetically, because the division is the
 * unit that decides anything — these four play each other twice a year and the
 * standings that matter are divisional.
 *
 * Two columns of logo tiles: at 380px that's ~165px per tile, enough for a
 * 32px crest and the team name without truncating any of them.
 */
export default function TeamsPage() {
  const written = getSlugs("teams").length;

  return (
    <PageShell>
      <PageHeader kicker="All 32" title="Teams" />

      <p className="mt-2 text-sm text-fg-dim">
        {written} of {NFL_TEAMS.length} written up so far.
      </p>

      {ORDER.map(([conference, division]) => (
        <section key={`${conference}-${division}`} className="mt-6">
          <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
            {conference} {division}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {teamsInDivision(conference, division).map((team) => {
              const logo = teamLogo(team.id);
              const record = recordFor(team.id);
              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.slug}`}
                  className="flex min-h-14 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:border-fg/20"
                >
                  {logo ? (
                    <Image
                      src={logo}
                      alt=""
                      width={26}
                      height={26}
                      className="h-[26px] w-[26px] shrink-0 object-contain"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {team.name}
                    </span>
                    {/* Record rather than a "not written" label: it's real for
                        all 32, so the grid is useful before the write-ups exist. */}
                    {record ? (
                      <span className="tnum block text-[0.7rem] text-fg-dim">
                        {recordLabel(record)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </PageShell>
  );
}

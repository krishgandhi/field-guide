import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { TEAMS } from "@/lib/mock/teams";
import type { Team } from "@/lib/mock/types";

export const metadata: Metadata = {
  title: "Teams — Field guide",
  description: "All 32 teams, by division.",
};

const ORDER: [Team["conference"], Team["division"]][] = [
  ["AFC", "East"], ["AFC", "North"], ["AFC", "South"], ["AFC", "West"],
  ["NFC", "East"], ["NFC", "North"], ["NFC", "South"], ["NFC", "West"],
];

/**
 * Grouped by division rather than listed alphabetically, because divisions are
 * the unit that actually matters — teams play each other twice a year and the
 * standings that decide the playoffs are divisional.
 */
export default function TeamsPage() {
  const written = TEAMS.filter((t) => t.blurb).length;

  return (
    <PageShell>
      <PageHeader kicker="All 32" title="Teams" />

      <p className="font-data mt-3 text-[0.65rem] uppercase tracking-[0.15em] text-fg/55">
        {written} of {TEAMS.length} written up
      </p>

      {ORDER.map(([conference, division]) => (
        <section key={`${conference}-${division}`}>
          <h2 className="font-display condensed mt-7 border-b border-fg/25 pb-1 text-sm font-semibold uppercase tracking-[0.15em] text-fg/70">
            {conference} {division}
          </h2>
          <ul>
            {TEAMS.filter(
              (t) => t.conference === conference && t.division === division,
            ).map((team) => (
              <li key={team.id} className="border-b border-fg/15">
                <Link
                  href={`/teams/${team.slug}`}
                  className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:text-pencil"
                >
                  <span className="min-w-0">
                    <span className="font-display condensed text-lg font-semibold">
                      {team.city} {team.name}
                    </span>
                    {team.quarterback ? (
                      <span className="block text-sm leading-snug text-fg/70">
                        {team.quarterback}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-data shrink-0 text-[0.65rem] uppercase tracking-[0.15em] text-fg/45">
                    {team.blurb ? team.id : "unwritten"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}

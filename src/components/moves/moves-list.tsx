"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { BignessPill } from "@/components/ui/score-meter";
import { Card } from "@/components/ui/page-header";
import { UncheckedBadge } from "@/components/ui/unchecked-badge";

/**
 * The Moves list, with sorting and filtering.
 *
 * A client component only because the controls need state. The data still
 * comes from content files at build time — the server page reads them and
 * passes this trimmed, serializable shape down, so nothing here fetches and
 * the page stays fully static (§4).
 *
 * Native <select> rather than a custom dropdown: accessible for free, and on a
 * phone it opens the real system picker, which is a better control than
 * anything worth hand-building here.
 */

/** Just the fields the list renders — not the rubric, which would bloat the payload. */
export type MoveListItem = {
  slug: string;
  headline: string;
  date: string;
  dateLabel: string;
  teams: string[];
  bigness: number;
  kind: string;
  verified: boolean;
  sensitive: boolean;
  soWhat: string;
  /** Pre-resolved server-side: teamLogo/teamName read JSON the client shouldn't ship. */
  crests: { id: string; name: string; logo: string | null }[];
};

type Sort = "newest" | "biggest";

/**
 * The words the UI already uses for a bigness score, from BignessPill. Naming
 * the filter "severity" would introduce a second vocabulary for one idea —
 * §10 says name things by what he recognises.
 */
const SIZES = [
  { value: "5", label: "Huge" },
  { value: "4", label: "Big" },
  { value: "3", label: "Notable" },
  { value: "1-2", label: "Minor" },
];

/**
 * What each kind is called on screen. Moves covers more than transactions now
 * — a starting job changing hands matters as much as a trade — and the chip is
 * what tells you which you're looking at without opening it.
 */
const KIND_LABEL: Record<string, string> = {
  trade: "Trade",
  signing: "Signing",
  contract: "Contract",
  release: "Release",
  role: "Role change",
  injury: "Injury",
  coaching: "Coaching",
};

function matchesSize(bigness: number, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "1-2") return bigness <= 2;
  return bigness === Number(filter);
}

/**
 * A native select that looks like the rest of the UI.
 *
 * appearance-none strips the platform chrome including the arrow, so the arrow
 * has to come back explicitly — without it the control reads as a button and
 * nobody discovers it opens a list.
 */
function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full appearance-none rounded-xl border border-line bg-surface pl-3 pr-9 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-dim"
        aria-hidden
      />
    </label>
  );
}

export function MovesList({ moves }: { moves: MoveListItem[] }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [teamFilter, setTeamFilter] = useState("all");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  // Only teams that actually appear, so the picker never offers a dead end.
  const teams = useMemo(() => {
    const seen = new Map<string, string>();
    for (const move of moves) {
      for (const crest of move.crests) seen.set(crest.id, crest.name);
    }
    return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
  }, [moves]);

  // Only kinds present in the entries, in the order KIND_LABEL declares them,
  // so the picker never offers something that matches nothing.
  const kinds = useMemo(() => {
    const present = new Set(moves.map((m) => m.kind));
    return Object.keys(KIND_LABEL).filter((k) => present.has(k));
  }, [moves]);

  const shown = useMemo(() => {
    const filtered = moves.filter(
      (m) =>
        (teamFilter === "all" || m.teams.includes(teamFilter)) &&
        (kindFilter === "all" || m.kind === kindFilter) &&
        matchesSize(m.bigness, sizeFilter),
    );
    // Ties break on the other axis so the order is always fully determined —
    // otherwise two moves swap places between renders for no visible reason.
    return filtered.sort((a, b) =>
      sort === "newest"
        ? b.date.localeCompare(a.date) || b.bigness - a.bigness
        : b.bigness - a.bigness || b.date.localeCompare(a.date),
    );
  }, [moves, sort, teamFilter, sizeFilter, kindFilter]);

  return (
    <>
      <div className="mt-5 space-y-2">
        {/* Sort is a two-way choice, so a toggle beats a dropdown. */}
        <div
          role="group"
          aria-label="Sort moves"
          className="flex gap-1 rounded-xl border border-line bg-surface p-1"
        >
          {(
            [
              ["newest", "Newest"],
              ["biggest", "Biggest"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSort(value)}
              aria-pressed={sort === value}
              className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber ${
                sort === value
                  ? "bg-surface-2 text-fg"
                  : "text-fg-dim hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Picker
            label="Filter by type"
            value={kindFilter}
            onChange={setKindFilter}
          >
            <option value="all">All types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Picker>

          <Picker
            label="Filter by team"
            value={teamFilter}
            onChange={setTeamFilter}
          >
            <option value="all">All teams</option>
            {teams.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Picker>

          <Picker
            label="Filter by how big"
            value={sizeFilter}
            onChange={setSizeFilter}
          >
            <option value="all">Any size</option>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Picker>
        </div>
      </div>

      <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
        {shown.length} of {moves.length}
      </p>

      {shown.length === 0 ? (
        /* §10: empty states are invitations, not apologies. */
        <Card className="mt-3">
          <p className="text-sm leading-relaxed text-fg-dim">
            Nothing matches that combination yet. Widen the filters, or check
            back — the list grows through the season.
          </p>
        </Card>
      ) : (
        <div className="mt-3 space-y-3">
          {shown.map((move) => (
            <Link key={move.slug} href={`/moves/${move.slug}`} className="block">
              <Card className="transition-colors hover:border-fg/20">
                {/* Wraps rather than compresses: with an Unverified badge alongside the
                    type and size, a fixed row squeezed "14 August 2026" onto three
                    lines and ran it into the crests. */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      {move.crests.map((crest) =>
                        crest.logo ? (
                          <Image
                            key={crest.id}
                            src={crest.logo}
                            alt={crest.name}
                            width={18}
                            height={18}
                            className="h-[18px] w-[18px] object-contain"
                          />
                        ) : null,
                      )}
                    </span>
                    <span className="tnum whitespace-nowrap text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
                      {move.dateLabel}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {move.verified ? null : (
                      <UncheckedBadge sensitive={move.sensitive} />
                    )}
                    <span className="rounded-full border border-line px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-fg-dim">
                      {KIND_LABEL[move.kind] ?? move.kind}
                    </span>
                    <BignessPill value={move.bigness} />
                  </span>
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
      )}
    </>
  );
}

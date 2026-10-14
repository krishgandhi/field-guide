"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SIZE_FILTERS as SIZES, matchesSize } from "@/lib/moves/bigness";
import { Card } from "@/components/ui/card";
import { BignessChip, CheckedChip } from "@/components/moves/move-chips";
import { KIND_LABEL, kindLabel } from "@/lib/moves/kinds";

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
        className="min-h-11 w-full appearance-none truncate rounded-full bg-surface pl-3.5 pr-7 text-[14px] font-semibold text-chalk transition-colors duration-[120ms] hover:bg-surface-2"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-chalk-dim"
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
          className="flex gap-1 rounded-full bg-surface p-1"
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
              className={`min-h-11 flex-1 rounded-full text-[14.5px] font-bold transition-colors duration-[120ms] ${
                sort === value
                  ? "bg-surface-2 text-chalk"
                  : "text-chalk-dim hover:text-chalk"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Picker label="Filter by type" value={kindFilter} onChange={setKindFilter}>
            <option value="all">All types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Picker>

          <Picker label="Filter by team" value={teamFilter} onChange={setTeamFilter}>
            <option value="all">All teams</option>
            {teams.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Picker>

          <Picker label="Filter by how big" value={sizeFilter} onChange={setSizeFilter}>
            <option value="all">Any size</option>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Picker>
        </div>
      </div>

      <p className="label mb-3 mt-5 text-chalk-dim" aria-live="polite">
        {shown.length} of {moves.length}
      </p>

      {shown.length === 0 ? (
        /* §10: empty states are invitations, not apologies. */
        <Card>
          <p className="text-[15px] leading-[1.45] text-chalk-dim">
            Nothing matches that combination yet. Widen the filters, or check
            back — the list grows through the season.
          </p>
        </Card>
      ) : (
        <Card pad="none" className="px-4">
          <ul className="divide-y divide-line">
            {shown.map((move) => (
              <li key={move.slug}>
                <Link href={`/moves/${move.slug}`} className="group flex gap-3 py-4">
                  <Crests crests={move.crests} />
                  <div className="min-w-0 flex-1">
                    <p className="label flex flex-wrap gap-x-1.5 text-chalk-dim">
                      <span>{kindLabel(move.kind)}</span>
                      <span aria-hidden>·</span>
                      <span className="tnum" data-move-date>{move.dateLabel}</span>
                    </p>
                    <h2 className="mt-1 text-[16px] font-bold leading-[1.3] text-chalk underline-offset-[3px] text-pretty group-hover:underline group-hover:decoration-chalk-dim">
                      {move.headline}
                    </h2>
                    <p className="mt-1 text-[14.5px] leading-[1.45] text-chalk-dim">
                      {move.soWhat}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <BignessChip value={move.bigness} size="sm" />
                      <CheckedChip verified={move.verified} sensitive={move.sensitive} size="sm" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/**
 * The teams in a move as logo discs, from crests resolved on the server —
 * the client never ships the team registry. One disc for one team, two
 * overlapping for a pair, a row for three.
 */
function Crests({ crests }: { crests: MoveListItem["crests"] }) {
  const shown = crests.filter((c) => c.logo).slice(0, 3);
  const disc = (c: MoveListItem["crests"][number], px: number, box: number, extra = "") => (
    <span
      key={c.id}
      className={`grid place-items-center rounded-full bg-surface-2 ${extra}`}
      style={{ width: box, height: box }}
    >
      <Image src={c.logo!} alt="" width={px} height={px} className="object-contain" style={{ width: px, height: px }} />
    </span>
  );
  if (shown.length === 1) {
    return <span aria-hidden className="shrink-0">{disc(shown[0], 28, 44)}</span>;
  }
  return (
    <span aria-hidden className="relative block size-11 shrink-0">
      {shown.slice(0, 2).map((c, i) =>
        disc(c, 22, 30, i === 0 ? "absolute left-0 top-0" : "absolute bottom-0 right-0 ring-[3px] ring-surface"),
      )}
    </span>
  );
}

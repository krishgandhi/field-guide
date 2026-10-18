"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import type { InjuryReport } from "./format";

/**
 * The chip row under a game's reason: the line ("Rams by 3.5") and each
 * team's injury report ("Bills: 1 out").
 *
 * An injury chip opens the names underneath it. The old card hid them in a
 * `title` tooltip, which a phone can't show at all — and "1 out" with no way
 * to find out who is the kind of fact this site exists to replace.
 *
 * Only the injury chips are interactive; the chip itself stays 28px tall to
 * match the design, and the button around it extends the tap target to 44px.
 */
export function GameFacts({
  line,
  reports,
}: {
  line?: string | null;
  reports: InjuryReport[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();

  if (!line && reports.length === 0) return null;
  const shown = reports.find((r) => r.teamId === open);

  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {line ? <Chip>{line}</Chip> : null}
        {reports.map((r) => {
          const expanded = open === r.teamId;
          return (
            <button
              key={r.teamId}
              type="button"
              aria-expanded={expanded}
              aria-controls={expanded ? `${baseId}-${r.teamId}` : undefined}
              onClick={() => setOpen(expanded ? null : r.teamId)}
              className="group -my-2 rounded-full py-2 focus-visible:outline-offset-0"
            >
              <Chip
                variant={expanded ? "pressed" : "quiet"}
                className="transition-colors duration-[120ms] group-hover:text-chalk"
              >
                {r.summary}
                <ChevronDown
                  aria-hidden
                  className={`-mr-1 transition-transform duration-[120ms] ${expanded ? "rotate-180" : ""}`}
                />
              </Chip>
            </button>
          );
        })}
      </div>

      {shown ? (
        <ul
          id={`${baseId}-${shown.teamId}`}
          className="mt-2.5 divide-y divide-line rounded-[var(--radius-inner)] bg-surface-2 px-3.5"
        >
          {shown.players.map((p) => (
            <li
              key={`${p.player}-${p.position}`}
              className="flex items-baseline justify-between gap-3 py-2.5 text-[14px]"
            >
              <span className="min-w-0 text-chalk">
                {p.player}{" "}
                <span className="text-chalk-dim">{p.position}</span>
              </span>
              <span className="label shrink-0 text-chalk-dim">{p.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

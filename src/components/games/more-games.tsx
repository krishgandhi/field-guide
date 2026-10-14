import { ChevronDown } from "lucide-react";
import type { Game } from "@/lib/slate";
import { TeamLogo } from "./team-logo";

/**
 * The games scoring a 1 — "nothing much riding on this one" is literally
 * what the scoring says about them — folded behind one row, so the page
 * leads with what is worth his time without hiding anything.
 *
 * Native <details>: keyboard, screen reader and no-JavaScript behaviour come
 * free, and there is no state to keep.
 */
export function MoreGames({
  games,
  children,
}: {
  games: Game[];
  /** The folded game cards. */
  children: React.ReactNode;
}) {
  if (games.length === 0) return null;
  const logos = games.flatMap((g) => [g.away, g.home]).slice(0, 4);

  return (
    <details className="group mt-2.5">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3 transition-colors duration-[120ms] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="flex shrink-0">
          {logos.map((id, i) => (
            <TeamLogo key={`${id}-${i}`} id={id} size={24} className={i > 0 ? "-ml-1" : ""} />
          ))}
        </span>
        <span className="flex-1 text-[14.5px] leading-[1.35]">
          <b className="font-bold text-chalk">{games.length} more</b>{" "}
          <span className="text-chalk-dim">with nothing much riding on them</span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden
          className="shrink-0 text-chalk-dim transition-transform duration-[120ms] group-open:rotate-180"
        />
      </summary>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </details>
  );
}

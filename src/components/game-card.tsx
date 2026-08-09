import Image from "next/image";
import { teamColor, teamLogo, teamName } from "@/lib/teams";
import type { Game } from "@/lib/slate";
import { injuriesFor } from "@/lib/slate";
import { watchability } from "@/lib/watchability";

/**
 * One game, as a card.
 *
 * Identity is carried by the logo, not by colour — 22 of the 32 official brand
 * colours fail contrast on this background, and lifting the navies converges
 * Dallas, New England, Seattle and the Giants on the same blue.
 *
 * The plain-language reason stays prominent. It's the only thing here the NFL
 * app doesn't already do better, so visual polish never gets to crowd it out.
 */

function WatchPill({ score }: { score: number }) {
  if (score >= 5) {
    return (
      <span className="shrink-0 rounded-full bg-amber px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-ink">
        Must watch
      </span>
    );
  }
  if (score === 4) {
    return (
      <span className="shrink-0 rounded-full border border-amber/50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber">
        Worth it
      </span>
    );
  }
  if (score <= 1) {
    return (
      <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-wide text-fg-dim/60">
        Skippable
      </span>
    );
  }
  return null;
}

/** `prefix` carries the "at" on the home team's row — see the note below. */
function TeamRow({
  id,
  prefix,
  favourite,
}: {
  id: string;
  prefix?: string;
  favourite?: boolean;
}) {
  const logo = teamLogo(id);
  const knocks = injuriesFor(id);

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-4 shrink-0 text-[0.7rem] font-medium text-fg-dim">
        {prefix}
      </span>
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 shrink-0 object-contain"
        />
      ) : (
        <span className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
      )}
      <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold text-fg">
        {teamName(id)}
      </span>
      {knocks.length > 0 ? (
        <span
          className="shrink-0 text-[0.7rem] text-fg-dim"
          title={knocks.map((k) => `${k.player} (${k.position}) — ${k.status}`).join(", ")}
        >
          {knocks.length} out
        </span>
      ) : null}
      {favourite ? (
        <span className="shrink-0 text-[0.7rem] font-medium text-fg-dim">fav</span>
      ) : null}
    </div>
  );
}

export function GameCard({
  game,
  week,
  timeLabel,
  highlight,
}: {
  game: Game;
  week: number;
  timeLabel: string;
  /** The Bills game — §8 pins it first regardless of score. */
  highlight?: boolean;
}) {
  const { score, reason } = watchability(game, week);

  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4"
      style={
        highlight
          ? { borderColor: teamColor("BUF"), background: "var(--color-surface-2)" }
          : undefined
      }
    >
      {highlight ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: teamColor("BUF") }}
        />
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="tnum truncate text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
          {timeLabel}
          {game.broadcast ? ` · ${game.broadcast}` : ""}
        </p>
        <WatchPill score={score} />
      </div>

      <div className="space-y-1.5">
        {/* Two stacked logos tell a lifelong fan who's home by convention and
            tell a newcomer nothing, so the home row says "at" outright. */}
        <TeamRow id={game.away} favourite={game.favourite === "away"} />
        <TeamRow id={game.home} prefix="at" favourite={game.favourite === "home"} />
      </div>

      <p className="mt-2.5 border-t border-line pt-2.5 text-sm leading-snug text-fg-dim">
        {reason}
      </p>
    </article>
  );
}

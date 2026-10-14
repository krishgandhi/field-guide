"use client";

import { useSyncExternalStore } from "react";
import { gamePhase, type GamePhase } from "@/lib/game-phase";
import { MoreGames } from "./more-games";

/**
 * Whether a game is still to come, decided when the page is VIEWED.
 *
 * /games and the team pages are built once and served until the next data
 * commit, so a phase computed on the server is a phase as of the build. That
 * is how Monday's game was still "Must watch" on Wednesday. Same pattern as
 * StaleBanner: the server renders its best guess, then the browser's clock
 * takes over after hydration — and re-checks every minute, so a page left
 * open flips at kickoff.
 *
 * The snapshot is a string so useSyncExternalStore sees a stable value
 * between ticks (a fresh array each call would loop forever).
 */
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

export function usePhases(kickoffs: string[], serverPhases: GamePhase[]): GamePhase[] {
  const joined = useSyncExternalStore(
    subscribe,
    () => kickoffs.map((k) => gamePhase(k)).join(","),
    () => serverPhases.join(","),
  );
  return joined ? (joined.split(",") as GamePhase[]) : [];
}

/**
 * One node per phase. Nodes rather than a render function because the server
 * page builds them and a function can't cross to the client.
 */
export type PhaseNodes = {
  upcoming: React.ReactNode;
  live: React.ReactNode;
  played: React.ReactNode;
};

/** Renders the node for the game's phase right now. */
export function PhaseSwitch({
  kickoff,
  serverPhase,
  ...nodes
}: { kickoff: string; serverPhase: GamePhase } & PhaseNodes) {
  const [phase] = usePhases([kickoff], [serverPhase]);
  return <>{nodes[phase]}</>;
}

export type TimedItem = {
  id: string;
  kickoff: string;
  serverPhase: GamePhase;
  /** The full card, shown while the game is still to come. */
  card: React.ReactNode;
};

/**
 * The week's slate in viewing order, split at view time: games under way,
 * then games still to come (the low scorers folded into one row), then the
 * ones played as a compact list.
 */
export function TimedSlate({
  items,
  playedHeader,
  weekDone,
}: {
  items: (TimedItem &
    Omit<PhaseNodes, "upcoming"> & {
      /** Scores a 1: folds behind "N more" while still to come. */
      folded: boolean;
      /** Both teams' logos, for the folded row's summary. */
      logos: React.ReactNode;
    })[];
  playedHeader: React.ReactNode;
  /** Shown in place of the ranking once every game has kicked off. */
  weekDone: React.ReactNode;
}) {
  const phases = usePhases(
    items.map((i) => i.kickoff),
    items.map((i) => i.serverPhase),
  );
  const at = (phase: GamePhase, folded?: boolean) =>
    items.filter(
      (i, n) => phases[n] === phase && (folded === undefined || i.folded === folded),
    );
  const shown = at("upcoming", false);
  const folded = at("upcoming", true);
  const live = at("live");
  const played = at("played");
  return (
    <>
      {shown.length + folded.length + live.length === 0 ? weekDone : null}
      {/* A game being played right now is the most current thing on the page. */}
      {live.length > 0 ? (
        <div className="mb-2.5 space-y-2.5">
          {live.map((i) => (
            <div key={i.id}>{i.live}</div>
          ))}
        </div>
      ) : null}
      <div className="space-y-2.5">
        {shown.map((i) => (
          <div key={i.id}>{i.card}</div>
        ))}
      </div>
      <MoreGames
        count={folded.length}
        logos={folded.slice(0, 2).map((i) => (
          <span key={i.id} className="flex">
            {i.logos}
          </span>
        ))}
      >
        {folded.map((i) => (
          <div key={i.id}>{i.card}</div>
        ))}
      </MoreGames>
      {played.length > 0 ? (
        <>
          {playedHeader}
          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-surface px-4">
            {played.map((i) => (
              <li key={i.id}>{i.played}</li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/**
 * A list that only ever shows games still to come, in the order given.
 * Renders nothing — header included — when every game has started.
 */
export function UpcomingOnly({
  items,
  header,
  footer,
  limit,
  className,
}: {
  items: TimedItem[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
  limit?: number;
  className?: string;
}) {
  const phases = usePhases(
    items.map((i) => i.kickoff),
    items.map((i) => i.serverPhase),
  );
  const shown = items.filter((_, n) => phases[n] === "upcoming").slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <>
      {header}
      <div className={className}>
        {shown.map((i) => (
          <div key={i.id}>{i.card}</div>
        ))}
      </div>
      {footer}
    </>
  );
}

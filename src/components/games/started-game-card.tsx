import type { Game } from "@/lib/slate";
import { teamName } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TeamLogo } from "./team-logo";
import { playedDay, recordText, startedLabel } from "./format";

/**
 * A game that has already kicked off, said as such.
 *
 * No rating, no line, no "why watch": all three are about a game still to
 * come, and showing them after kickoff is how Monday's game was still a "Must
 * watch" on Wednesday. No score either — the site has none by design (§2).
 * An outline card rather than a filled one, so it recedes behind what's next.
 */
export function StartedGameCard({
  game,
  phase,
  yours = false,
  note,
}: {
  game: Game;
  phase: "live" | "played";
  yours?: boolean;
  /** One plain line under the teams — "next week's games land after the refresh". */
  note?: string;
}) {
  return (
    <Card as="article" tone={yours ? "yours" : "quiet"}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <p className={`label truncate ${phase === "live" ? "text-chalk" : "text-chalk-dim"}`}>
          {startedLabel(game, phase)}
        </p>
        {yours ? (
          <Chip variant="yours" size="sm">
            Your team
          </Chip>
        ) : null}
      </div>
      {[game.away, game.home].map((id, i) => (
        <div key={id} className="flex h-[30px] items-center gap-2.5">
          <span className="w-3.5 shrink-0 text-right text-xs text-chalk-dim">
            {i === 1 && !game.neutralSite ? "at" : ""}
          </span>
          <TeamLogo id={id} size={24} />
          <span className="truncate text-[16px] font-bold text-chalk">{teamName(id)}</span>
          {recordText(id) ? (
            <span className="tnum shrink-0 text-[13px] text-chalk-dim">{recordText(id)}</span>
          ) : null}
        </div>
      ))}
      {note ? <p className="mt-2.5 text-[14.5px] leading-[1.45] text-chalk-dim">{note}</p> : null}
    </Card>
  );
}

/**
 * A played game as one line in a list: both logos, "Bills at Rams", the day.
 * Fifteen outline cards for a finished week read as a wall; what a played
 * game needs to say is only that it happened.
 */
export function PlayedGameRow({ game, yours = false }: { game: Game; yours?: boolean }) {
  const joiner = game.neutralSite ? "vs" : "at";
  return (
    <div className="flex min-h-12 items-center gap-3 py-2">
      <span aria-hidden className="flex shrink-0 items-center gap-1">
        <TeamLogo id={game.away} size={22} />
        <TeamLogo id={game.home} size={22} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${yours ? "text-royal" : "text-chalk"}`}>
        {teamName(game.away)} <span className="font-normal text-chalk-dim">{joiner}</span>{" "}
        {teamName(game.home)}
      </span>
      {/* Just the day: the section is already headed "Already played". */}
      <span className="label shrink-0 text-chalk-dim">{playedDay(game)}</span>
    </div>
  );
}

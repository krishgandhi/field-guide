import type { Game } from "@/lib/slate";
import { teamName } from "@/lib/teams";
import { watchability } from "@/lib/watchability";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { RatingTile } from "@/components/ui/rating-tile";
import { GameFacts } from "./game-facts";
import { TeamLogo } from "./team-logo";
import { favouriteSuffix, injuryReport, recordText, type InjuryReport } from "./format";

/**
 * One game, ranked to watch (§8): the jersey-numeral rating, both teams with
 * their records, and the plain sentence saying why.
 *
 * Identity is carried by the logo, not by colour — 22 of the 32 brand colours
 * fail contrast here, and the lifted navies converge on the same blue (§10).
 *
 * The reason stays prominent. It is the only thing here the NFL app doesn't
 * already do better, so nothing gets to crowd it out.
 */
function TeamRow({ game, id, isHome }: { game: Game; id: string; isHome: boolean }) {
  const record = recordText(id);
  const fav = favouriteSuffix(game, id);
  return (
    <div className="flex h-[30px] items-center gap-2.5">
      {/* Two stacked logos tell a lifelong fan who's home by convention and
          tell a newcomer nothing, so the home row says "at" outright. */}
      <span className="w-3.5 shrink-0 text-right text-xs text-chalk-dim">
        {isHome && !game.neutralSite ? "at" : ""}
      </span>
      <TeamLogo id={id} size={26} />
      <span className="truncate text-[17px] font-bold text-chalk">{teamName(id)}</span>
      {record || fav ? (
        <span className="tnum shrink-0 text-[13px] text-chalk-dim">
          {[record, fav].filter(Boolean).join(" · ")}
        </span>
      ) : null}
    </div>
  );
}

export function GameCard({
  game,
  week,
  timeLabel,
  yours = false,
  explain = (s) => s,
}: {
  game: Game;
  week: number;
  /** "Sun 1:00 PM · Fox". */
  timeLabel: string;
  /** The Bills game — §8 pins it first regardless of score. */
  yours?: boolean;
  explain?: (text: string) => React.ReactNode;
}) {
  const { score, reason } = watchability(game, week);
  const reports = [injuryReport(game.away), injuryReport(game.home)].filter(
    (r): r is InjuryReport => r !== null,
  );

  return (
    <Card as="article" tone={yours ? "yours" : "default"}>
      <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
        <p className="label truncate text-chalk-dim">{timeLabel}</p>
        {yours ? (
          <Chip variant="yours" size="sm">
            Your team
          </Chip>
        ) : null}
      </div>

      <div className="flex items-start gap-3.5">
        <RatingTile score={score} />
        <div className="min-w-0 flex-1 -ml-1.5">
          <TeamRow game={game} id={game.away} isHome={false} />
          <TeamRow game={game} id={game.home} isHome />
        </div>
      </div>

      <p className="mt-2.5 text-[15px] leading-[1.45] text-chalk">{explain(reason)}</p>
      <GameFacts reports={reports} />
    </Card>
  );
}

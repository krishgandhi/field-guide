import type { Game } from "@/lib/slate";
import { watchability } from "@/lib/watchability";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { RatingTile } from "@/components/ui/rating-tile";
import { GameFacts } from "./game-facts";
import { TeamLogo } from "./team-logo";
import { injuryReport, recordText, spreadLabel, type InjuryReport } from "./format";

/**
 * Your team's game, drawn as a field (§10): mown turf stripes, yard lines and
 * hash marks, a logo in each end zone.
 *
 * Reserved for the one game that matters to him this week. Turf anywhere
 * else would turn the signature into wallpaper.
 */

/** Ten-yard lines at 10%…90%; the 50 is drawn brighter. */
const YARD_LINES = Array.from({ length: 9 }, (_, i) => (i + 1) * 10);

/** Hash marks between the yard lines, kept out of the end zones (17% each side). */
const HASHES = YARD_LINES.flatMap((x) =>
  [1, 2, 3, 4].map((h) => x + h * 2 - 5).filter((hx) => hx >= 17 && hx <= 83),
);

export function FieldCard({
  game,
  week,
  timeLabel,
  explain = (s) => s,
}: {
  game: Game;
  week: number;
  /** "Tonight 8:15 PM · ESPN, ABC". */
  timeLabel: string;
  explain?: (text: string) => React.ReactNode;
}) {
  const { score, reason } = watchability(game, week);
  const awayRecord = recordText(game.away);
  const homeRecord = recordText(game.home);
  const reports = [injuryReport(game.away), injuryReport(game.home)].filter(
    (r): r is InjuryReport => r !== null,
  );
  // A neutral-site game has no home team, so "at" would be false.
  const joiner = game.neutralSite ? "vs" : "at";

  return (
    <Card as="article" tone="yours" pad="sm">
      <div className="flex items-center justify-between gap-3 px-1 pb-2 pt-0.5">
        <p className="label truncate text-chalk">{timeLabel}</p>
        <Chip variant="yours" size="sm">
          Your team
        </Chip>
      </div>

      <div
        className="relative h-[150px] overflow-hidden rounded-[var(--radius-inner)]"
        style={{
          background:
            "repeating-linear-gradient(90deg, var(--color-turf) 0 10%, var(--color-turf-2) 10% 20%)",
        }}
      >
        {YARD_LINES.map((x) => (
          <span
            key={`yl-${x}`}
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-chalk-line"
            style={{ left: `calc(${x}% - 1px)`, opacity: x === 50 ? 1 : 0.5 }}
          />
        ))}
        {HASHES.map((x) => (
          <span key={`h-${x}`} aria-hidden>
            <span
              className="absolute top-2.5 h-[7px] w-[1.5px] bg-chalk-line"
              style={{ left: `${x}%` }}
            />
            <span
              className="absolute bottom-2.5 h-[7px] w-[1.5px] bg-chalk-line"
              style={{ left: `${x}%` }}
            />
          </span>
        ))}

        <div className="absolute inset-y-0 left-0 grid w-[17%] place-items-center bg-black/20">
          <TeamLogo
            id={game.away}
            size={52}
            eager
            className="drop-shadow-[0_4px_8px_rgb(0_0_0/0.45)]"
          />
        </div>
        <div className="absolute inset-y-0 right-0 grid w-[17%] place-items-center bg-black/20">
          <TeamLogo
            id={game.home}
            size={52}
            eager
            className="drop-shadow-[0_4px_8px_rgb(0_0_0/0.45)]"
          />
        </div>

        <div className="absolute inset-y-0 left-[17%] right-[17%] flex flex-col items-center justify-center gap-1.5 px-1 text-center">
          <h3 className="font-display text-[40px] font-black leading-none tracking-[0.01em] text-chalk [text-shadow:0_2px_10px_rgb(0_0_0/0.4)]">
            {game.away}
            <span className="mx-1.5 text-[22px] font-bold text-chalk/80">{joiner}</span>
            {game.home}
          </h3>
          <p className="label text-[13px] text-chalk/90">
            {[awayRecord, game.venue, homeRecord].filter(Boolean).join("  ·  ")}
          </p>
        </div>
      </div>

      <div className="flex gap-3.5 px-1 pb-1 pt-3.5">
        <RatingTile score={score} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-[1.45] text-chalk">{explain(reason)}</p>
          <GameFacts line={spreadLabel(game)} reports={reports} />
        </div>
      </div>
    </Card>
  );
}

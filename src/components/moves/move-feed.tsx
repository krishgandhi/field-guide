import Link from "next/link";
import type { Move } from "@/lib/moves";
import { Card } from "@/components/ui/card";
import { LogoDiscs } from "@/components/games/logo-discs";
import { BignessChip, CheckedChip } from "./move-chips";

/**
 * A short feed of moves for the home screen: the teams' logos, the headline,
 * how big it is and whether it has been checked. Each row opens the move.
 */
export function MoveFeed({ moves }: { moves: Move[] }) {
  if (moves.length === 0) return null;
  return (
    <Card pad="none" className="px-4">
      <ul className="divide-y divide-line">
        {moves.map((move) => (
          <li key={move.slug}>
            <Link
              href={`/moves/${move.slug}`}
              className="group flex gap-3 py-3.5"
            >
              <LogoDiscs ids={move.teams.slice(0, 2)} />
              <div className="min-w-0">
                <h3 className="text-[15.5px] font-bold leading-[1.3] text-chalk underline-offset-[3px] group-hover:underline group-hover:decoration-chalk-dim">
                  {move.headline}
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <BignessChip value={move.bigness} />
                  <CheckedChip verified={move.verified} sensitive={move.sensitive} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

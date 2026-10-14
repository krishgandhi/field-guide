import { TeamLogo } from "./team-logo";

/**
 * Team logos on discs, as a 44px mark beside a line of text: one team gets a
 * single disc, two overlap diagonally (a trade, a pair on bye), more sit in a
 * row. Decorative — the text beside it always names the teams.
 */
export function LogoDiscs({ ids }: { ids: string[] }) {
  if (ids.length === 1) {
    return (
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2">
        <TeamLogo id={ids[0]} size={28} />
      </span>
    );
  }
  if (ids.length === 2) {
    return (
      <span aria-hidden className="relative block size-11 shrink-0">
        <span className="absolute left-0 top-0 grid size-[30px] place-items-center rounded-full bg-surface-2">
          <TeamLogo id={ids[0]} size={22} />
        </span>
        <span className="absolute bottom-0 right-0 grid size-[30px] place-items-center rounded-full bg-surface-2 ring-[3px] ring-surface">
          <TeamLogo id={ids[1]} size={22} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden className="flex shrink-0">
      {ids.slice(0, 4).map((id, i) => (
        <span
          key={id}
          className={`grid size-[30px] place-items-center rounded-full bg-surface-2 ring-[3px] ring-surface ${i > 0 ? "-ml-2" : ""}`}
        >
          <TeamLogo id={id} size={22} />
        </span>
      ))}
    </span>
  );
}

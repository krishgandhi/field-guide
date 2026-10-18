import { teamName } from "@/lib/teams";
import { Card } from "@/components/ui/card";
import { LogoDiscs } from "./logo-discs";

/**
 * Who isn't playing, said outright (§13). A team missing from the slate looks
 * like a bug to a newcomer every single year, so the card names them and says
 * why: it's their bye week, not a gap in the schedule.
 *
 * `explain` auto-links "bye week" to the glossary, so the one term a newcomer
 * needs here is a tap away.
 */
export function ByeCard({
  byes,
  week,
  explain = (s) => s,
}: {
  byes: string[];
  week: number;
  explain?: (text: string) => React.ReactNode;
}) {
  if (byes.length === 0) {
    return (
      <Card className="flex min-h-[60px] items-center">
        <p className="text-[14.5px] leading-[1.4] text-chalk">
          All 32 teams play in week {week}. Nobody has a bye this time.
        </p>
      </Card>
    );
  }

  const names = listJoin(byes.map(teamName));
  // Team names are plural nouns ("the Chiefs"), so even one team "aren't".

  return (
    <Card pad="none" className="flex items-center gap-3 px-3.5 py-3">
      <LogoDiscs ids={byes} />
      <p className="text-[14.5px] leading-[1.4] text-chalk">
        {names} aren&rsquo;t playing.{" "}
        {explain("It’s their bye week, not a gap in the schedule.")}
      </p>
    </Card>
  );
}

/** "Chiefs and Panthers", "Chiefs, Panthers and Jets". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

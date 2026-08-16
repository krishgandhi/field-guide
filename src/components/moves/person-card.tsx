import Image from "next/image";
import { draftLabel, type Person } from "@/lib/people";

/**
 * A short "who is this" for the people a move is about.
 *
 * A move entry names someone the reader has never heard of and carries on as
 * though they know — the exact gap §1 exists to close. Identity only: position,
 * age, where they were drafted, where they came from. No statistics, because
 * §1 is explicit that a number without an explanation doesn't belong here.
 *
 * Headshots are served from public/players/, downloaded by fetch-people.mjs
 * rather than hotlinked (§10). A missing image degrades to a text-only card.
 */
export function PersonCard({
  person,
  explain,
}: {
  person: Person;
  /** The page's shared glossary explainer, so terms link once per page (§6a). */
  explain: (text: string) => React.ReactNode;
}) {
  const drafted = draftLabel(person.draft);
  // "CB · 25 · 4th season" — the one-glance line.
  const facts = [person.positionShort, person.age ? `${person.age}` : null, person.experience]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      {/* Identity beside the headshot; the prose below at full width. Running
          65 words down a narrow column next to a 56px image is unreadable on a
          phone — it was taller than the viewport. */}
      <div className="flex items-center gap-3">
        {person.headshot ? (
          <Image
            src={person.headshot}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full bg-surface-2 object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[0.95rem] font-semibold leading-tight text-fg">
            {person.name}
          </p>
          {facts ? (
            <p className="tnum mt-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-fg-dim">
              {facts}
            </p>
          ) : null}
        </div>
      </div>

      {person.blurb ? (
        <p className="mt-3 text-sm leading-relaxed text-fg-dim">
          {explain(person.blurb)}
        </p>
      ) : null}

      {/* Last, and quiet: useful once you care, noise before that. */}
      {drafted || person.college || person.team ? (
        <p className="mt-2.5 text-[0.75rem] leading-snug text-fg-dim/80">
          {[drafted, person.college, person.team].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

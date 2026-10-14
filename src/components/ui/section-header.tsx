import Link from "next/link";

/**
 * A section heading in Big Shoulders (§10), with an optional quiet aside on
 * the right — a count, a scope ("of 32 teams"), or a "See all" link.
 *
 * The heading carries its own weight; there is no small label above it.
 */
export function SectionHeader({
  title,
  aside,
  href,
  id,
}: {
  title: string;
  aside?: string;
  /** Turns the aside into a link — "See all" to the full list. */
  href?: string;
  id?: string;
}) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between gap-3">
      <h2 id={id} className="heading text-2xl text-chalk">
        {title}
      </h2>
      {aside && href ? (
        <Link
          href={href}
          className="-my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-chalk-dim transition-colors duration-[120ms] hover:text-chalk"
        >
          {aside}
        </Link>
      ) : aside ? (
        <span className="text-[13px] font-medium text-chalk-dim">{aside}</span>
      ) : null}
    </div>
  );
}

import Link from "next/link";

/** Shared page chrome so every screen has the same shape and spacing. */

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8 pt-6 sm:px-8">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  kicker,
  backHref,
  backLabel,
}: {
  title: string;
  kicker?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="border-b-2 border-fg/80 pb-4">
      {backHref ? (
        <Link
          href={backHref}
          className="font-data mb-1 inline-flex min-h-11 items-center text-xs uppercase tracking-[0.2em] text-fg/60 hover:text-pencil"
        >
          ← {backLabel ?? "Back"}
        </Link>
      ) : null}
      {kicker ? (
        <p className="font-data text-xs uppercase tracking-[0.2em] text-fg/60">
          {kicker}
        </p>
      ) : null}
      <h1 className="font-display condensed mt-1 text-4xl font-semibold text-fg sm:text-5xl">
        {title}
      </h1>
    </header>
  );
}

export function SectionHeader({
  title,
  aside,
  first,
}: {
  title: string;
  aside?: string;
  /** Drops the top margin — the first section shouldn't push itself down the page. */
  first?: boolean;
}) {
  return (
    <div
      className={`${first ? "mt-1" : "mt-9"} flex items-baseline justify-between gap-3 border-b border-fg/25 pb-1`}
    >
      <h2 className="font-display condensed text-lg font-semibold uppercase tracking-wide text-fg">
        {title}
      </h2>
      {aside ? (
        <span className="font-data text-[0.65rem] uppercase tracking-[0.15em] text-fg/55">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

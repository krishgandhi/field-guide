import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Shared page chrome. Every screen uses these so spacing and type hierarchy
 * stay identical across tabs — the thing that most makes a set of screens feel
 * like one app rather than several pages.
 */

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10 pt-8 sm:px-6">
      {children}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-fg-dim hover:text-fg"
    >
      <ChevronLeft size={16} aria-hidden />
      {label}
    </Link>
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
    <header>
      {backHref ? <BackLink href={backHref} label={backLabel ?? "Back"} /> : null}
      {kicker ? (
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
          {kicker}
        </p>
      ) : null}
      <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-fg">
        {title}
      </h1>
    </header>
  );
}

/**
 * Section label. Deliberately quiet — a small dimmed cap rather than the heavy
 * ruled headings of the old design, so the cards below it carry the weight.
 */
export function SectionHeader({
  title,
  aside,
}: {
  title: string;
  aside?: string;
}) {
  return (
    <div className="mb-2 mt-7 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
        {title}
      </h2>
      {aside ? (
        <span className="text-[0.7rem] font-medium text-fg-dim/70">{aside}</span>
      ) : null}
    </div>
  );
}

/**
 * The standard surface everything sits on.
 *
 * `tone` rather than passing border/background classes in: Tailwind decides
 * which of two conflicting utilities wins by its own output order, not by the
 * order they appear in the class attribute, so `className="border-amber/25"`
 * silently loses to the built-in `border-line`. A variant avoids the conflict
 * instead of fighting it.
 */
export function Card({
  children,
  tone = "default",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "amber";
  className?: string;
}) {
  const tones = {
    default: "border-line bg-surface",
    amber: "border-amber/30 bg-amber/[0.07]",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}

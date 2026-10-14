import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Shared page chrome. Every screen uses these so spacing and type hierarchy
 * stay identical across tabs — the thing that most makes a set of screens feel
 * like one app rather than several pages.
 *
 * Card and SectionHeader moved to their own files with the Yellow Line
 * primitives; they are re-exported here so screens not yet rebuilt keep
 * importing from one place.
 */

export { Card } from "@/components/ui/card";
export { SectionHeader } from "@/components/ui/section-header";

export function PageShell({
  children,
  /**
   * Opts this page's prose into the flag queue (§6b) — selecting text inside
   * offers "Flag this". A prop rather than a wrapper div so pages don't grow
   * an extra layout element just to carry an attribute.
   */
  flaggable,
}: {
  children: React.ReactNode;
  flaggable?: boolean;
}) {
  return (
    <div
      data-flaggable={flaggable ? "" : undefined}
      className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-4 sm:px-6 lg:pt-10"
    >
      {children}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-1.5 inline-flex min-h-11 items-center gap-0.5 text-[15px] font-semibold text-chalk-dim transition-colors duration-[120ms] hover:text-chalk"
    >
      <ChevronLeft size={20} aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Title block for screens that haven't had their own Yellow Line layout yet.
 * `kicker` renders as a plain line under the title, not a label above it.
 */
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
    <header className="mt-2">
      {backHref ? <BackLink href={backHref} label={backLabel ?? "Back"} /> : null}
      <h1 className="heading text-[44px] text-chalk text-balance">{title}</h1>
      {kicker ? <p className="mt-1.5 text-[15px] text-chalk-dim">{kicker}</p> : null}
    </header>
  );
}

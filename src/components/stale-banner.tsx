"use client";

import { useSyncExternalStore } from "react";
import { AlertTriangle } from "lucide-react";
import { daysStale, isStale } from "@/lib/staleness";

/**
 * The "this is N days old" warning, computed when the page is viewed.
 *
 * It used to be computed in the server component, but /games is static, so
 * "now" was the build time — and a build only happens when fresh data lands.
 * The warning could therefore never fire, which is exactly when it was needed.
 *
 * Renders nothing on the server and during hydration; the client snapshot is
 * read after mount. useSyncExternalStore rather than useEffect + setState, the
 * same pattern as QueueLink.
 */
const noSubscribe = () => () => {};

export function StaleBanner({ fetchedAt }: { fetchedAt: string }) {
  const days = useSyncExternalStore(
    noSubscribe,
    () => (isStale(fetchedAt) ? daysStale(fetchedAt) : 0),
    () => 0,
  );

  // Stale is acceptable — §4 prefers it to an error — but silently stale
  // is not, so past three days it says so.
  if (days === 0) return null;

  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-pencil/30 bg-pencil/[0.08] px-3 py-2.5">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-pencil" aria-hidden />
      <p className="text-[0.8rem] leading-snug text-fg-dim">
        <span className="font-semibold text-pencil">
          {Number.isFinite(days) ? `This is ${days} days old.` : "This may be out of date."}
        </span>{" "}
        The daily update hasn&rsquo;t run. Spreads and injuries may have moved.
      </p>
    </div>
  );
}

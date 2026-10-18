"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Flag } from "lucide-react";
import { getServerFlags, pendingCount, subscribe } from "@/lib/flags";

/**
 * The red challenge flag with a count of phrases waiting in the queue (§6b).
 *
 * Client-side because the count lives in localStorage. The server and the
 * first client render both see zero (getServerFlags), then the real count
 * arrives after hydration — useSyncExternalStore handles that handoff.
 *
 * Always shown, even at zero: it is the only way into /queue from a tab
 * screen, and a bare flag is an invitation to use it. The number only
 * appears when something is waiting.
 */
export function FlagCountButton({ className = "" }: { className?: string }) {
  const count = useSyncExternalStore(
    subscribe,
    pendingCount,
    () => getServerFlags().length,
  );

  return (
    <Link
      href="/queue"
      aria-label={
        count === 0
          ? "Flagged phrases: none waiting"
          : `Flagged phrases: ${count} waiting`
      }
      className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-surface px-3 text-challenge transition-colors duration-[120ms] hover:bg-surface-2 ${className}`}
    >
      <Flag size={20} strokeWidth={2} aria-hidden />
      {count > 0 ? (
        <b className="tnum text-[15px] font-bold text-chalk">{count}</b>
      ) : null}
    </Link>
  );
}

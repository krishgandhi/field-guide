"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ChevronRight, Flag } from "lucide-react";
import { getServerFlags, pendingCount, subscribe } from "@/lib/flags";

/**
 * Entry point to the flag queue, with a live count.
 *
 * Client-side because the count lives in localStorage. It renders nothing at
 * all until mounted, and nothing when the count is zero — an always-visible
 * "0 flagged" row is clutter on the one screen that's meant to answer "what do
 * I need to know right now".
 *
 * The queue is deliberately not a sixth nav tab: five is already tight at
 * 380px, and this is a thing he visits occasionally, not a place he browses.
 */
export function QueueLink() {
  // useSyncExternalStore, not useEffect + setState: localStorage is an
  // external store, this is the hook built for subscribing to one, and it
  // handles the server/hydration snapshot without a `mounted` flag.
  const count = useSyncExternalStore(
    subscribe,
    pendingCount,
    () => getServerFlags().length,
  );

  if (count === 0) return null;

  return (
    <Link
      href="/queue"
      className="mt-3 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber/[0.07] px-4 py-3"
    >
      <span className="flex items-center gap-2.5">
        <Flag size={16} className="shrink-0 text-amber" aria-hidden />
        <span>
          <span className="block text-sm font-semibold text-fg">
            {count} thing{count === 1 ? "" : "s"} you flagged
          </span>
          <span className="block text-[0.8rem] text-fg-dim">
            Export them and I&rsquo;ll explain them
          </span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-fg-dim" aria-hidden />
    </Link>
  );
}

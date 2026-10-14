"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

/**
 * An auto-linked glossary term (§6a) — the product's signature element.
 *
 * "The jargon gets explained" is the whole thesis, so this is the one place
 * §10 says to spend boldness: the yellow first-down line under the word, and an explanation one
 * gesture away without leaving the sentence you're reading.
 *
 * Desktop hovers a card; touch opens a bottom sheet, because a hover card is
 * unreachable on a phone and the phone is the primary device.
 *
 * It is a real <a href> underneath. With JavaScript off, or before hydration,
 * tapping simply navigates to the full entry — the feature degrades to a plain
 * link rather than to nothing.
 */
export function GlossaryTerm({
  slug,
  title,
  summary,
  children,
}: {
  slug: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [coarse, setCoarse] = useState(false);

  // Which interaction to use is a property of the pointer, not the screen
  // width — a small window on a laptop still hovers, a large tablet still
  // doesn't. `(hover: none)` asks the right question.
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const href = `/glossary/${slug}`;

  return (
    <span className="relative inline">
      <Link
        href={href}
        aria-haspopup="dialog"
        onClick={(e) => {
          // On touch the first tap explains in place; the sheet's own link
          // navigates. On a pointer device the click just follows the link.
          if (coarse) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        onMouseEnter={() => !coarse && setOpen(true)}
        onMouseLeave={() => !coarse && setOpen(false)}
        onFocus={() => !coarse && setOpen(true)}
        onBlur={() => !coarse && setOpen(false)}
        className="text-chalk underline decoration-yellow/70 decoration-dotted decoration-2 underline-offset-4 transition-colors hover:decoration-yellow"
      >
        {children}
      </Link>

      {/* Desktop: a card under the word. */}
      {open && !coarse ? (
        <span
          role="dialog"
          aria-label={title}
          className="absolute left-0 top-[calc(100%+8px)] z-50 block w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface-2 p-3 text-left shadow-2xl"
        >
          <span className="block text-sm font-semibold text-chalk">{title}</span>
          <span className="mt-1 block text-sm leading-snug text-chalk-dim">
            {summary}
          </span>
          <span className="mt-2 flex items-center gap-1 text-[0.8rem] font-medium text-yellow">
            Read more
            <ArrowRight size={13} aria-hidden />
          </span>
        </span>
      ) : null}

      {/* Touch: a sheet from the bottom. */}
      {open && coarse ? (
        <span
          className="fixed inset-0 z-[60] block"
          onClick={() => setOpen(false)}
        >
          <span className="absolute inset-0 block bg-night/70" />
          <span
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 block rounded-t-3xl border-t border-line bg-surface px-5 pb-9 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              className="mx-auto mb-4 block h-1 w-10 rounded-full bg-chalk/20"
            />
            <span className="flex items-start justify-between gap-4">
              <span className="block text-lg font-semibold text-chalk">
                {title}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-chalk-dim"
              >
                <X size={18} aria-hidden />
              </button>
            </span>
            <span className="mt-1 block text-[0.95rem] leading-relaxed text-chalk-dim">
              {summary}
            </span>
            <Link
              href={href}
              className="mt-4 flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-yellow text-sm font-semibold text-night"
            >
              Read the full entry
              <ArrowRight size={15} aria-hidden />
            </Link>
          </span>
        </span>
      ) : null}
    </span>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Flag } from "lucide-react";
import { addFlag } from "@/lib/flags";

/**
 * Select a phrase you don't understand, tap "Flag this" (§6b).
 *
 * Mounted once in the root layout and active anywhere inside an element marked
 * `data-flaggable`, so it covers prose without ever firing on nav or chrome.
 *
 * §6b is described in the spec as the highest-value feature in the project:
 * it's the mechanism by which the site improves. Reading produces a work list.
 */

const MAX_PHRASE = 160;

/** The sentence the phrase sits in, so a flag still makes sense a week later. */
function sentenceAround(block: string, phrase: string): string {
  const text = block.replace(/\s+/g, " ").trim();
  const target = phrase.replace(/\s+/g, " ").trim();

  // Split on sentence ends, keeping the terminator with its sentence.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => s.includes(target));
  if (hit) return hit.trim();

  // Selection spanned a boundary — fall back to a window around it.
  const i = text.indexOf(target);
  if (i === -1) return target;
  return `…${text.slice(Math.max(0, i - 90), i + target.length + 90).trim()}…`;
}

/** Nearest block-ish ancestor, for sentence context. */
function blockTextFor(node: Node | null): string {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el && !/^(P|LI|H1|H2|H3|H4|H5|H6|TD|BLOCKQUOTE|ARTICLE|DIV)$/.test(el.tagName)) {
    el = el.parentElement;
  }
  return el?.textContent ?? "";
}

export function FlagSelection() {
  const pathname = usePathname();
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    path: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const selectionRef = useRef<{ phrase: string; sentence: string } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evaluate = useCallback(() => {
    const sel = window.getSelection();
    const phrase = sel?.toString().trim() ?? "";

    if (!sel || sel.isCollapsed || phrase.length < 2 || phrase.length > MAX_PHRASE) {
      setAnchor(null);
      return;
    }

    // Only inside prose that opted in.
    const node = sel.anchorNode;
    const host =
      node instanceof Element
        ? node.closest("[data-flaggable]")
        : node?.parentElement?.closest("[data-flaggable]");
    if (!host) {
      setAnchor(null);
      return;
    }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setAnchor(null);
      return;
    }

    selectionRef.current = {
      phrase,
      sentence: sentenceAround(blockTextFor(node), phrase),
    };
    // Below the selection: iOS puts its own callout above, and fighting it for
    // that space means one of them is always unreachable.
    setAnchor({
      x: Math.min(Math.max(rect.left + rect.width / 2, 76), window.innerWidth - 76),
      y: Math.min(rect.bottom + 10, window.innerHeight - 96),
      path: window.location.pathname,
    });
  }, []);

  useEffect(() => {
    // selectionchange fires continuously while dragging, so settle first.
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(evaluate, 120);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [evaluate]);

  // A route change must never carry a stale button across with it. Derived
  // during render rather than reset in an effect: setting state synchronously
  // inside an effect triggers a cascading re-render, and React's lint rule
  // flags it. Comparing the recorded path is the same guarantee, for free.
  const visible = anchor?.path === pathname ? anchor : null;

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  function flag() {
    const current = selectionRef.current;
    if (!current) return;

    const pageTitle =
      document.querySelector("h1")?.textContent?.trim() ||
      document.title.replace(/\s*—\s*Field guide$/, "");

    addFlag({ ...current, path: pathname, pageTitle });

    window.getSelection()?.removeAllRanges();
    setAnchor(null);
    setConfirmed(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setConfirmed(false), 3500);
  }

  return (
    <>
      {visible ? (
        <button
          type="button"
          // Without this the button's mousedown collapses the selection before
          // the click ever lands, and there is nothing left to flag.
          onMouseDown={(e) => e.preventDefault()}
          onClick={flag}
          style={{ left: visible.x, top: visible.y }}
          className="fixed z-[70] flex min-h-11 -translate-x-1/2 items-center gap-1.5 rounded-full bg-amber px-4 text-sm font-semibold text-ink shadow-2xl"
        >
          <Flag size={14} aria-hidden />
          Flag this
        </button>
      ) : null}

      {confirmed ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 shadow-2xl"
        >
          <span className="flex items-center gap-2 text-sm text-fg">
            <Check size={15} className="text-amber" aria-hidden />
            Flagged
          </span>
          <Link
            href="/queue"
            className="text-sm font-semibold text-amber hover:underline"
          >
            See queue
          </Link>
        </div>
      ) : null}
    </>
  );
}

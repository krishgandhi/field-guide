"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, ClipboardCopy, Trash2 } from "lucide-react";
import {
  exportPayload,
  getFlags,
  getServerFlags,
  markAllExported,
  removeFlag,
  subscribe,
} from "@/lib/flags";
import { BackLink, Card, PageShell } from "@/components/ui/page-header";

/**
 * The flag queue (§6b).
 *
 * Everything he flagged, with the sentence it came from and the file to edit.
 * One button copies the lot as JSON; he pastes it into Claude Code and that is
 * the entire sync mechanism — the spec is explicit that nothing more elaborate
 * should be built.
 *
 * Client component throughout: the data lives in localStorage, which the
 * server cannot see. Rendering waits for mount so the server HTML and the
 * first client render agree.
 */
export default function QueuePage() {
  // The store returns a cached array so its identity is stable between
  // mutations — useSyncExternalStore compares snapshots by reference.
  const flags = useSyncExternalStore(subscribe, getFlags, getServerFlags);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const pending = flags.filter((f) => !f.exportedAt);

  async function exportQueue() {
    const json = JSON.stringify(exportPayload(flags), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      // Only stamp them once the copy actually succeeded — marking flags
      // exported when the clipboard failed would quietly lose the work.
      markAllExported();
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <PageShell>
      <BackLink href="/" label="This week" />

      <header>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
          {pending.length} waiting
        </p>
        <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-tight text-fg">
          Flagged
        </h1>
      </header>

      {flags.length === 0 ? (
        /* §10: empty states are invitations, not apologies. */
        <Card className="mt-5">
          <p className="text-sm leading-relaxed text-fg-dim">
            Nothing flagged yet. While you&rsquo;re reading, select any phrase
            that doesn&rsquo;t make sense and tap{" "}
            <span className="font-semibold text-amber">Flag this</span>. It
            lands here, and one button hands the whole list back to me.
          </p>
          <Link
            href="/glossary"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-amber hover:underline"
          >
            Go read something
          </Link>
        </Card>
      ) : (
        <>
          <button
            type="button"
            onClick={exportQueue}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber text-sm font-semibold text-ink"
          >
            {copied ? (
              <>
                <Check size={16} aria-hidden />
                Copied {flags.length} to clipboard
              </>
            ) : (
              <>
                <ClipboardCopy size={16} aria-hidden />
                Export queue
              </>
            )}
          </button>

          {copyFailed ? (
            <p className="mt-2 text-sm text-pencil">
              Couldn&rsquo;t reach the clipboard — that usually means the page
              isn&rsquo;t on HTTPS or the browser blocked it. Nothing was marked
              as exported.
            </p>
          ) : (
            <p className="mt-2 text-center text-[0.8rem] text-fg-dim">
              Copies as JSON. Paste it into Claude Code.
            </p>
          )}

          <div className="mt-5 space-y-3">
            {flags.map((flag) => (
              <Card key={flag.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-semibold text-fg">
                    &ldquo;{flag.phrase}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() => removeFlag(flag.id)}
                    aria-label={`Remove flag for ${flag.phrase}`}
                    className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-dim hover:text-pencil"
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>

                <p className="mt-1.5 text-sm leading-snug text-fg-dim">
                  {flag.sentence}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[0.7rem] text-fg-dim">
                  <Link href={flag.path} className="font-medium hover:text-fg">
                    {flag.pageTitle}
                  </Link>
                  {flag.sourceFile ? (
                    <code className="text-fg-dim/70">{flag.sourceFile}</code>
                  ) : null}
                  {flag.exportedAt ? (
                    <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 font-medium">
                      exported
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}

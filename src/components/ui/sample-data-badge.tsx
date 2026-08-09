import { FlaskConical } from "lucide-react";

/**
 * The always-visible marker that a screen is showing invented data.
 *
 * Not a dev-only marker. A rating that looks authoritative but was placed by
 * hand is precisely the failure this product exists to prevent (CLAUDE.md §1),
 * so it says so on screen, in production, every time.
 *
 * Remove it from a screen only when that screen's data is genuinely real.
 */
export function SampleDataBadge({ note }: { note?: string }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber/25 bg-amber/[0.07] px-3 py-2.5">
      <FlaskConical
        size={15}
        className="mt-0.5 shrink-0 text-amber"
        aria-hidden
      />
      <p className="text-[0.8rem] leading-snug text-fg-dim">
        <span className="font-semibold text-amber">Sample data.</span>{" "}
        {note ?? "Placeholder values, not real."}
      </p>
    </div>
  );
}

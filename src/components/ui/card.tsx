/**
 * The surface everything sits on (§10): a flat 22px-radius card on night.
 *
 * No border and no shadow — depth comes from the surface step alone, and
 * shadow is kept for things that genuinely float (the sheet, the flag
 * popover). `tone="yours"` is the royal hairline the proposal gives the Bills
 * game: allegiance, not alarm.
 *
 * Tone is a prop rather than classes passed in, because Tailwind resolves two
 * conflicting utilities by its own output order, not by the order in the class
 * attribute — a caller's `bg-*` could silently lose to the built-in one.
 */
export function Card({
  children,
  tone = "default",
  as: Tag = "div",
  pad = "md",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "yours" | "quiet";
  /** `sm` for a card framing a picture (the field); `none` for lists that pad their own rows. */
  pad?: "md" | "sm" | "none";
  as?: "div" | "article" | "section" | "li";
  className?: string;
}) {
  const tones = {
    default: "bg-surface",
    yours: "bg-surface ring-[1.5px] ring-inset ring-royal/55",
    // History and done states: an outline instead of a fill, so it recedes.
    quiet: "bg-transparent ring-1 ring-inset ring-line",
  };
  const pads = { md: "p-4", sm: "p-3", none: "" };
  return (
    <Tag className={`rounded-[var(--radius-card)] ${pads[pad]} ${tones[tone]} ${className}`}>
      {children}
    </Tag>
  );
}

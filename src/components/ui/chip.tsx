/**
 * A short fact in a pill (§10). Each variant carries one meaning, so a chip's
 * colour can be read before its words:
 *
 * - `watch`     solid yellow. The top of the scale: huge, must watch.
 * - `notable`   yellow outline. Big, worth it.
 * - `quiet`     a plain fact — "Rams by 3.5", "Bills: 1 out".
 * - `checked`   mint. Facts checked against reporting.
 * - `unchecked` dim outline. Written automatically, nobody has checked it.
 * - `yours`     royal. The Bills.
 * - `flag`      challenge red. Something Krish contested.
 *
 * Yellow is the first-down line and means "explained / watch this". Spending
 * it anywhere else dilutes the one signal the design is built on.
 */
export type ChipVariant =
  | "watch"
  | "notable"
  | "quiet"
  | "checked"
  | "unchecked"
  | "yours"
  | "flag";

const VARIANTS: Record<ChipVariant, string> = {
  watch: "bg-yellow text-night",
  notable: "ring-[1.5px] ring-inset ring-yellow text-yellow",
  quiet: "bg-surface-2 text-chalk-dim",
  checked: "bg-mint/12 text-mint",
  unchecked: "ring-[1.5px] ring-inset ring-chalk-dim text-chalk-dim",
  yours: "bg-royal/14 text-royal",
  flag: "bg-challenge/14 text-challenge",
};

export function Chip({
  children,
  variant = "quiet",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  variant?: ChipVariant;
  /** `sm` for a chip riding in a card's meta row. */
  size?: "sm" | "md";
  className?: string;
}) {
  const sizes = {
    sm: "h-6 px-2.5 text-xs",
    md: "h-7 px-[11px] text-[13px]",
  };
  return (
    <span
      className={`tnum inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

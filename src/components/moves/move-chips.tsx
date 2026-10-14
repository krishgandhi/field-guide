import { AlertTriangle, Check, CircleDashed } from "lucide-react";
import { Chip, type ChipVariant } from "@/components/ui/chip";
import { bignessLabel } from "@/lib/moves/bigness";

/**
 * How big a move is, as a chip: the word first, the number second ("Big · 4").
 * Solid yellow is kept for the top of the scale so a 5 reads differently
 * from a 4 before the words are read.
 */
export function BignessChip({ value, size }: { value: number; size?: "sm" | "md" }) {
  const variant: ChipVariant = value >= 5 ? "watch" : value === 4 ? "notable" : "quiet";
  return (
    <Chip variant={variant} size={size}>
      {bignessLabel(value)}
    </Chip>
  );
}

/**
 * Whether anyone has checked the facts (§9). `verified` is a claim the reader
 * is entitled to see — unlike `reviewed`, which is Krish's private to-do and
 * never renders in production (§5). Sensitive entries say so louder, in the
 * flag colour, because being wrong there harms a real person.
 */
export function CheckedChip({
  verified,
  sensitive = false,
}: {
  verified: boolean;
  sensitive?: boolean;
}) {
  if (verified) {
    return (
      <Chip variant="checked">
        <Check strokeWidth={2.4} aria-hidden />
        Checked
      </Chip>
    );
  }
  if (sensitive) {
    return (
      <Chip variant="flag">
        <AlertTriangle strokeWidth={2.4} aria-hidden />
        Unverified
      </Chip>
    );
  }
  return (
    <Chip variant="unchecked">
      <CircleDashed strokeWidth={2.4} aria-hidden />
      Not checked yet
    </Chip>
  );
}

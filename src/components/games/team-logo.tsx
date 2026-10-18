import Image from "next/image";
import { teamLogo } from "@/lib/teams";

/**
 * A bundled team logo (§10: never hotlinked). Decorative by default — the
 * team's name is always written next to it — so alt is empty unless a caller
 * passes one. An unknown id degrades to a quiet disc rather than a broken image.
 */
export function TeamLogo({
  id,
  size,
  alt = "",
  eager = false,
  className = "",
}: {
  id: string;
  size: number;
  alt?: string;
  /** Load now rather than lazily — for logos at the top of the first screen. */
  eager?: boolean;
  className?: string;
}) {
  const src = teamLogo(id);
  if (!src) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={`block shrink-0 rounded-full bg-surface-2 ${className}`}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={eager ? "eager" : "lazy"}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

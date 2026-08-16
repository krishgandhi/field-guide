import { AlertTriangle, Sparkles } from "lucide-react";

/**
 * Says plainly that an entry was written by the pipeline and nobody has read it.
 *
 * These entries publish automatically — the point is that Krish opens the site
 * and the news is already there. The honest cost of removing the human from
 * that path is telling the reader, so he knows not to repeat it in a bar.
 *
 * §5 says `reviewed: false` must never render in production, and that still
 * holds: this keys off `verified`, which is a different claim. `reviewed` is
 * "has Krish read it", a private to-do. `verified` is "has anyone checked
 * these facts", which the reader has every right to know.
 *
 * The sensitive variant is louder because those entries touch charges,
 * investigations or suspensions, where being wrong harms a real person rather
 * than just misinforming a reader.
 */
export function UncheckedBadge({
  sensitive = false,
  full = false,
}: {
  sensitive?: boolean;
  full?: boolean;
}) {
  const Icon = sensitive ? AlertTriangle : Sparkles;
  const label = sensitive ? "Unverified" : "Not checked";

  if (full) {
    return (
      <p
        className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug ${
          sensitive
            ? "border-pencil/40 bg-pencil/10 text-fg"
            : "border-line bg-surface text-fg-dim"
        }`}
      >
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${sensitive ? "text-pencil" : "text-fg-dim"}`}
          aria-hidden
        />
        <span>
          <strong className="font-semibold text-fg">
            {sensitive ? "Unverified, and sensitive." : "Not checked yet."}
          </strong>{" "}
          {sensitive
            ? "Written automatically from a single news report, and it touches a legal or disciplinary matter. Read the reporting below before repeating any of it."
            : "Written automatically from a news report. Nobody has been through it against the sources yet."}
        </span>
      </p>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
        sensitive
          ? "border-pencil/50 text-pencil"
          : "border-line text-fg-dim"
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

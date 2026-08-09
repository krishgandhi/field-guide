import { GlossaryTerm } from "@/components/glossary-term";
import { findTerms } from "./terms";

/**
 * Auto-link glossary terms inside plain strings (§6a, extended).
 *
 * The rehype plugin only sees MDX. Move and team prose live in TypeScript, so
 * jargon there went unexplained — which is exactly where the first real flag
 * came from: "pass rusher", read on the Garrett move page, with no way to find
 * out what it meant. Content type shouldn't decide whether a word gets
 * explained.
 *
 * Create one explainer per page render and use it for every string on that
 * page. The shared `linked` set is what enforces §6a's "first occurrence per
 * page" across separate paragraphs — not per string, which would link the same
 * term in six consecutive rubric cards.
 */
export function createExplainer(currentSlug?: string) {
  const linked = new Set<string>();

  return function explain(text: string): React.ReactNode {
    const matches = findTerms(text, { linked, currentSlug });
    if (matches.length === 0) return text;

    const out: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of matches) {
      if (match.index > cursor) out.push(text.slice(cursor, match.index));
      out.push(
        <GlossaryTerm
          key={`${match.entry.slug}-${match.index}`}
          slug={match.entry.slug}
          title={match.entry.title}
          summary={match.entry.summary}
        >
          {match.text}
        </GlossaryTerm>,
      );
      cursor = match.index + match.text.length;
    }

    if (cursor < text.length) out.push(text.slice(cursor));
    return out;
  };
}

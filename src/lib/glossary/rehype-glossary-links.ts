import { visitParents, SKIP } from "unist-util-visit-parents";
import type { Root, Element, Text, ElementContent } from "hast";
import { findTerms } from "./terms";

/**
 * Rehype plugin: turn glossary terms in the rendered content into links (§6a).
 *
 * This runs on the HTML AST after markdown is parsed, in Node, at build time.
 * It's a plain JavaScript function — which is precisely why the MDX pipeline
 * compiles content itself instead of using @next/mdx. Under Turbopack (the
 * default in Next 16) @next/mdx can only accept plugins as strings with
 * serialisable options, because functions can't cross into Rust. Compiling in
 * Node means a plugin is just an import.
 */

/** §6a: skip matches inside headings, code, and existing links. */
const SKIP_INSIDE = new Set([
  "a",
  "code",
  "pre",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

export type Options = {
  /** The entry currently being rendered, so it never links to itself. */
  currentSlug?: string;
};

export function rehypeGlossaryLinks({ currentSlug }: Options = {}) {
  return (tree: Root) => {
    // One set per transform. unified runs the transformer once per document,
    // so "first occurrence per page" falls out of this naturally.
    const linked = new Set<string>();

    visitParents(tree, "text", (node: Text, ancestors) => {
      if (
        ancestors.some(
          (a) => a.type === "element" && SKIP_INSIDE.has((a as Element).tagName),
        )
      ) {
        return SKIP;
      }

      const matches = findTerms(node.value, { linked, currentSlug });
      if (matches.length === 0) return;

      const parent = ancestors[ancestors.length - 1] as Element | Root;
      const index = parent.children.indexOf(node as ElementContent);
      if (index === -1) return;

      const replacement: ElementContent[] = [];
      let cursor = 0;

      for (const match of matches) {
        if (match.index > cursor) {
          replacement.push({
            type: "text",
            value: node.value.slice(cursor, match.index),
          });
        }

        replacement.push({
          type: "element",
          tagName: "a",
          properties: {
            href: `/glossary/${match.entry.slug}`,
            // Picked up by the `a` override in mdx-content.tsx and swapped for
            // the interactive GlossaryTerm. Kept as a real anchor so the page
            // still works, and still navigates, without JavaScript.
            "data-glossary": match.entry.slug,
            "data-title": match.entry.title,
            "data-summary": match.entry.summary,
          },
          children: [{ type: "text", value: match.text }],
        });

        cursor = match.index + match.text.length;
      }

      if (cursor < node.value.length) {
        replacement.push({ type: "text", value: node.value.slice(cursor) });
      }

      parent.children.splice(index, 1, ...replacement);

      // Skip past what we just inserted — otherwise the walker descends into
      // the new nodes and reprocesses the text we already handled.
      return [SKIP, index + replacement.length];
    });
  };
}

import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { GlossaryTerm } from "@/components/glossary-term";
import { rehypeGlossaryLinks } from "@/lib/glossary/rehype-glossary-links";

/**
 * The one place MDX gets turned into JSX.
 *
 * Compilation happens here, in Node, at build time — not in the bundler. That
 * matters: Next 16 uses Turbopack by default, and @next/mdx can only take
 * remark/rehype plugins as strings with serialisable options, because JS
 * functions can't cross into Rust. Compiling ourselves means plugins are
 * ordinary imports, which is what the glossary auto-linker (§6a) will need.
 *
 * This component is also the seam for the two remaining Phase 1 mechanics: the
 * glossary rehype plugin goes in `mdxOptions.rehypePlugins`, and the flag-queue
 * text-selection wrapper goes around `components`.
 */

// Reading styles. This is the only long-form surface in the app, so it gets a
// larger size and looser leading than the dense card screens.
const components = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2 className="mb-2 mt-8 text-lg font-semibold text-fg" {...props} />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3 className="mb-1.5 mt-6 text-base font-semibold text-fg" {...props} />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="my-4 text-[1.05rem] leading-[1.7] text-fg/90" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul
      className="my-4 list-disc space-y-1.5 pl-5 text-[1.05rem] leading-[1.7] text-fg/90"
      {...props}
    />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol
      className="my-4 list-decimal space-y-1.5 pl-5 text-[1.05rem] leading-[1.7] text-fg/90"
      {...props}
    />
  ),
  // Anchors carrying data-glossary were injected by the rehype plugin, not
  // written by hand. They become the interactive term; everything else stays a
  // plain link.
  a: ({
    "data-glossary": slug,
    "data-title": title,
    "data-summary": summary,
    children,
    ...props
  }: React.ComponentProps<"a"> & {
    "data-glossary"?: string;
    "data-title"?: string;
    "data-summary"?: string;
  }) => {
    if (slug && title && summary) {
      return (
        <GlossaryTerm slug={slug} title={title} summary={summary}>
          {children}
        </GlossaryTerm>
      );
    }
    return (
      <a
        className="text-amber underline decoration-amber/40 underline-offset-2 hover:decoration-amber"
        {...props}
      >
        {children}
      </a>
    );
  },
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-fg" {...props} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-5 border-l-2 border-amber/60 pl-4 italic text-fg-dim"
      {...props}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr className="my-8 border-line" {...props} />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code
      className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.9em] text-fg"
      {...props}
    />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      className="my-5 overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm"
      {...props}
    />
  ),
  // Phone is the primary device, so wide tables scroll inside their own box
  // rather than pushing the page sideways.
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-line">
      <table className="tnum w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th
      className="border-b border-line bg-surface px-3 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-fg-dim"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td className="border-b border-line px-3 py-2 align-top text-fg/90" {...props} />
  ),
};

export function MdxContent({
  source,
  /** Slug of the entry being rendered, so it never links to itself (§6a). */
  currentSlug,
  /** Shared with createExplainer when a page has prose from both sources. */
  linked,
}: {
  source: string;
  currentSlug?: string;
  linked?: Set<string>;
}) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        mdxOptions: {
          // Tables and strikethrough. §7 and §8 are both tabular.
          remarkPlugins: [remarkGfm],
          // Tuple form, not rehypeGlossaryLinks({...}). unified treats a bare
          // function in this list as an attacher and calls it with no
          // arguments; passing [attacher, options] is how it gets them.
          rehypePlugins: [[rehypeGlossaryLinks, { currentSlug, linked }]],
        },
      }}
    />
  );
}

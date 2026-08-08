import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

/**
 * The one place MDX gets turned into JSX.
 *
 * Compilation happens here, in Node, at build time — not in the bundler.
 * That matters: Next 16 uses Turbopack by default, and @next/mdx can only
 * take remark/rehype plugins as strings with serialisable options, because
 * JS functions can't cross into Rust. Compiling ourselves means plugins are
 * ordinary imports, which is what the glossary auto-linker (§6a) will need.
 *
 * This component is also the seam for the two Phase 1 mechanics: the
 * glossary rehype plugin goes in `mdxOptions.rehypePlugins`, and the
 * flag-queue text selection wrapper goes around `components`.
 */

// Element overrides. Markdown renders to plain HTML tags, so styling the
// content means styling those tags. §10: display face for headings,
// Newsreader for prose, Plex Mono for anything tabular.
const components = {
  h2: (props: React.ComponentProps<"h2">) => (
    <h2
      className="font-display condensed mt-10 mb-3 text-xl font-semibold uppercase tracking-wide text-fg"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<"h3">) => (
    <h3
      className="font-display condensed mt-8 mb-2 text-lg font-semibold text-fg"
      {...props}
    />
  ),
  p: (props: React.ComponentProps<"p">) => (
    <p className="my-4 leading-relaxed" {...props} />
  ),
  ul: (props: React.ComponentProps<"ul">) => (
    <ul className="my-4 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: React.ComponentProps<"ol">) => (
    <ol className="my-4 list-decimal space-y-1 pl-5" {...props} />
  ),
  a: (props: React.ComponentProps<"a">) => (
    <a
      className="text-royal underline underline-offset-2 hover:text-pencil"
      {...props}
    />
  ),
  strong: (props: React.ComponentProps<"strong">) => (
    <strong className="font-semibold" {...props} />
  ),
  blockquote: (props: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="my-5 border-l-2 border-amber pl-4 italic text-fg/80"
      {...props}
    />
  ),
  hr: (props: React.ComponentProps<"hr">) => (
    <hr className="my-8 border-fg/15" {...props} />
  ),
  code: (props: React.ComponentProps<"code">) => (
    <code
      className="font-data rounded bg-fg/8 px-1 py-0.5 text-[0.9em]"
      {...props}
    />
  ),
  pre: (props: React.ComponentProps<"pre">) => (
    <pre
      className="font-data my-5 overflow-x-auto rounded bg-surface p-4 text-sm text-fg"
      {...props}
    />
  ),
  // Phone is the primary device, so wide tables scroll inside their own box
  // rather than pushing the page sideways.
  table: (props: React.ComponentProps<"table">) => (
    <div className="my-5 overflow-x-auto">
      <table className="font-data w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<"th">) => (
    <th
      className="border-b border-fg/30 px-2 py-1.5 text-left font-semibold uppercase tracking-wide"
      {...props}
    />
  ),
  td: (props: React.ComponentProps<"td">) => (
    <td className="border-b border-fg/15 px-2 py-1.5 align-top" {...props} />
  ),
};

export function MdxContent({ source }: { source: string }) {
  return (
    <MDXRemote
      source={source}
      components={components}
      options={{
        mdxOptions: {
          // Tables and strikethrough. §7 and §8 are both tabular.
          remarkPlugins: [remarkGfm],
          rehypePlugins: [],
        },
      }}
    />
  );
}

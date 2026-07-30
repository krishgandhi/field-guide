import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MdxContent } from "@/components/mdx-content";
import { getEntry, getSlugs } from "@/lib/content";

// Every glossary entry is a file in the repo, so the full set of routes is
// known at build time. Anything not in that set is a typo, not a page.
export const dynamicParams = false;

export function generateStaticParams() {
  return getSlugs("glossary").map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry("glossary", slug);
  if (!entry) return {};

  return {
    title: `${entry.frontmatter.title} — Field guide`,
    description: entry.frontmatter.summary,
  };
}

export default async function GlossaryEntryPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getEntry("glossary", slug);
  if (!entry) notFound();

  const { frontmatter, body } = entry;

  return (
    <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="font-data inline-flex min-h-11 items-center text-xs uppercase tracking-[0.2em] text-graphite/60 hover:text-pencil"
      >
        ← Field guide
      </Link>

      <header className="mt-2 border-b-2 border-graphite/80 pb-4">
        <h1 className="font-display condensed text-4xl font-semibold text-graphite sm:text-5xl">
          {frontmatter.title}
        </h1>
        <p className="mt-2 text-lg leading-snug text-graphite/80">
          {frontmatter.summary}
        </p>
      </header>

      <div className="mt-2">
        <MdxContent source={body} />
      </div>

      <footer className="font-data mt-12 flex flex-wrap gap-x-6 gap-y-1 border-t border-graphite/15 pt-3 text-xs uppercase tracking-wide text-graphite/50">
        <span>Glossary</span>
        <span>Updated {frontmatter.lastUpdated}</span>
      </footer>
    </article>
  );
}

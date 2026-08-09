import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MdxContent } from "@/components/mdx-content";
import { BackLink, PageShell } from "@/components/ui/page-header";
import { getEntry, getSlugs } from "@/lib/content";

// Every glossary entry is a file in the repo, so the full set of routes is
// known at build time. Anything not in that set is a typo, not a page.
export const dynamicParams = false;

export function generateStaticParams() {
  return getSlugs("glossary").map((slug) => ({ slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = getEntry("glossary", slug);
  if (!entry) return {};

  return {
    title: `${entry.frontmatter.title} — Field guide`,
    description: entry.frontmatter.summary,
  };
}

/**
 * A reading screen, not a data screen. Everything else in the app is dense and
 * card-based; this one gets generous leading and a narrower measure, because
 * the explanation is the product and it has to be comfortable to actually read.
 */
export default async function GlossaryEntryPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getEntry("glossary", slug);
  if (!entry) notFound();

  const { frontmatter, body } = entry;

  return (
    <PageShell>
      <BackLink href="/glossary" label="Glossary" />

      <article>
        <header>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight text-fg">
            {frontmatter.title}
          </h1>
          <p className="mt-2 text-[1.05rem] leading-snug text-amber">
            {frontmatter.summary}
          </p>
        </header>

        <div className="mt-5 border-t border-line pt-1">
          <MdxContent source={body} />
        </div>

        {frontmatter.aliases.length > 0 ? (
          <footer className="mt-8 border-t border-line pt-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-fg-dim">
              Also called
            </p>
            <p className="mt-1.5 text-sm text-fg-dim">
              {frontmatter.aliases.join(" · ")}
            </p>
          </footer>
        ) : null}
      </article>
    </PageShell>
  );
}

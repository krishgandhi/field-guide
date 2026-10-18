import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getAllEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Glossary — Field guide",
  description: "The words people use around football, in plain English.",
};

export default function GlossaryIndexPage() {
  // Reads frontmatter only — no MDX is compiled to build this list, so it
  // stays cheap however many entries there are.
  const entries = getAllEntries("glossary").sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <PageShell>
      <PageHeader kicker={`${entries.length} terms`} title="Glossary" />

      {entries.length === 0 ? (
        // §10: empty states are invitations, not apologies.
        <p className="mt-5 leading-relaxed text-chalk-dim">
          Nothing here yet. The first entries go in{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
            content/glossary/
          </code>
          .
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {entries.map((entry) => (
            <Link
              key={entry.slug}
              href={`/glossary/${entry.slug}`}
              className="block rounded-2xl border border-line bg-surface px-4 py-3.5 transition-colors hover:border-chalk/20"
            >
              <h2 className="text-base font-semibold text-chalk">{entry.title}</h2>
              <p className="mt-0.5 text-sm leading-snug text-chalk-dim">
                {entry.summary}
              </p>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}

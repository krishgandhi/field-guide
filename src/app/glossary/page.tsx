import type { Metadata } from "next";
import Link from "next/link";
import { getAllEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Glossary — Field guide",
  description: "The words people use around football, in plain English.",
};

export default function GlossaryIndexPage() {
  // Reads frontmatter only — no MDX gets compiled to build this list, so it
  // stays cheap however many entries there are.
  const entries = getAllEntries("glossary").sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <Link
        href="/"
        className="font-data inline-flex min-h-11 items-center text-xs uppercase tracking-[0.2em] text-graphite/60 hover:text-pencil"
      >
        ← Field guide
      </Link>

      <header className="mt-2 border-b-2 border-graphite/80 pb-4">
        <h1 className="font-display condensed text-4xl font-semibold text-graphite sm:text-5xl">
          Glossary
        </h1>
        <p className="font-data mt-2 text-xs uppercase tracking-[0.2em] text-graphite/60">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </p>
      </header>

      {entries.length === 0 ? (
        // §10: empty states are invitations, not apologies.
        <p className="mt-8 text-lg leading-relaxed">
          Nothing here yet. The first entries go in{" "}
          <code className="font-data text-[0.9em]">content/glossary/</code>.
        </p>
      ) : (
        <ul className="mt-2">
          {entries.map((entry) => (
            <li key={entry.slug} className="border-b border-graphite/15">
              <Link
                href={`/glossary/${entry.slug}`}
                className="block py-4 hover:text-pencil"
              >
                <span className="font-display condensed text-xl font-semibold">
                  {entry.title}
                </span>
                <span className="mt-0.5 block leading-snug text-graphite/75">
                  {entry.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

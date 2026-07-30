import Link from "next/link";
import { getAllEntries } from "@/lib/content";

export default function Home() {
  const glossaryCount = getAllEntries("glossary").length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-turf px-5 py-4 text-chalk sm:px-8">
        <p className="font-data text-xs uppercase tracking-[0.2em] text-chalk/70">
          Field guide
        </p>
        <h1 className="font-display condensed mt-1 text-3xl font-semibold sm:text-4xl">
          The NFL, explained sideways
        </h1>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-lg leading-relaxed">
          Not scores, not stats. Why a game matters, why a trade was a big deal,
          and what a position is actually for.
        </p>

        <nav className="mt-10 border-t border-graphite/15">
          <Link
            href="/glossary"
            className="flex min-h-11 items-center justify-between gap-4 border-b border-graphite/15 py-4 hover:text-pencil"
          >
            <span className="font-display condensed text-xl font-semibold">
              Glossary
            </span>
            <span className="font-data text-xs uppercase tracking-wide text-graphite/60">
              {glossaryCount} {glossaryCount === 1 ? "entry" : "entries"}
            </span>
          </Link>
        </nav>
      </main>
    </div>
  );
}

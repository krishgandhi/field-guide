import Link from "next/link";

// Placeholder home page. It exists so the design tokens are visible on screen
// and the one live content route is reachable. The real index arrives with the
// content in Phase 1.
export default function Home() {
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

        <h2 className="font-display condensed mt-10 text-xl font-semibold uppercase tracking-wide">
          Glossary
        </h2>
        <ul className="mt-3 border-t border-graphite/15">
          <li className="border-b border-graphite/15">
            <Link
              href="/glossary/dead-money"
              className="flex min-h-11 items-center justify-between gap-4 py-3 hover:text-pencil"
            >
              <span>Dead money</span>
              <span className="font-data text-xs text-graphite/60">
                glossary
              </span>
            </Link>
          </li>
        </ul>
      </main>
    </div>
  );
}

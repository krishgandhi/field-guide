"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Bottom tab bar.
 *
 * Bottom rather than top because §10 says the phone is the primary device — he
 * reads this on transit and in bars, one-handed, so navigation belongs at thumb
 * height. This is a client component only because it needs usePathname to know
 * which tab is active.
 *
 * Tap targets are 56px tall, comfortably over §10's 44px floor, and the bar
 * pads for the iPhone home indicator via safe-area insets.
 */

const TABS = [
  { href: "/", label: "This week" },
  { href: "/games", label: "Games" },
  { href: "/moves", label: "Moves" },
  { href: "/teams", label: "Teams" },
  { href: "/glossary", label: "Glossary" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t-2 border-graphite/80 bg-turf"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`font-display condensed flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-[0.7rem] uppercase leading-tight tracking-wide transition-colors ${
                  active
                    ? "text-chalk"
                    : "text-chalk/55 hover:text-chalk/80"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-[3px] w-6 ${active ? "bg-amber" : "bg-transparent"}`}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

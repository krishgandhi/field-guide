"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isActive } from "@/components/nav/tabs";
import { FlagCountButton } from "@/components/flag/flag-count-button";

/**
 * The same five tabs as a left rail, from `lg` up.
 *
 * A bottom bar stretched across a laptop reads as a phone app blown up, and a
 * top bar would move navigation somewhere the phone version never puts it. A
 * rail keeps the tab-bar grammar — icon in a pill, the yellow line marking
 * where you are, now on the left edge — while the content stays a readable
 * single column beside it.
 */
export function DesktopRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-night px-4 py-8 lg:flex"
    >
      <Link href="/" className="mb-8 block px-3">
        <span className="heading block text-[34px] uppercase leading-[0.85] text-chalk">
          Field
          <br />
          guide
        </span>
        <span aria-hidden className="mt-2.5 block h-1.5 w-16 rounded-sm bg-yellow" />
      </Link>

      <ul className="flex flex-col gap-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="relative">
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-y-[22%] -left-4 w-[3px] rounded-r-[3px] bg-yellow"
                />
              ) : null}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-full px-3 text-[15px] font-semibold transition-colors duration-[120ms] ${
                  active
                    ? "bg-surface-2 text-chalk"
                    : "text-chalk-dim hover:bg-surface hover:text-chalk"
                }`}
              >
                <Icon size={21} strokeWidth={2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex items-center gap-3 px-1">
        <FlagCountButton />
        <span className="text-[13px] leading-snug text-chalk-dim">
          Phrases you flagged
        </span>
      </div>
    </nav>
  );
}

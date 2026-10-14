"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Repeat2, Shield, Tv } from "lucide-react";

/**
 * Bottom tab bar.
 *
 * Bottom rather than top because §10 makes the phone the primary device — he
 * reads this on transit and in bars, one-handed, so navigation sits at thumb
 * height. Client component solely for usePathname.
 *
 * Icons because "more intuitive" was an explicit ask: at a glance a shield and
 * a TV separate faster than two words in the same weight and size.
 *
 * Tap targets are 56px tall against §10's 44px floor, and the bar pads for the
 * iPhone home indicator with safe-area insets.
 */

const TABS = [
  { href: "/", label: "This week", Icon: CalendarDays },
  { href: "/games", label: "Games", Icon: Tv },
  { href: "/moves", label: "Moves", Icon: Repeat2 },
  { href: "/teams", label: "Teams", Icon: Shield },
  { href: "/glossary", label: "Glossary", Icon: BookOpen },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-40 border-t border-line bg-night/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-[0.65rem] font-medium leading-none transition-colors ${
                  active ? "text-yellow" : "text-chalk-dim hover:text-chalk"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

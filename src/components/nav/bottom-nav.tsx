"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TABS, isActive } from "@/components/nav/tabs";

/**
 * The phone tab bar (§10).
 *
 * Bottom because the phone is the primary device — he reads this on transit
 * and in bars, one-handed, so navigation sits at thumb height. The active tab
 * gets a pill behind its icon and a short yellow line along the bar's top
 * edge, the first-down line marking where you are.
 *
 * Fixed rather than sticky so it never strands mid-page; the layout pads the
 * page by the bar's height. Every cell is the full bar height (well over the
 * 44px floor), and the bar pads for the iPhone home indicator.
 *
 * Hidden from `lg` up, where DesktopRail takes over.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
    >
      <ul className="mx-auto grid h-16 w-full max-w-2xl grid-cols-5 px-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href, pathname);
          return (
            <li key={href} className="relative">
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-[22%] -top-px h-[3px] rounded-b-[3px] bg-yellow"
                />
              ) : null}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11.5px] font-semibold leading-none transition-colors duration-[120ms] ${
                  active ? "text-chalk" : "text-chalk-dim hover:text-chalk"
                }`}
              >
                <span
                  className={`grid h-[30px] w-[52px] place-items-center rounded-full transition-colors duration-[120ms] ${
                    active ? "bg-surface-2" : ""
                  }`}
                >
                  <Icon size={21} strokeWidth={2} aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

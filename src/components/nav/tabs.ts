import { BookOpen, CalendarDays, Repeat2, Shield, Tv } from "lucide-react";

/** The five tabs, shared by the phone bar and the desktop rail. */
export const TABS = [
  { href: "/", label: "This week", Icon: CalendarDays },
  { href: "/games", label: "Games", Icon: Tv },
  { href: "/moves", label: "Moves", Icon: Repeat2 },
  { href: "/teams", label: "Teams", Icon: Shield },
  { href: "/glossary", label: "Glossary", Icon: BookOpen },
] as const;

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

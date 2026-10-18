import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import { BottomNav } from "@/components/nav/bottom-nav";
import { DesktopRail } from "@/components/nav/desktop-rail";
import { FlagSelection } from "@/components/flag/flag-selection";
import "./globals.css";

// Two families (§10). Big Shoulders is scoreboard lettering for titles and
// numerals. next/font has no "Big Shoulders Display" any more — the family is
// now one variable font whose optical-size axis (10–72) picks the display cut
// automatically at large sizes, which is what the proposal's titles use.
// Archivo carries UI and reading, and its width axis (62–125) is loaded too so
// the condensed `label` utility uses the real narrow drawing rather than a
// browser-squashed one. Both are self-hosted by next/font at build time.
//
// The build prints "Failed to find font override values for Big Shoulders".
// Harmless: next/font has no metrics for this face, so it skips building a
// size-matched fallback. Display text is short, so the swap shift is small.
const bigShoulders = Big_Shoulders({
  variable: "--font-big-shoulders",
  subsets: ["latin"],
  axes: ["opsz"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Field guide",
  description:
    "Why the NFL does what it does, explained without assuming you already know.",
};

// Paints the browser chrome and the iOS status bar to match the app, so a
// home-screen launch doesn't flash a white bar above a black page.
export const viewport: Viewport = {
  themeColor: "#0B100E",
  colorScheme: "dark",
  // Lets the page draw under the iPhone home indicator; the tab bar pads
  // itself back out with env(safe-area-inset-bottom).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bigShoulders.variable} ${archivo.variable} h-full`}>
      {/* The bottom padding keeps content clear of the fixed phone tab bar
          (64px plus its home-indicator inset); from lg the rail sits on the
          left instead. */}
      <body className="flex min-h-full flex-col pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60">
        {children}
        <FlagSelection />
        <BottomNav />
        <DesktopRail />
      </body>
    </html>
  );
}

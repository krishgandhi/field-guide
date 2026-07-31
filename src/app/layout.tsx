import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { BottomNav } from "@/components/nav/bottom-nav";
import "./globals.css";

// Display face. CLAUDE.md §10 asks for "Archivo Condensed", which is not a
// family on Google Fonts — Archivo is a single variable font with a width axis
// (wdth, 62–125). We load that axis and condense with `font-stretch` via the
// `condensed` utility in globals.css.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Body face. Long explanations are the whole product, so this is the one that
// has to be comfortable to read.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

// Data face. Anything tabular: spreads, records, dates.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Field guide",
  description: "Why the NFL does what it does, explained without assuming you already know.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}

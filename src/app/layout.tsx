import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BottomNav } from "@/components/nav/bottom-nav";
import "./globals.css";

// One family for everything — UI, data and long reads. A single modern sans is
// most of what separates "app" from "document", which was the problem with the
// previous three-face call-sheet treatment.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Field guide",
  description:
    "Why the NFL does what it does, explained without assuming you already know.",
};

// Paints the browser chrome and the iOS status bar to match the app, so a
// home-screen launch doesn't flash a white bar above a black page.
export const viewport: Viewport = {
  themeColor: "#0A0C0B",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}

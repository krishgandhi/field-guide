import type { MetadataRoute } from "next";

/**
 * PWA manifest — what the phone reads when you "Add to Home Screen".
 *
 * `standalone` display is the bit that matters: opened from the home screen
 * the site fills the screen with no browser address bar, so it reads like an
 * app rather than a bookmark. Colours are the §10 tokens so the splash screen
 * and status bar match the site instead of flashing white first.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Field guide",
    short_name: "Field guide",
    description:
      "Why the NFL does what it does, explained without assuming you already know.",
    start_url: "/",
    display: "standalone",
    background_color: "#E6E5DF", // chalk
    theme_color: "#1B3A2F", // turf
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      // Maskable lets Android crop to whatever shape the launcher uses
      // without slicing the letters off.
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

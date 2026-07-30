import { ImageResponse } from "next/og";

// 180x180 is the size iOS asks for on modern devices.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Separate from icon.tsx because iOS ignores the manifest's icon list and looks
 * for an apple-touch-icon instead. Without this file, adding the site to an
 * iPhone home screen gives you a blurry screenshot of the page.
 *
 * iOS rounds the corners itself and adds no padding of its own, so this can run
 * closer to the edge than the maskable Android version.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B3A2F", // turf
          color: "#E6E5DF", // chalk
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        FG
      </div>
    ),
    size,
  );
}

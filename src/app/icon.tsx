import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/**
 * App icon, generated at build time rather than committed as a PNG.
 *
 * Deliberately kept to a flat colour and two letters: this renders at 48px on
 * a home screen, where anything more detailed turns to mush. The letters sit
 * well inside the canvas because Android "maskable" icons get cropped to
 * whatever shape the launcher uses, and edge-to-edge artwork loses its corners.
 */
export default function Icon() {
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
          fontSize: 240,
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

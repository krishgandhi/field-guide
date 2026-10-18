/**
 * Team colours that stay legible on this site's dark grounds (§10).
 *
 * Split out of fetch-teams.mjs so the colours can be recomputed without
 * re-downloading 32 logos, and so the contrast rule has a test.
 *
 * Team colour sits on the page ground (night) AND on cards (surface), which is
 * a step lighter and therefore the harder of the two to clear. A colour is
 * lifted until it clears 4.5:1 on both.
 */

/** Must match --color-night and --color-surface in src/app/globals.css. */
export const BACKGROUNDS = { night: "#0B100E", surface: "#141B18" };
export const MIN_CONTRAST = 4.5;

const hex2rgb = (h) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};

const luminance = (hex) => {
  const [r, g, b] = hex2rgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.x contrast ratio between two hex colours. */
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** The worse of the two ratios — the one that decides legibility. */
export const worstContrast = (hex) =>
  Math.min(...Object.values(BACKGROUNDS).map((bg) => contrast(hex, bg)));

function rgb2hsl(hex) {
  const [r, g, b] = hex2rgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0))
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hsl2hex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Lift lightness in 1% steps until the colour clears MIN_CONTRAST on both grounds. */
function lift(hex) {
  if (worstContrast(hex) >= MIN_CONTRAST) return hex;
  const [h, s] = rgb2hsl(hex);
  for (let l = 0.3; l <= 0.95; l += 0.01) {
    const candidate = hsl2hex(h, s, l);
    if (worstContrast(candidate) >= MIN_CONTRAST) return candidate;
  }
  return "#FFFFFF"; // unreachable in practice; a visible fallback beats an invisible one
}

const isAchromatic = (hex) => rgb2hsl(hex)[1] < 0.15;

/**
 * Pick the colour to actually render, then make it legible.
 *
 * Teams whose primary is black — Steelers, Raiders — can't be lifted usefully:
 * lightening black only ever yields grey, which is nobody's team colour. For
 * those we fall back to ESPN's alternateColor, which is the gold and the silver
 * people actually associate with them.
 */
export function toDisplayColor(brand, alternate) {
  const base =
    isAchromatic(brand) && alternate && !isAchromatic(alternate)
      ? alternate
      : brand;
  return lift(base).toUpperCase();
}

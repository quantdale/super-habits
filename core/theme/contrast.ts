/** WCAG 2.1 relative luminance / contrast ratio math. Mirrors scripts/validate-theme-contrast.mjs. */

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_NON_TEXT = 3;

function isHex(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color);
}

/** Blend `hex` toward black by `amount` (0..1); non-hex inputs pass through. */
export function darken(hex: string, amount: number): string {
  if (!isHex(hex)) return hex;
  const channel = (offset: number) =>
    Math.max(0, Math.round(Number.parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/** Blend `hex` toward white by `amount` (0..1); non-hex inputs pass through. */
export function lighten(hex: string, amount: number): string {
  if (!isHex(hex)) return hex;
  const channel = (offset: number) => {
    const v = Number.parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(v + (255 - v) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * Composite `overlay` at `alpha` over `base` and return a hex colour. Used to
 * resolve the effective surface behind a tinted card before checking contrast.
 */
export function tintOver(base: string, overlay: string, alpha: number): string {
  if (!isHex(base) || !isHex(overlay)) return base;
  const mix = (offset: number) => {
    const b = Number.parseInt(base.slice(offset, offset + 2), 16);
    const o = Number.parseInt(overlay.slice(offset, offset + 2), 16);
    return Math.round(b * (1 - alpha) + o * alpha)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

/**
 * Nudge `background` away from `text` until the pair clears `min`. Used where a
 * saturated accent paints a surface that carries fixed text: a light text on a
 * mid-tone section hue measures ~2.5:1 (WCAG AA needs 4.5), so the surface is
 * deepened while keeping the hue. Hex-only; anything else passes through.
 */
export function readableSurface(background: string, text: string, min = WCAG_AA_TEXT): string {
  if (!isHex(background) || !isHex(text)) return background;
  let out = background;
  const textIsLighter = luminance(text) > luminance(out);
  for (let i = 0; i < 16 && contrastRatio(text, out) < min; i++) {
    out = textIsLighter ? darken(out, 0.12) : lighten(out, 0.12);
  }
  return out;
}

/**
 * Nudge `accent` toward a readable *text* colour against `background`. Used
 * where an accent must be painted as text (metric values, links) on a tinted
 * or neutral surface.
 */
export function readableAccent(accent: string, background: string, min = WCAG_AA_TEXT): string {
  if (!isHex(accent) || !isHex(background)) return accent;
  let out = accent;
  const backgroundIsLighter = luminance(background) > luminance(out);
  for (let i = 0; i < 16 && contrastRatio(out, background) < min; i++) {
    out = backgroundIsLighter ? darken(out, 0.12) : lighten(out, 0.12);
  }
  return out;
}

// Shared rendered accessibility audit for the ordinary and dummy-host lanes.
export const auditPage = () => {
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ) => {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const over = (
    fg: { r: number; g: number; b: number; a: number },
    bg: { r: number; g: number; b: number; a: number },
  ) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };
  const backgroundOf = (el: Element) => {
    let cur: Element | null = el;
    let acc: { r: number; g: number; b: number; a: number } | null = null;
    while (cur && cur !== document.documentElement) {
      const cs2 = getComputedStyle(cur);
      // Gradient-backed surfaces paint with `background-image`; use the first
      // stop so gradient hero/button faces are measured, not skipped.
      const img = cs2.backgroundImage;
      if (img && img !== 'none') {
        const gm = img.match(/rgba?\([^)]+\)/);
        const gc = gm ? parse(gm[0]) : null;
        if (gc) {
          const opaque = { r: gc.r, g: gc.g, b: gc.b, a: 1 };
          acc = acc ? over(acc, opaque) : opaque;
          return acc;
        }
      }
      const c = parse(cs2.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (c.a === 1) return acc;
      }
      cur = cur.parentElement;
    }
    const root = parse(getComputedStyle(document.body).backgroundColor) ?? {
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    };
    return acc ? over(acc, root) : root;
  };

  const contrast: string[] = [];
  const nameless: string[] = [];
  const duplicateIds: string[] = [];
  const hiddenFocusable: string[] = [];
  const seen = new Set<string>();

  for (const el of Array.from(document.querySelectorAll('*'))) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const isIconGlyph = /material/i.test(cs.fontFamily);
    const inTabControl = !!el.closest('[role="tab"], [role="tablist"]');
    // Gradient-faced buttons paint the face with an absolutely-positioned
    // sibling layer, so ancestor resolution would measure the 3D lip instead.
    // The theme validator owns buttonText-vs-button/hover/active pairs.
    const inGradientButton = !!el
      .closest('[role="button"]')
      ?.querySelector('[style*="linear-gradient"]');

    if (el.children.length === 0 && !isIconGlyph && !inTabControl && !inGradientButton) {
      const text = (el.textContent ?? '').trim();
      if (text) {
        const isSvgText = (el as SVGElement).ownerSVGElement != null;
        const fg = parse(isSvgText ? cs.fill : cs.color);
        if (fg && !(isSvgText && cs.fill === 'none')) {
          const bg = backgroundOf(el);
          const composed = fg.a < 1 ? over(fg, bg) : fg;
          const cr = ratio(composed, bg);
          const fontSize = parseFloat(cs.fontSize);
          const weight = parseInt(cs.fontWeight, 10) || 400;
          const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
          const min = large ? 3 : 4.5;
          if (cr < min - 0.01) {
            const key = `${text.slice(0, 24)}:${cs.color}`;
            if (!seen.has(key)) {
              seen.add(key);
              const bgText = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`;
              contrast.push(
                `${text.slice(0, 28)} ${cr.toFixed(2)}:1 (needs ${min}) at ${Math.round(fontSize)}px ${cs.color} on ${bgText}`,
              );
            }
          }
        }
      }
    }

    const role = el.getAttribute('role');
    const tag = el.tagName;
    const interactive =
      role === 'button' ||
      role === 'link' ||
      role === 'tab' ||
      role === 'checkbox' ||
      role === 'switch' ||
      tag === 'BUTTON' ||
      tag === 'A' ||
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA';
    if (interactive) {
      const name = (
        el.getAttribute('aria-label') ??
        el.getAttribute('aria-labelledby') ??
        el.getAttribute('title') ??
        el.getAttribute('placeholder') ??
        el.textContent ??
        ''
      ).trim();
      if (!name) {
        const key = `${tag}:${role}`;
        if (!seen.has(key)) {
          seen.add(key);
          nameless.push(`${tag}[${role ?? ''}]`);
        }
      }
    }

    if (el.getAttribute('aria-hidden') === 'true') {
      const focusable = el.querySelector<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable && !el.closest('[inert]')) {
        focusable.focus();
        if (document.activeElement === focusable) {
          hiddenFocusable.push(
            `${focusable.tagName}:${(focusable.getAttribute('aria-label') ?? '').slice(0, 40)}`,
          );
        }
      }
    }
  }

  const counts: Record<string, number> = {};
  for (const el of Array.from(document.querySelectorAll('[id]'))) {
    counts[el.id] = (counts[el.id] ?? 0) + 1;
    if (counts[el.id] === 2) duplicateIds.push(el.id);
  }

  return { contrast, nameless, duplicateIds, hiddenFocusable };
};

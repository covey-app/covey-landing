/*
 * Social platform glyphs. Lucide (lib/icons.ts) dropped brand icons, so these
 * come from Tabler Icons (MIT, https://tabler.io/icons), which shares Lucide's
 * 24px grid and 2px round stroke, so they sit beside Lucide glyphs without
 * looking borrowed. Full <svg> strings so icons.ts can register them like any
 * other raw import.
 */
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;

export const BRAND_GLYPHS = {
  instagram: svg(
    `<path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z"/><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/><path d="M16.5 7.5v.01"/>`,
  ),
  tiktok: svg(
    `<path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917z"/>`,
  ),
  x: svg(`<path d="M4 4l11.733 16h4.267l-11.733 -16z"/><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"/>`),
  linkedin: svg(
    `<path d="M8 11v5"/><path d="M8 8v.01"/><path d="M12 16v-5"/><path d="M16 16v-3a2 2 0 1 0 -4 0"/><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z"/>`,
  ),
} as const;

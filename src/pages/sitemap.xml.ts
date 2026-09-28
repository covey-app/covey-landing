/*
 * /sitemap.xml — robots.txt has always advertised it; it used to 404.
 * Built from the page files at build time, minus utility routes.
 */
import type { APIRoute } from "astro";
import { SITE } from "../config";

const EXCLUDE = new Set(["/404", "/thanks", "/signup", "/waitlist"]);

export const GET: APIRoute = () => {
  const pages = Object.keys(import.meta.glob("./**/*.astro"))
    .map((f) => f.replace(/^\.\//, "/").replace(/\.astro$/, "").replace(/\/index$/, "/"))
    .map((p) => (p === "/index" ? "/" : p))
    .filter((p) => !EXCLUDE.has(p) && !p.includes("["))
    // Trailing slash, to match the canonical tags (Astro.url.pathname in the
    // static build ends in "/"; Vercel serves both forms with a 200).
    .map((p) => (p.endsWith("/") ? p : `${p}/`))
    .sort();
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages.map((p) => `  <url><loc>${new URL(p, SITE.url).href}</loc></url>`).join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};

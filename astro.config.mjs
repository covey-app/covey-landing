import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://coveyapp.co",
  // Astro's default HTML compression collapses the whitespace-only text node
  // between a word and an inline element, so prose like
  // `email <a>support@coveyapp.co</a> if ...` shipped as
  // `emailsupport@coveyapp.coif ...` — one unbreakable token that both reads
  // wrong and blows the no-horizontal-overflow budget at 320px. Every page with
  // an inline link in a sentence was affected. The gzip cost of keeping the
  // whitespace is negligible; the alternative is a `{" "}` around every inline
  // anchor on the site.
  compressHTML: false,
  vite: {
    plugins: [tailwindcss()],
  },
});

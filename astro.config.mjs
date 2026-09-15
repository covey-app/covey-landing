import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sentry from "@sentry/astro";

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
  // Client config lives in sentry.client.config.ts, which this integration
  // picks up by convention. There is no server config: the site is static, so
  // there is no server to instrument.
  //
  // sourceMapsUploadOptions is intentionally absent. It needs a SENTRY_AUTH_TOKEN
  // and would fail the build on any machine without one, including a fresh
  // clone. Wire it in CI, where the token exists, rather than here.
  integrations: [
    sentry({
      // The bundler plugin phones home to Sentry with build telemetry by
      // default, on every build, including local ones. Nothing here needs
      // that, and an outbound data flow nobody asked for is not something to
      // leave on by default.
      telemetry: false,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    define: {
      // Tree-shake the SDK down to error reporting. This site ships ~16KB of
      // JS in total and exists to convert visitors; the tracing and profiling
      // code is dead weight on a static page with two forms. These flags are
      // what make the difference between "Sentry" and "Sentry, errors only" in
      // the shipped bundle — dropping them silently adds tens of KB back.
      __SENTRY_TRACING__: "false",
      __SENTRY_DEBUG__: "false",
      __RRWEB_EXCLUDE_IFRAME__: "true",
      __RRWEB_EXCLUDE_SHADOW_DOM__: "true",
      __SENTRY_EXCLUDE_REPLAY_WORKER__: "true",
    },
  },
});

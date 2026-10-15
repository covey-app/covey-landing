import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sentry from "@sentry/astro";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  site: "https://www.coveyapp.co",
  // Pages stay static (output defaults to "static"). The adapter exists for one
  // route, /api/waitlist (`prerender = false`), which becomes a Vercel Function.
  adapter: vercel(),
  // Astro's checkOrigin refuses every cross-site *and origin-less* form POST.
  // Mail providers send RFC 8058 one-click unsubscribes origin-less, so it
  // would break /newsletter/unsubscribe. The signup endpoints enforce origin
  // themselves (isCrossSiteForm in src/lib/waitlist/handler.ts); the confirm
  // and unsubscribe pages act only on an unguessable token.
  security: { checkOrigin: false },
  // Server-only secrets, read at request time — never inlined into the bundle
  // and never exposed to the browser. Optional so a fresh clone still builds;
  // the endpoint answers 503 "not_configured" until they're set.
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      RESEND_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      WAITLIST_EMAIL_FROM: envField.string({ context: "server", access: "secret", optional: true }),
      NEWSLETTER_EMAIL_FROM: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
  // Astro's default HTML compression collapses the whitespace-only text node
  // between a word and an inline element, so prose like
  // `email <a>support@coveyapp.co</a> if ...` shipped as
  // `emailsupport@coveyapp.coif ...` — one unbreakable token that both reads
  // wrong and blows the no-horizontal-overflow budget at 320px. Every page with
  // an inline link in a sentence was affected. The gzip cost of keeping the
  // whitespace is negligible; the alternative is a `{" "}` around every inline
  // anchor on the site.
  compressHTML: false,
  // Inline every stylesheet into the page. Most visits are a single landing
  // page, so a separate render-blocking CSS request (a full round trip before
  // first paint) costs more than the cross-page caching it buys. Measured in
  // docs/landing-audit-2026-09-26.md §9.
  build: {
    inlineStylesheets: "always",
  },
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

// Browser-side Sentry for the landing site. @sentry/astro picks this file up
// by convention and injects it into every page.
//
// This site ships ~16KB of JavaScript in total — one Astro ClientRouter script
// and nothing else — and its entire job is conversion. So the configuration
// here is deliberately the smallest thing that still answers "is the signup
// form broken for anyone?":
//
//   • errors only, no performance tracing (astro.config.mjs tree-shakes the
//     tracing code out of the bundle entirely, see __SENTRY_TRACING__),
//   • no Session Replay, for the same reason as the other two surfaces,
//   • no integrations beyond the defaults.
//
// If this ever needs tracing, flip the define in astro.config.mjs as well, or
// the sample rate will be set on code that was compiled away.

import * as Sentry from "@sentry/astro";

import { SHARED_SENTRY_OPTIONS } from "./src/lib/sentry-scrub";

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

// No DSN is the normal state of a fresh clone and of CI. Sentry.init with an
// empty DSN is already a no-op, but skipping the call keeps the intent legible
// and matches the other two repos.
if (dsn) {
  Sentry.init({
    ...SHARED_SENTRY_OPTIONS,
    dsn,
    environment: import.meta.env.PUBLIC_SENTRY_ENVIRONMENT ?? "production",
    release: import.meta.env.PUBLIC_SENTRY_RELEASE,
    // Errors only. See the note above before changing this.
    tracesSampleRate: 0,
  });
}

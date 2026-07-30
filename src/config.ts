/**
 * Single source of truth for cross-repo links and contact details.
 * Update these once real values exist instead of hunting through pages.
 */
export const SITE = {
  name: "Covey",
  tagline: "Anything, anytime, together.",
  domain: "coveyapp.co",
  url: "https://coveyapp.co",

  // Flip `appIsLive` to true once go.coveyapp.co is deployed and verified —
  // every link below stays inert (unrendered) until then. `/` itself is
  // intentionally never linked to: it's owned by the signed-in app in
  // covey-web's router and 404s for a signed-out visitor, the same reason
  // covey-web's own gated screens live under `/members/*` rather than
  // reusing signed-in paths. Always link to a real, ungated route instead.
  appUrl: "https://go.coveyapp.co",
  signInUrl: "https://go.coveyapp.co/login",
  browseUrl: "https://go.coveyapp.co/explore",
  appIsLive: true,

  // Launch is invite-only on iOS first (see docs/launch/decision-matrix.md
  // in the covey-ios repo) — no public App Store link yet. Once approved,
  // set this and flip the Signup page over to the badge.
  appStoreUrl: null as string | null,
  playStoreUrl: null as string | null,

  city: "San Francisco, CA",
  launchRegion: "US only, invite-only, iOS first",

  emails: {
    hello: "hello@coveyapp.co",
    press: "press@coveyapp.co",
    support: "support@coveyapp.co",
    safety: "safety@coveyapp.co",
  },

  social: {
    instagram: "https://instagram.com/coveyapp",
  },
} as const;

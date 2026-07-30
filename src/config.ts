/**
 * Single source of truth for cross-repo links and contact details.
 * Update these once real values exist instead of hunting through pages.
 */
export const SITE = {
  name: "Covey",
  tagline: "Anything, anytime, together.",
  domain: "coveyapp.co",
  url: "https://coveyapp.co",

  // The Expo app (separate covey-web repo) is the only thing on
  // `app.coveyapp.co`; everything on the apex domain — including the waitlist
  // at /signup — lives in this Astro site and must never be duplicated in the
  // Expo tree.
  //
  // `appIsLive` is the single switch for cross-linking into the product: flip
  // it to true once the Expo static export is deployed and the header/footer
  // "Browse plans" / "Sign in" links appear.
  appUrl: "https://app.coveyapp.co",

  // Published plans are readable without an account (see
  // docs/web-public-access.md in covey-web), so this is where marketing
  // traffic that isn't ready to hand over an email should land.
  browseUrl: "https://app.coveyapp.co/explore",
  // convenience explicit sign-in route for direct login links
  signInUrl: "https://app.coveyapp.co/login",
  appIsLive: false,


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

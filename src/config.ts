/**
 * Single source of truth for cross-repo links and contact details.
 * Update these once real values exist instead of hunting through pages.
 */
export const SITE = {
  name: "Covey",
  tagline: "Make a plan. Open a few spots. Meet people through it.",
  domain: "coveyapp.co",
  url: "https://coveyapp.co",

  // TODO: confirm the live URL for the covey-web app once it's deployed,
  // then flip `appIsLive` to true so header/footer nav links to it.
  appUrl: "https://app.coveyapp.co",
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

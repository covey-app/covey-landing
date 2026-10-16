/**
 * Single source of truth for cross-repo links and contact details.
 * Update these once real values exist instead of hunting through pages.
 */
export const SITE = {
  name: "Covey",
  tagline: "Turn strangers into friends, one plan at a time.",
  domain: "coveyapp.co",
  // Canonical origin. The apex (coveyapp.co) 308-redirects here on Vercel, so
  // canonical/og URLs and the sitemap use www to avoid pointing at a redirect.
  url: "https://www.coveyapp.co",

  // The product (the separate covey-web repo, Expo static export) is live on
  // `go.coveyapp.co`; everything on the apex domain lives in this Astro site
  // and must never be duplicated in the Expo tree.
  appUrl: "https://go.coveyapp.co",

  // Pre-launch, every primary CTA is "Join the waitlist" (product decision,
  // 2026-10-14). The form lives on the home page (#waitlist) and on its own
  // page here; /signup forwards to it, which is where covey-web's "Join the
  // waitlist" links already point. go.coveyapp.co stays up and untouched.
  waitlistPath: "/waitlist",
  // Existing members ("Sign in" in the header, mobile menu, and footer).
  signInUrl: "https://go.coveyapp.co/login",

  // Published plans are readable without an account (the anon preview RPCs in
  // covey-web). Linked from the footer only: the public feed is often empty
  // this early, and an empty feed is a poor first impression from the hero.
  browseUrl: "https://go.coveyapp.co/explore",

  // Launch is invite-only on iOS (LaunchPolicy.accessModel in covey-ios) — no
  // public App Store link yet. Once approved, set this and add the badge beside
  // the primary CTA in JoinCTA.astro and the hero.
  appStoreUrl: null as string | null,

  city: "San Francisco, CA",
  launchRegion: "US only, 18+, starting in San Francisco",

  // Only addresses with a real inbox behind them. General questions and
  // email replies go to support@; press and partnerships to socials@.
  emails: {
    support: "support@coveyapp.co",
    safety: "safety@coveyapp.co",
    privacy: "privacy@coveyapp.co",
    socials: "socials@coveyapp.co",
    admin: "admin@coveyapp.co",
  },

  social: {
    instagram: "https://www.instagram.com/covey.hq/",
  },
} as const;

export const CITY_SHORT = SITE.city.split(",")[0];

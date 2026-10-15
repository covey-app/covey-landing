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

  // The iPhone app is public (no invite gate) and listed on the App Store as
  // `appStoreName`. Leave `appStoreUrl` null until Apple approves the build and
  // the listing is live: while it is null every page says the app is "coming
  // soon to the App Store" and claims nothing else. Setting it switches that
  // copy (see APP_STORE below) to a live "Download on the App Store" link.
  appStoreName: "Covey: Do It Together",
  appStoreUrl: null as string | null,

  city: "San Francisco, CA",
  // Legal name and postal address. CAN-SPAM requires the address in every
  // commercial email (Covey Weekly, waitlist mail); the legal docs use both.
  legalName: "Covey Platforms Inc.",
  postalAddress: "315 Montgomery Street, Suite 900, San Francisco, CA 94104",
  launchRegion: "US only, 18+, starting in San Francisco",

  emails: {
    hello: "hello@coveyapp.co",
    press: "press@coveyapp.co",
    support: "support@coveyapp.co",
    safety: "safety@coveyapp.co",
    privacy: "privacy@coveyapp.co",
  },

  social: {
    instagram: "https://instagram.com/coveyapp",
  },
} as const;

export const CITY_SHORT = SITE.city.split(",")[0];

/**
 * App Store availability copy, derived from `SITE.appStoreUrl` so that one
 * value flips every page from "coming soon" to "available" on approval day.
 * Never claim the app is live while `appStoreUrl` is null.
 */
const appStoreLive = SITE.appStoreUrl !== null;
export const APP_STORE = {
  name: SITE.appStoreName,
  url: SITE.appStoreUrl,
  live: appStoreLive,
  /** Short, for the mono caption lines ("Free · 18+ · …"). */
  short: appStoreLive ? "On the web and the App Store" : "On the web now, iPhone app coming soon",
  /** A full sentence naming the store listing. */
  sentence: appStoreLive
    ? `The iPhone app, “${SITE.appStoreName}”, is on the App Store.`
    : `The iPhone app, “${SITE.appStoreName}”, is coming soon to the App Store.`,
} as const;

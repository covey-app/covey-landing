# covey-landing

The public marketing site for Covey — `coveyapp.co`. Built with
[Astro](https://astro.build) + Tailwind CSS v4.

Kept as a separate, minimal repo from `covey-ios` and `covey-web` so the
marketing site can deploy independently and stay fast. Pages are static HTML
with a small amount of progressive-enhancement JavaScript (theme toggle,
scroll reveals, a sticky-header state, the mobile menu, form validation, and
Astro view transitions). Everything remains usable with JavaScript disabled.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home — hero with an example plan, what people plan, why once isn't enough, interactive plan demo, Coveys (repeat hangouts), safety, FAQ, CTA |
| `/about` | About — story + four principles |
| `/contact` | Contact — form (Netlify Forms — see "Deployment") + linked emails |
| `/events` | Upcoming Events — honest empty state until dates are confirmed |
| `/testimonials` | Stories — honest empty state until real stories exist |
| `/support`, `/safety`, `/status`, `/deletion` | Help pages; `/support` is the App Store Connect Support URL |
| `/terms`, `/privacy` | Rendered from `docs/legal/*.md` (the authoritative text) |
| `/signup`, `/waitlist` | Forward to the product's join screen (`joinUrl`). covey-web still links "Join the waitlist" to `/signup` |
| `/sitemap.xml` | Generated from the page files at build time |
| `/thanks` | Post-submission confirmation (contact form `action`) |

Events and Stories stay out of the primary navigation until they hold real
content; both remain linked from the footer.

The home page's product claims are checked against covey-ios — see
`docs/landing-audit-2026-09-26.md` §2 before adding one. Group size is
host-set (six seats by default); there is no "2–10" cap.

## Design system — "the plan, printed"

A web translation of the Covey iOS design system
(`covey/ios/Covey/Core/DesignSystem/*`). Tokens live in `src/styles/global.css`
(CSS custom properties + `@theme inline`), with shared colors/radii/spacing
generated into `src/styles/tokens.css` from covey-web.

- **Type:** Geist Mono Variable (titles, labels, times, buttons; display titles
  lowercase), Instrument Sans Variable (reading copy), Manrope (empty states
  only). Self-hosted via Fontsource — no Google Fonts request.
- **Color:** paper grounds, charcoal ink for every primary action, coffee
  (`--accent-ink`) for accent words and links, matcha (`--accent`) for small
  brand moments, and the nine category colors (`--cat-*`) only on stop orbs,
  activity chips, and route marks.
- **Logo:** the App Store icon — a quail (a covey is a flock of quail) —
  shown as its icon tile (`AppIcon.astro`, assets in `public/brand/`, generated
  from covey-ios `Assets.xcassets`). The five-dot cluster (`CoveyMark.astro`)
  from the app's opening animation is a small punctuation mark, not the logo.
- **Product UI in HTML, not screenshots:** `PlanInvite` (the app's "COVEY ·
  THE PLAN" cover), `PlanDemo` (Itinerary / Map / Group, interactive),
  `CoveyCard`, `CoveyJourney`. Example data lives in `src/lib/plans.ts` —
  public places only, weekdays instead of dates, labeled "Example".
- **Icons:** Lucide (ISC) inlined at build time via `src/lib/icons.ts` and
  `Icon.astro` — zero client JS.
- **Motion:** one signature moment (the hero plan assembling, ≤ 1.1s, CSS only)
  over a quiet layer (section rises, demo crossfades, 0.97 press). Resting
  styles are final states; everything respects `prefers-reduced-motion`.
- **Cascade rule:** Astro scoped styles are unlayered and beat Tailwind v4's
  layered utilities. Never pair a scoped `display` rule with a Tailwind
  responsive `hidden`/`md:flex` on the same element — put the breakpoint in
  the scoped CSS (see `Header.astro`).

Reusable components: `AppIcon`, `Icon`, `PlanInvite`, `PlanDemo`, `CoveyCard`,
`CoveyJourney`, `JoinCTA`, `CoveyMark`, `EmptyState`, `FormField`,
`FormEnhance`, `ThemeToggle`, `RedirectPage`.

- [ ] Replace placeholder quotes in `src/pages/testimonials.astro` with real ones (with permission to publish them).
- [ ] Replace placeholder dates in `src/pages/events.astro` with confirmed events, or leave the empty-state copy as-is.
- [ ] Set up inboxes (or forwarding) for every address in `src/config.ts` — `hello@`, `press@`, `support@`, `safety@coveyapp.co`.
- [ ] Once iOS is approved, set `appStoreUrl` in `src/config.ts` and add the App Store badge beside the primary CTA.
- [ ] Have the `/privacy` draft reviewed against your real data practices before submitting the URL to App Store Connect.


## Local development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # outputs to dist/
npm run preview   # serve the production build locally
npm run og        # regenerate public/og-image.png from scripts/gen-og.mjs
npm run test:e2e  # Playwright: overflow, a11y (axe), and smoke checks

# Design tokens shared with covey-web (see scripts/design-tokens/README.md)
npm run tokens:verify     # drift check vs a covey-web checkout (../covey-web or COVEY_WEB_DIR)
npm run tokens:generate   # rewrite src/styles/tokens.css from tokens.json

```

## Deployment

**Production is served by Vercel** (`coveyapp.co` 308-redirects to
`www.coveyapp.co`, the canonical origin — `SITE.url` and `site` in
`astro.config.mjs`; response headers say `server: Vercel`). `vercel.json`
carries the security headers and the `/signup` + `/waitlist` redirects.
`netlify.toml` mirrors the same config in case the site moves back to Netlify.
Build `npm run build`, publish `dist`.

> **Verify the contact form.** It uses Netlify Forms (`data-netlify`), which
> does nothing on Vercel. Submit it once in production; if nothing arrives,
> move it to a Vercel-compatible backend before relying on it.

**Forms** use Netlify Forms — Netlify detects the `data-netlify="true"`
`contact` form at build time and captures submissions (**Site settings →
Forms**). It POSTs to `/thanks` and carries `data-astro-reload` so Astro's
client router performs a full navigation and Netlify captures the POST. If you
migrate off Netlify, replace the form backend (the `data-netlify` attribute +
honeypot) before release — a POST to the static `/thanks` page will otherwise
fail.

There is no waitlist form on this site: the "Join Covey" CTA sends people
straight to `joinUrl` (`go.coveyapp.co/login`, which offers Apple/Google
sign-in and "New to Covey? Create an account"). "Sign in" uses `signInUrl`,
currently the same screen.

## Domain

`coveyapp.co` is registered at GoDaddy with DNS pointed at Netlify. Use
`https://coveyapp.co/privacy` and `https://coveyapp.co/support` as the Privacy
Policy and Support URLs in the iOS App Store Connect listing.

## Before you go live

- [ ] Submit the contact form once in production and confirm it arrives
      (Netlify Forms does not run on Vercel — see "Deployment").
- [ ] Set up inboxes/forwarding for every address in `src/config.ts`
      (`hello@`, `press@`, `support@`, `safety@coveyapp.co`).
- [ ] Once iOS is approved, set `appStoreUrl` in `src/config.ts` and add a
      real App Store badge to the home page CTA.
- [ ] Have the `/privacy` draft reviewed against your real data practices
      before submitting the URL to App Store Connect.

The DNS notes below describe the original Netlify setup; production now runs
on Vercel, whose dashboard shows its own records.

**In Netlify:** Site settings → Domain management → Add a domain → enter
`coveyapp.co`. Netlify will show you the exact records to add.

**In GoDaddy (godaddy.com → My Products → DNS → Manage Zones for coveyapp.co):**

| Type | Name | Value | Notes |
| --- | --- | --- | --- |
| A | `@` | `75.2.60.5` | Netlify's load balancer IP — confirm the exact IP shown in your Netlify dashboard, it can change |
| CNAME | `www` | `<your-site>.netlify.app` | Use the subdomain Netlify assigns your site |

Alternative (often more reliable than a bare A record): in GoDaddy, delete
the default `@` A record and instead set an **ALIAS**/**Forwarding** record
for `@` → `<your-site>.netlify.app`, if GoDaddy's DNS panel offers ALIAS
records for apex domains. Netlify's own domain setup screen always shows
the current recommended records — follow what it displays over any hardcoded
IP.

Once DNS resolves, Netlify auto-provisions a free Let's Encrypt SSL
certificate for `coveyapp.co` — no extra steps.

**Subdomain layout:**

- `coveyapp.co` → this repo (landing/marketing)
- `go.coveyapp.co` → `covey-web` (the product web app)

## Connecting to `covey-ios` and `covey-web`

This repo has no code dependency on the other two — that's the point, it
should be able to ship on its own. The deploy split is:

| Domain | Repo | Build |
| --- | --- | --- |
| `coveyapp.co` | this repo (Astro) | `npm run build` → `dist/` |
| `go.coveyapp.co` | `covey-web` (Expo static export) | `npx expo export --platform web` → `dist/` |

All marketing and legal pages live here; the product app hosts none of them
and links back to this site instead. The connections are:

- **Brand / design tokens:** colors, radii, spacing, and font stacks are
  synced one-directionally from `covey-web`'s `lib/theme/` (itself ported
  from iOS) via `scripts/design-tokens/` — `tokens.json` is the committed
  copy, `src/styles/tokens.css` the generated output consumed by
  `global.css`. Run `npm run tokens:verify` after theme changes over there.
  Landing-only values (CSS shadows, category palette, motion) stay
  hand-written in `global.css`. See `scripts/design-tokens/README.md`.
- **Cross-links:** `src/config.ts` holds `joinUrl` ("Join Covey" —
  `go.coveyapp.co/login`), `signInUrl` (`go.coveyapp.co/login`), and
  `browseUrl` (public plans, footer only). Update them there once, not
  scattered across pages.
- **App Store Connect:** once submitted, use `https://coveyapp.co/privacy`
  and `https://coveyapp.co/support` as your Privacy Policy URL and Support
  URL in `covey-ios`'s App Store Connect listing.
- **Signup:** this site never collects emails. "Join Covey" hands people to
  `joinUrl` (`go.coveyapp.co/login`) and the product owns signup from there.


# covey-landing

The public marketing site for Covey — `coveyapp.co`. Built with
[Astro](https://astro.build) + Tailwind CSS v4.

Kept as a separate, minimal repo from `covey-ios` and `covey-web` so the
marketing site can deploy independently and stay fast. Pages are static HTML
with a small amount of progressive-enhancement JavaScript (theme toggle,
scroll reveals, a sticky-header state, the mobile menu, form validation, the
waitlist form, the hero animation, and Astro view transitions). Everything
remains usable with JavaScript disabled. One route, `/api/waitlist`, runs on
demand as a Vercel Function — see **[docs/waitlist.md](docs/waitlist.md)**.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home: the hero cast (Quinn + the nine category quails), the problem, how it works (sticky story), and this week in SF |
| `/waitlist` | The dedicated signup; Quinn reacts to the form |
| `/waitlist/joined` | Confirmation for the no-JS form path |
| `/newsletter` | Covey Weekly: masthead, subscribe, latest Top Picks, archive |
| `/newsletter/<week>` | One edition: Top Picks + the complete guide (filterable); `/email/` is its email version |
| `/newsletter/confirm`, `/newsletter/unsubscribe` | Double opt-in and unsubscribe (server-rendered; one-click POST supported) |
| `/activities` | The two-week directory: by day, filter by category / neighborhood / free / after work / weekend |
| `/about` | Story, California roots, meet Quinn, principles, safety, FAQ |
| `/contact`, `/support`, `/safety`, `/status`, `/deletion`, `/terms`, `/privacy`, `/testimonials` | As before |
| `/signup` → `/waitlist`, `/events` → `/activities` | Redirects |
| `/api/waitlist`, `/api/newsletter` | Vercel Functions (docs/waitlist.md, docs/content.md) |

The design direction, asset system, and motion map are in
**[docs/redesign-2026-10.md](docs/redesign-2026-10.md)**. Weekly content and
newsletter operations are in **[docs/content.md](docs/content.md)**.

## Design system

Covey's iOS design system translated for the web (tokens in
`src/styles/global.css` and the generated `src/styles/tokens.css`), plus the
redesign's expressive layer (`src/styles/expressive.css`): the editorial scale
(`t-mega`, `t-display`, `t-title`), page identities (`data-page` on
`<body>`), the CTA, arrow links, chips, and motion primitives
(`src/lib/motion.ts`).

- **Type:** Geist Mono (display, lowercase; labels; buttons), Instrument Sans
  (reading). Self-hosted via Fontsource.
- **Characters:** the primary mark (app-icon quail) only identifies the
  brand. **Quinn** (`Quinn.astro`: five views + line art; `QuinnFace.astro`:
  seven expressions) is the protagonist. The nine **category quails**
  (`public/brand/flock/`, `src/lib/categories.ts`) are the flock.
- **Rooms:** home on paper, waitlist in deep matcha, newsletter as newsprint,
  activities in sky blue, about in clay.
- **Motion:** pointer- and scroll-driven, transforms and opacity only, no idle
  loops, all disabled under `prefers-reduced-motion`.
- **Cascade rule:** Astro scoped styles are unlayered and beat Tailwind v4's
  layered utilities. Keep `display` and its breakpoints in the same scoped
  rule (see `Header.astro`).

## Local development

```bash
npm install
npm run dev         # http://localhost:4321 (live content)
npm run build     # outputs to .vercel/output/ (static pages + one function)
npm run preview   # serve that build locally, with the real /api/waitlist handler
npm run og        # regenerate public/og-image.png from scripts/gen-og.mjs
npm run test:unit # waitlist + newsletter handler unit tests (node --test, no network)
npm run test:db   # both migrations against a throwaway Postgres (needs Docker)
npm run test:e2e  # Playwright on the real listings (COVEY_TODAY pinned, weather mocked): overflow, axe, navigation, waitlist, newsletter, activities
npm run content:import -- export.csv   # Social Media Manager sheet → content/live/activities
npm run newsletter:send -- 2026-10-12  # dry run; --to you@x.co or --send --yes (docs/content.md)

# Design tokens shared with covey-web (see scripts/design-tokens/README.md)
npm run tokens:verify     # drift check vs a covey-web checkout (../covey-web or COVEY_WEB_DIR)
npm run tokens:generate   # rewrite src/styles/tokens.css from tokens.json

```

## Deployment

**Production is served by Vercel** (`coveyapp.co` 308-redirects to
`www.coveyapp.co`, the canonical origin — `SITE.url` and `site` in
`astro.config.mjs`; response headers say `server: Vercel`). `vercel.json`
carries the security headers and the `/signup` → `/waitlist` redirect. The
`@astrojs/vercel` adapter builds to `.vercel/output`, which Vercel deploys as
static pages plus the `/api/waitlist` function. The waitlist needs
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel's Production
environment and a one-time migration — the full checklist is in
[docs/waitlist.md §3](docs/waitlist.md#3-deployment-checklist). `netlify.toml`
mirrors the static config only.

**The only forms are the waitlist and Covey Weekly sign-ups**, both handled by
Vercel Functions (`/api/waitlist`, `/api/newsletter`). The old Netlify Forms
contact form did nothing on Vercel and was removed; `/contact` and `/support`
list `mailto:` addresses instead. Any new form must be added to the privacy
policy (§ 4.14) first.

**Waitlist:** every primary CTA is "Join the waitlist", backed by
`/api/waitlist` → Supabase (`waitlist_signups`, service-role-only RPCs). See
[docs/waitlist.md](docs/waitlist.md) for the schema, security model, how to
view/export/invite, and analytics. "Sign in" still goes to `signInUrl`
(`go.coveyapp.co/login`) for existing members.

## Domain

`coveyapp.co` is registered at GoDaddy with DNS pointed at Netlify. Use
`https://coveyapp.co/privacy` and `https://coveyapp.co/support` as the Privacy
Policy and Support URLs in the iOS App Store Connect listing.

## Before you go live

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
- **Cross-links:** `src/config.ts` holds `waitlistPath` (`/waitlist`),
  `signInUrl` (`go.coveyapp.co/login`), and `browseUrl` (public plans, footer
  only). Update them there once, not scattered across pages.
- **App Store Connect:** once submitted, use `https://coveyapp.co/privacy`
  and `https://coveyapp.co/support` as your Privacy Policy URL and Support
  URL in `covey-ios`'s App Store Connect listing.
- **Signup:** pre-launch, this site collects waitlist emails (and nothing
  else) into a dedicated Supabase table that no app code reads. Account
  creation still belongs to the product at `go.coveyapp.co`.


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
| `/` | Home — hero, category rail, why/what, how-it-works, itinerary proof, FAQ, CTA |
| `/about` | About — story + four principles |
| `/contact` | Contact — form (Netlify Forms) + linked emails |
| `/events` | Upcoming Events — honest empty state until dates are confirmed |
| `/signup` | Waitlist signup (invite-only launch) — form (Netlify Forms) |
| `/testimonials` | Testimonials — honest empty state until real stories exist |
| `/privacy` | Privacy policy (marketing site scope only) |
| `/support` | Support contact — used for the App Store Connect Support URL |
| `/thanks` | Post-submission confirmation (form `action`) |

Testimonials and Events are intentionally kept out of the primary navigation
until they hold real content; both remain linked from the footer.

## Design system

The visual language is a web translation of the current Covey iOS design
system (see `covey/ios/Covey/Core/DesignSystem/*`). It lives entirely in
`src/styles/global.css` as CSS custom properties + `@theme inline` tokens:

- **Surfaces:** near-white "paper" grounds, charcoal ink, flat elevated cards
  (`.card`, `.card-pinned`, `.card-sunken`) with the app's exact shadow
  elevations. No glassmorphism except the translucent sticky header.
- **Type:** Geist Mono (titles/UI chrome), Instrument Sans (reading copy),
  Manrope (friendly empty states). Headings use fluid `clamp()` scales
  (`.t-hero`, `.t-h1`, `.t-h2`, `.t-h3`).
- **Color:** a matcha-green + coffee-brown accent duo plus the nine activity
  category colors (`--cat-*`), all with light/dark values.
- **Brand mark:** the five-color "flock" dot cluster (`CoveyMark.astro`) — the
  app has no bird illustration; the dots are the recurring signature.
- **Motion:** restrained, reduced-motion-safe entrances, staggered reveals,
  button/card feedback, and a shortened definition-moment bloom. All gated on
  `prefers-reduced-motion`.

Reusable components: `CoveyMark`, `DefinitionMoment`, `PlanCardMock`,
`CategoryChip`, `FormField`, `FormEnhance`, `EmptyState`, `ThemeToggle`.

- [ ] Replace placeholder quotes in `src/pages/testimonials.astro` with real ones (has your permission to publish them).
- [ ] Replace placeholder dates in `src/pages/events.astro` with confirmed events, or leave the empty-state copy as-is.
- [ ] Once you have a real iOS screenshot, drop it at `public/screenshots/hero.png` — see the TODO comment in `src/pages/index.astro` for where to slot it in alongside (or instead of) the bird illustration card.
- [ ] `public/og-image.png` currently reuses the hero bird illustration — swap for a dedicated 1200×630 share image once you have real app screenshots or branding to show.
- [ ] Set up inboxes (or forwarding) for every address in `src/config.ts` — `hello@`, `press@`, `support@`, `safety@coveyapp.co`. GoDaddy sells email, or you can forward `@coveyapp.co` to an existing inbox via GoDaddy's free email forwarding.
- [ ] Once `covey-web` is deployed at `app.coveyapp.co`, flip `appIsLive` in `src/config.ts` so the header/footer show "Browse plans" (`browseUrl`, no account needed) and "Sign in" (`appUrl`).
- [ ] Once iOS is approved, set `appStoreUrl` in `src/config.ts` and add a real badge to `/signup`.
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

Deployed on **Netlify** (see `netlify.toml`): build `npm run build`, publish
`dist`. Security headers and the catch-all 404 are configured there.

**Forms** use Netlify Forms — Netlify detects the two `data-netlify="true"`
forms (`waitlist`, `contact`) at build time and captures submissions
(**Site settings → Forms**). Both forms POST to `/thanks` and carry
`data-astro-reload` so Astro's client router performs a full navigation and
Netlify captures the POST. If you migrate off Netlify, replace the form
backend (the `data-netlify` attribute + honeypot) before release — a POST to
the static `/thanks` page will otherwise fail.

Waitlist emails land in Netlify Forms; export them (or wire a webhook) into
whatever system actually sends invites — that pipeline lives outside this repo.

## Domain

`coveyapp.co` is registered at GoDaddy with DNS pointed at Netlify. Use
`https://coveyapp.co/privacy` and `https://coveyapp.co/support` as the Privacy
Policy and Support URLs in the iOS App Store Connect listing.

## Before you go live

- [ ] Confirm the Netlify Forms submissions inbox/notifications are set up for
      `waitlist` and `contact`, and submit each form once in production.
- [ ] Set up inboxes/forwarding for every address in `src/config.ts`
      (`hello@`, `press@`, `support@`, `safety@coveyapp.co`).
- [ ] Once `covey-web` is deployed, set `appUrl`/`appIsLive` in
      `src/config.ts` so the "Open the app" link resolves.
- [ ] Once iOS is approved, set `appStoreUrl` in `src/config.ts` and add a
      real App Store badge to `/signup`.
- [ ] Have the `/privacy` draft reviewed against your real data practices
      before submitting the URL to App Store Connect.

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

**Decide your subdomain layout now** (recommended):

- `coveyapp.co` → this repo (landing/marketing)
- `app.coveyapp.co` → `covey-web` (the actual product web app)

Update `appUrl` in `src/config.ts` once `covey-web` is live at that
subdomain so the header/footer link out to it correctly.

## Connecting to `covey-ios` and `covey-web`

This repo has no code dependency on the other two — that's the point, it
should be able to ship on its own. The deploy split is:

| Domain | Repo | Build |
| --- | --- | --- |
| `coveyapp.co` | this repo (Astro) | `npm run build` → `dist/` |
| `app.coveyapp.co` | `covey-web` (Expo static export) | `npx expo export --platform web` → `dist/` |

All marketing, legal, and waitlist pages live here; the product app hosts
none of them and links back to this site instead. The connections are:

- **Brand / design tokens:** colors, radii, spacing, and font stacks are
  synced one-directionally from `covey-web`'s `lib/theme/` (itself ported
  from iOS) via `scripts/design-tokens/` — `tokens.json` is the committed
  copy, `src/styles/tokens.css` the generated output consumed by
  `global.css`. Run `npm run tokens:verify` after theme changes over there.
  Landing-only values (CSS shadows, category palette, motion) stay
  hand-written in `global.css`. See `scripts/design-tokens/README.md`.
- **Cross-links:** `src/config.ts` holds `appUrl` ("Sign in"), `browseUrl`
  ("Browse plans" — published plans are viewable without an account), and
  the `appIsLive` switch that hides both until the product deploy exists.
  Update them there once, not scattered across pages.
- **App Store Connect:** once submitted, use `https://coveyapp.co/privacy`
  and `https://coveyapp.co/support` as your Privacy Policy URL and Support
  URL in `covey-ios`'s App Store Connect listing.
- **Waitlist → invites:** waitlist emails land in Netlify Forms. Export
  them (or wire a Netlify → Zapier/webhook integration) into whatever
  system `covey-ios`/`covey-web` uses to actually send invites — that
  pipeline lives outside this repo by design.


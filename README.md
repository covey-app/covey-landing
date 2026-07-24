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

## Local development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # outputs to dist/
npm run preview   # serve the production build locally
npm run og        # regenerate public/og-image.png from scripts/gen-og.mjs
npm run test:e2e  # Playwright: overflow, a11y (axe), and smoke checks
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

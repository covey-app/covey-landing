# covey-landing

The public marketing site for Covey — `coveyapp.co`. Built with
[Astro](https://astro.build) + Tailwind CSS v4. Ships zero client-side JS;
every page is static HTML.

This is intentionally a separate, minimal repo from `covey-ios` and
`covey-web` so the marketing site can deploy independently and stay fast.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Home — hero, features, how-it-works, CTA |
| `/about` | About Us — story + principles |
| `/contact` | Contact Us — form (Netlify Forms) + emails |
| `/events` | Upcoming Events — placeholder content, see TODOs in `src/pages/events.astro` |
| `/signup` | Waitlist signup (invite-only launch) — form (Netlify Forms) |
| `/testimonials` | Testimonials — placeholder content, see TODOs in `src/pages/testimonials.astro` |
| `/privacy` | Privacy policy (marketing site scope only) |
| `/support` | Support contact — required for App Store Connect |

## Visual design

The hero, "Why Covey" section, header/footer mark, and section dividers use
three AI-generated illustrations in `public/images/` (`hero-flock.png`,
`bird-mark.png`, `flock-circle.png`), styled as pinned field-note clippings
to match the existing paper/tape/vellum motif — leaning into "covey" (a
small flock of birds that moves together) as the actual brand metaphor
instead of decoration. `src/styles/global.css` has the shared `.btn`,
`.card-hover`, and `.reveal` utilities used for hover lifts and the
scroll-in animation (progressive enhancement — everything is visible with
JS disabled, see the `.reveal` rule and the script in `BaseLayout.astro`).

## Before you go live

- [ ] Replace placeholder quotes in `src/pages/testimonials.astro` with real ones (has your permission to publish them).
- [ ] Replace placeholder dates in `src/pages/events.astro` with confirmed events, or leave the empty-state copy as-is.
- [ ] Once you have a real iOS screenshot, drop it at `public/screenshots/hero.png` — see the TODO comment in `src/pages/index.astro` for where to slot it in alongside (or instead of) the bird illustration card.
- [ ] `public/og-image.png` currently reuses the hero bird illustration — swap for a dedicated 1200×630 share image once you have real app screenshots or branding to show.
- [ ] Set up inboxes (or forwarding) for every address in `src/config.ts` — `hello@`, `press@`, `support@`, `safety@coveyapp.co`. GoDaddy sells email, or you can forward `@coveyapp.co` to an existing inbox via GoDaddy's free email forwarding.
- [ ] Once `covey-web` is deployed, set `appUrl`/`appIsLive` in `src/config.ts` so the nav links out to it.
- [ ] Once iOS is approved, set `appStoreUrl` in `src/config.ts` and add a real badge to `/signup`.
- [ ] Have the `/privacy` draft reviewed against your real data practices before submitting the URL to App Store Connect.

## Local development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # outputs to dist/
npm run preview   # serve the production build locally
```

## Pushing this repo to GitHub

This folder isn't a git repo yet (created by hand, not via `gh repo clone`,
since the setup was done from the parent `covey` workspace). From inside
`covey-landing/`:

```bash
git init
git branch -M main
git add .
git commit -m "Initial covey-landing scaffold"
git remote add origin https://github.com/covey-app/covey-landing.git
git push -u origin main
```

## Deploying on Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → pick `covey-app/covey-landing` on GitHub.
2. Build command: `npm run build`. Publish directory: `dist`. (Already set in `netlify.toml` — Netlify will detect it automatically.)
3. Deploy. You'll get a `*.netlify.app` URL immediately with free SSL.
4. Netlify auto-detects the two `data-netlify="true"` forms (`waitlist`, `contact`) on first deploy — check **Site settings → Forms** to see submissions and set up email notifications for new signups.

## Pointing your GoDaddy domain (`coveyapp.co`) at Netlify

You keep the domain registered at GoDaddy — you're just changing where its
DNS points, not "hosting on GoDaddy." This is the standard setup and takes
about 5 minutes plus DNS propagation time (up to ~24h, usually much faster).

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
should be able to ship on its own. The connections are:

- **Brand:** the palette, type (Fraunces / Inter / JetBrains Mono), and
  copy voice in this repo were ported from `covey-web`'s existing
  `src/styles.css` and marketing routes, so all three properties read as
  one brand.
- **Cross-links:** `src/config.ts` holds the single `appUrl` used to link
  from this marketing site into `covey-web`. Update it there once, not
  scattered across pages.
- **App Store Connect:** once submitted, use `https://coveyapp.co/privacy`
  and `https://coveyapp.co/support` as your Privacy Policy URL and Support
  URL in `covey-ios`'s App Store Connect listing.
- **Waitlist → invites:** waitlist emails land in Netlify Forms. Export
  them (or wire a Netlify → Zapier/webhook integration) into whatever
  system `covey-ios`/`covey-web` uses to actually send invites — that
  pipeline lives outside this repo by design.

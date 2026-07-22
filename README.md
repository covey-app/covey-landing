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
| `/contact` | Contact Us — form (Formspree) + emails |
| `/events` | Upcoming Events — placeholder content, see TODOs in `src/pages/events.astro` |
| `/signup` | Waitlist signup (invite-only launch) — form (Formspree) |
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
- [ ] Create a free [Formspree](https://formspree.io) account, add the `waitlist` and `contact` forms, and replace the two placeholder IDs in `src/config.ts` (`SITE.forms.waitlistEndpoint` / `contactEndpoint`) with the real endpoint URLs Formspree gives you. Submit each form once after deploying and confirm the verification email Formspree sends — submissions are silently dropped until you do.
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

## Connecting this repo to GitHub

This repo is already tracked with git and its `origin` remote points at
`https://github.com/covey-app/covey-landing.git` (branch `main`). If that
repo already exists under your org and you just need to push:

```bash
git push -u origin main
```

If your boss's approved repo lives somewhere else (a different org name or
`landing-page` instead of `covey-landing`), repoint the existing remote
instead of re-initializing anything:

```bash
git remote set-url origin https://github.com/<org>/<repo>.git
git push -u origin main
```

If you're starting from a brand-new, empty GitHub repo (no README/license
generated on GitHub's side), the same `git push -u origin main` above is
all you need — don't let GitHub's "Quick setup" `git init` instructions
overwrite the history that's already here.

## Deploying on Vercel

1. [vercel.com](https://vercel.com) → sign in with GitHub (this authorizes
   Vercel to see your repos — grant it access to the org/repo your boss
   approved).
2. **Add New...** → **Project** → import the GitHub repo for this site.
3. Vercel auto-detects Astro from `vercel.json` / `package.json` — build
   command `npm run build`, output directory `dist`. You shouldn't need to
   change anything on the import screen.
4. Click **Deploy**. You'll get a `*.vercel.app` URL in about a minute with
   free SSL.
5. From then on, every push to `main` auto-deploys to production, and every
   pull request gets its own preview URL automatically — no CI changes
   needed for this.

Forms no longer submit to the host directly (Vercel has no Netlify
Forms-style form backend) — they POST to Formspree instead. See the
Formspree checklist item above; do that once, before/after your first
deploy, or waitlist/contact submissions will silently go nowhere.

## Pointing your GoDaddy domain (`coveyapp.co`) at Vercel

You keep the domain registered at GoDaddy — you're just changing where its
DNS points, not "hosting on GoDaddy." This is the standard setup and takes
about 5 minutes plus DNS propagation time (up to ~24h, usually much faster).

**In Vercel:** Project → Settings → Domains → add `coveyapp.co` (and
`www.coveyapp.co` if you want both). Vercel will show you the exact records
to add for your specific project.

**In GoDaddy (godaddy.com → My Products → DNS → Manage Zones for coveyapp.co):**

| Type | Name | Value | Notes |
| --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | Vercel's anycast IP for apex domains — confirm the exact value shown in your Vercel dashboard, it can change |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel's standard CNAME target |

Vercel's own domain setup screen always shows the current recommended
records for your account — follow what it displays there over any
hardcoded values above.

Once DNS resolves, Vercel auto-provisions a free SSL certificate for
`coveyapp.co` — no extra steps.

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
- **Waitlist → invites:** waitlist emails land in Formspree (see
  `SITE.forms` in `src/config.ts`). Export them from the Formspree
  dashboard (or wire its Zapier/webhook integration) into whatever system
  `covey-ios`/`covey-web` uses to actually send invites — that pipeline
  lives outside this repo by design.

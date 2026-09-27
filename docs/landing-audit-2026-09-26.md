# Landing page audit and redesign brief (2026-09-26)

This doc covers what was inspected, what was wrong, the brand direction chosen, and
the page narrative the redesign implements. The before/after screenshots and
verification results live in the session report. This file records the reasoning so the
next change doesn't have to rediscover it.

Evidence tags:

- **[observed]** reproduced in a browser or with a script
- **[code]** read in source
- **[heuristic]** a UX-principle judgement
- **[hypothesis]** needs user testing or access we don't have

## 1. Coverage

**Landing repo, read in full.**

- All of `src/`: 13 pages, 15 components, the layout, `config.ts`, `lib/*`, `global.css`
  and the generated `tokens.css`.
- `astro.config.mjs`, `netlify.toml`, `vercel.json`, `package.json`,
  `playwright.config.ts`, `tests/*`, `.github/workflows/ci.yml`, `scripts/*`,
  `sentry.client.config.ts`, `public/*`, and the README.
- The Markdown in `docs/legal/*` was not read clause by clause. It is legal text rendered
  through `LegalDocument.astro`; only its chrome was reviewed.
- Excluded: `node_modules/`, `dist/`, `.astro/`, `test-results/`.

**Live site.** `https://coveyapp.co` 308-redirects to `https://www.coveyapp.co`, served by
Vercel (`last-modified: 20 Sep 2026`).

- Captured `/`, `/about`, `/contact`, `/events`, `/testimonials`, `/support`, `/privacy`
  and a 404, each at 390, 768 and 1440px, as fold and full-page shots, in Chromium via
  Playwright.
- Interaction scripts covered the header, mobile menu, keyboard tab order, FAQ, contact
  validation, reduced motion, JavaScript disabled, and axe (WCAG 2.2 A/AA) in light and
  dark.

**Local.** Checked with `npm run dev` and `npm run build`. The text of `dist/index.html`
is identical to the live home page, so live equals `main` for content.

**Product destinations.**

- `go.coveyapp.co/login`, `/signup` and `/explore` were viewed read-only.
- No accounts were created and no forms were submitted.

**covey-web.** Read `lib/config/site.ts` and `lib/config/membersOnly.ts`: the
marketing links and the members-only feature copy.

**iOS (`covey/ios/Covey`).**

- Read the design system (`Core/DesignSystem/*`), plan card, stop orbs, brochure and plan
  detail, timeline, Coveys, recurring plans, recaps, `LaunchPolicy`, onboarding copy, and
  the assets.
- Ran the existing simulator build (`ios/build/.../Covey.app`) on an iPhone 17 Pro. A
  signed-in dev session was already on the device, so the real plan card, the "THE PLAN"
  cover, the itinerary timeline and the tab bar were inspected visually.
- Only navigation was used. Nothing was joined, edited or sent.

**Coverage gaps.**

- **The contact form's behavior in production is unverified.** The README says the site
  runs on Netlify and uses Netlify Forms. The live site is actually served by Vercel,
  where `data-netlify` does nothing. Submitting to production would test this, but it
  was not submitted because that sends a real message. **[hypothesis, high impact]**
- **Real-user performance data (CrUX or RUM) was not accessible.** Performance figures
  below are lab measurements only.
- **The iOS signed-out screens were not seen.** The simulator session was already signed
  in, and signing it out would have touched the account. Those screens are known from
  source only.

## 2. What the product actually is (verified)

Every claim on the new page traces to one of these.

**Plans**

- A plan is a small itinerary: stops, times, venues and a seat count.
- Hangout types: Casual, Event, Date, Professional (`Plan.swift`).
- Join modes: "Open", "Request to join", "Invite only". Visibility: Public, Friends,
  Invite only, Unlisted.

**Group size**

- The host sets the headcount.
- Default: **6** (`CreatePlanViewModel.swift:20`).
- Minimum: 2. Date plans are always 2 seats.
- An optional "no numeric cap" setting exists.
- **Nothing enforces "2–10"**, the figure the current site advertises.

**Repeat hangouts**

- **Coveys** are standing groups. The app's own copy: "your climbing crew, book club, or
  Sunday pickup game — that plans things together." They can be Open, Request to join,
  Invite only, or Private.
- **Recurring plans:** Weekly, Every 2 weeks, or Monthly. An admin taps "Schedule next
  occurrence" and every member gets the invite.
- **Invite a whole Covey** when you create a plan.
- **Recaps:** "This plan happened — share how it went."
- **People:** friends, DMs and group chats.
- **Planning and habit:** "When is everyone free?" availability matching, and streaks.

**During a plan**

- Plan chat, day-of arrivals ("On the way", "Running late", "Arrived"), and choosing
  which stops you'll make.
- Calendar export and directions.
- An AI plan co-pilot drafts the title, settings and stops for review.

**Access**

- US, 18+, invite-only launch (`LaunchPolicy.swift:107-165`).
- Account signup exists on the web at `go.coveyapp.co/signup`.
- No App Store URL yet.
- Paid plans are off, so Covey is free.

**Not built. The site must not imply these:**

- "Plan again" or duplicating a plan
- Inviting past attendees
- Crews made from a plan (backend only, "No UI reaches any of this today")
- "Met at" history

## 3. Findings, prioritized

Severity levels:

- **P0**: blocks a task or states something false
- **P1**: comprehension or conversion
- **P2**: accessibility or consistency
- **P3**: polish

### P0: blocked tasks and false claims

**P0-1. The primary CTA sends new visitors to a returning-user sign-in screen.** [observed]

- **Where:** every "Join the flock" button → `SITE.joinUrl = go.coveyapp.co/login`
  (`src/config.ts:30`).
- **Problem:**
  - The destination is headed "WELCOME BACK / sign in."
  - Account creation is a small "New to Covey? Create an account" link below the fold.
  - A real `/signup` page ("NEW TO COVEY / make an account.") exists.
- **Consequence:** a new visitor who just decided to join is told they're returning. Some
  will try to sign in and fail.
- **Principle:** Jakob's Law. CTA destinations should match the label's promise.
- **Fix proposed:**
  - Primary CTA → `/signup`.
  - Add a separate "Sign in" link for returning users.
  - Relabel the CTA "Join Covey", a plain verb plus the product name.
- **Decision (2026-09-26): keep `/login`.** It handles both paths: Apple and Google
  sign-in, plus "New to Covey? Create an account".
  - Implemented: the label "Join Covey", a "Sign in" link in the header, and one button
    in the closing CTA (two buttons pointing at the same screen would be a choice
    without a difference).
  - `/signup` in the product still exists if this is revisited.

**P0-2. `coveyapp.co/signup` returns 404, but the product still links to it.** [observed + code]

- **Where:** covey-web links "Join the waitlist" to `${marketingUrl}/signup`
  (`lib/config/site.ts:17`, `MembersOnlyScreen.tsx:93-98`, `PublicWebShell.tsx:82`). The
  landing site removed that page in `a574e09`.
- **Consequence:** the product's own conversion path dead-ends on a 404.
- **Fix:**
  - Serve `/signup`, and `/waitlist`, as a redirect to the product's join screen
    (`joinUrl`, `/login`), both as a
    host-level redirect and as a static fallback page.
  - Update covey-web's copy when convenient. That's a separate repo and was not touched.

**P0-3. The site describes a waitlist and an email capture that don't exist.** [code]

- **Where:**
  - `WaitlistCTA.astro:13`: "Drop your email and we'll reach out…"
  - The FAQ: "Join the waitlist…"
  - `about.astro:119`, `events.astro:23,39`, `testimonials.astro:44`, `support.astro:14`
- **Problem:** the button beside that copy opens a product sign-in page. There is no
  email field anywhere.
- **Consequence:** it erodes trust at the moment of commitment.
- **Principle:** Postel's and Tesler's Laws. Predictable output: the copy should describe
  what the click does.
- **Fix:** rewrite every instance so it describes account creation.

**P0-4. Group-size claims contradict each other and the product.** [code]

- **What the site says:**
  - "2–10 person plans" in the hero
  - "Hosts cap each plan between two and ten people" in a feature card
  - "Ten to fifteen. Never a crowd." in `WhyCovey.astro:14`
  - "Two to ten" on the About page
- **What the product does:** default 6 seats, minimum 2, no 10 cap.
- **Consequence:** an investor or a careful user catches the contradiction and discounts
  the rest of the page.
- **Fix:** "Hosts set the headcount — six seats by default."

**P0-5. The core positioning is missing, and the current copy contradicts it.** [code]

- The brief is "strangers into friends through small-group plans **and repeat
  hangouts**."
- The site says the opposite:
  - "one plan, for one day"
  - "then everyone goes home"
  - "scatter back to their own lives when the day is done"
- "Three steps, no group chat." misstates the product, which ships plan chat and group
  chats.
- Coveys, recurring plans, recaps and friends, the product's actual answer to "why meet
  again", appear nowhere.
- **Consequence:**
  - Visitors see an events app, not a friendship app.
  - Investors see no retention mechanism.
- **Fix:** add a dedicated "second hangout" section built on Coveys, recurring plans and
  recaps. Remove the "one day, then home" framing.

### P1: comprehension and conversion

**P1-1. The hero doesn't say what Covey does for you.** [observed, heuristic]

- **The copy:**
  - "Anything, anytime, together." is interchangeable with any social app.
  - The subhead ("plan-first social app… itineraries… seats") describes mechanics, not
    the outcome (meeting people and making friends).
  - The eyebrow leads with three restrictions: "US ONLY, INVITE-ONLY, IOS FIRST".
- **Principle:** serial position. The first line is the most-read line on the page.
- **Fix:**
  - An outcome headline, "turn strangers into friends, one plan at a time."
  - A subhead naming who it's for and how.
  - Restrictions moved to microcopy under the CTA.

**P1-2. The hero visual hides its own content.** [observed]

- **Measurements at 1440px:**
  - The plan card overlaps the definition card by **235px**.
  - It covers the word "Covey" (`wordRight 1168 > mockLeft 1101`) and truncates "a small
    group of people gathered to…" (`index.astro:137-146`, `evidence/hero-overlap-1440.png`).
- **Problem:** hover-to-raise is the only recovery, which rules out touch and keyboard.
- **Principle:** Gestalt figure/ground. Two competing focal objects, neither whole.
- **Fix:** one hero object, the plan invitation, shown whole.

**P1-3. The product explanation starts about 1,900px down.** [observed]

- **Current order:** definition → category rail → name story ("Why the name fits") →
  "What it is" → "How it works" → "A real plan".
- On a 390px phone, "What it is" begins about 2.3 screens down. The page is **7,612px**
  (about 9 screens).
- **Principle:** Pareto and serial position. The name story is charming but low value;
  it currently sits in the second-most-read slot.
- **Fix:**
  - New order: Hero (with a real plan) → what people plan → why once isn't enough → how
    it works (interactive) → the second hangout (Coveys) → safety → FAQ → CTA.
  - The name story moves inside the Coveys section, where the metaphor pays off.

**P1-4. The product preview is a generic card, shown twice.** [observed]

- The same "Sunset wine crawl" card appears in the hero and again in "A real plan".
- **It doesn't match the product:**
  - Real orbs carry category glyphs; the mock has numbers.
  - Real cards show "4/6 going" with a people icon; the mock has "4 going".
  - Real cards have no "Hosted by" footer.
- The card also never shows the itinerary, which is the most recognizable thing in the
  app.
- **Fix:** an interactive web version of the plan detail. It has the app's own Itinerary,
  Map and Group switcher, three example plans, and legible type at desktop and mobile
  sizes.

**P1-5. Home links to two empty pages.** [observed]

- The "Get involved" and "Early stories" cards link to `/events` ("Nothing on the calendar
  yet") and `/testimonials` ("Nothing to show yet — honestly").
- **Consequence:** these are dead ends placed in prime space. For an investor, they are a
  signpost to "nothing here".
- **Fix:** remove both from home. Keep them in the footer, which is where the header
  comment says they belong.

**P1-6. The "How it works" CTA goes to `/about`.** [observed]

- The label promises an explanation. The destination is a founder-story page.
- **Fix:** an in-page anchor to the interactive demo, "See how a plan works".

### P2: accessibility and consistency

**P2-1. A dead menu button shows on desktop.** [observed]

- At ≥768px the hamburger is visible (`evidence/header-desktop-1440.png`). Clicking it
  flips `aria-expanded` but opens nothing, and it sits in the tab order.
- **Root cause:**
  - `Header.astro`'s scoped `.menu-btn { display: inline-grid }` is unlayered CSS.
  - Tailwind v4 puts `md:hidden` in `@layer utilities`.
  - Unlayered styles beat layered ones regardless of specificity.
- **Same bug elsewhere:** the second plan card, marked `hidden sm:flex`, still renders
  on phones, adding about 400px.
- **Fix:**
  - Put component `display` rules in `@layer components`.
  - Add a regression test.

**P2-2. Contrast failure.** [observed, axe]

- The clay "1." / "2." definition numerals are **3.3:1** on white (`#C77A5A`), which
  fails WCAG 1.4.3.

**P2-3. A scrollable region can't be reached by keyboard.** [observed, axe, serious]

- The mobile category rail scrolls horizontally but isn't focusable (WCAG 2.1.1).
- Its label is clipped by the edge mask ("LANS ACROSS", `evidence/mobile-rail-390.png`).
- **Fix:** wrap it statically. There's no reason to hide eight items behind a sideways
  scroll.

**P2-4. Mobile touch targets are too small.** [observed]

- Footer links are 18px tall with 10px gaps. That's 12 targets under 24px.
- **Principle:** Fitts's Law, WCAG 2.5.8.
- **Fix:** a minimum 44px row height on touch.

**P2-5. Render-blocking third-party fonts.** [observed]

- The Google Fonts CSS loads 3 families and 11 static weights before first paint.
- Every visitor's IP goes to Google.
- **Fix:** self-host the variable WOFF2 files (Fontsource) and preload the two used above
  the fold.
- Lab LCP is already fast (about 0.3–0.45s on a fast connection), so this is resilience
  and privacy, not a rescue.

**P2-6. The sitemap is missing.** [observed]

- `robots.txt` advertises `/sitemap.xml`, which is a 404.

**P2-7. The docs describe the wrong deploy target.** [code vs observed]

- The README and `netlify.toml` describe Netlify. Production is Vercel.
- The contact form depends on Netlify Forms (see coverage gaps).

### P3: polish

- "Not a feed. A corkboard." contradicts the product, which ships a Social recap feed.
  "Every plan happens somewhere you can actually walk to" can't be verified.
- The four feature cards with badge tags repeat the headline claims without adding
  information. That's a Miller's Law chunking failure: eight near-identical blocks on
  mobile.
- The OG image still says "a small group, one plan, one day".

## 4. iOS reference: what carries over, and what doesn't

**Established patterns. These carry over.**

- **"Printed itinerary" voice.** The iOS font README calls it this directly: "think
  boarding pass / printed itinerary."
  - Geist Mono for titles, labels, times and buttons.
  - Display titles in lowercase.
  - Instrument Sans for reading.
- **Paper surfaces.**
  - Canvas `#F4F4F4`, white elevated cards (radius 20), sheets at radius 28.
  - Cool-charcoal shadows (`rgb(18,20,30)`), with dark-mode shadows at 55–78% black.
- **Ink primary actions.** Accents are highlights.
- **Category color lives on the content.** Stop orbs are category-filled circles with a
  white glyph and a `bead` shadow. Activity chips use a soft fill with category ink.
- **The itinerary grammar.** The single most recognizable element:
  - A time ("From 11:00 am") in mono.
  - A category chip.
  - The stop name in mono.
  - The venue and address in sans.
  - A **route thread** joining the orbs: solid ink in the detail view, dashed on the
    "THE PLAN" cover.
- **The "THE PLAN" cover:** a paper invitation with a "COVEY · THE PLAN" masthead, the
  title, a meta line, a hairline rule, the stops, "HOSTED BY", and a "TAP TO OPEN" tag.
- **The quail.** The App Store icon and the `CoveyMark` asset are a quail head in a
  pastel gradient. It's what people will see on their home screen, so the site should use
  it.
  - The README's "the app has no bird illustration" is out of date.
  - The five-dot cluster comes from the one-time opening animation. It stays as a small
    punctuation mark, not the logo.
- **Motion character:** "soft, fast, physical — no cartoony bouncing."
  - Card spring 0.45/0.86.
  - Staggered entrance: 10px rise, 40ms per item.
  - Exits faster than entrances.
  - Reduced motion handled centrally.

**Incidental in the app. Don't copy these; refine them.**

- Truncated meta and badges on cards ("1… · …", "Closes 2…"), and mis-tagged demo data
  (go-karting tagged "Dog walk").
- Four competing card styles: glass, grey `paper`, white, and one-off radius-18
  rectangles. The web uses one elevated-card style plus the sheet.
- Letter-spacing drifts between 0.8 and 2.4pt across labels. The web uses one eyebrow
  tracking (0.14em).
- Comments still call the accent "coral". The accent is matcha green `#112100`. On the
  web, accent-word emphasis uses `accentInk` (coffee), because green reads as black at
  display sizes on paper.
- The "featured" card gradient and `PlanDetailEntrance` are dead code. The itinerary
  gradient is therefore not an established visible pattern, so it isn't used as a
  background.

## 5. Brand direction: "The plan, printed"

Covey should feel like being handed a well-made plan by a friend.

- **Typography**
  - Geist Mono Variable (500/600) for display, section titles, eyebrows, times, chips and
    buttons.
  - Display is lowercase with −0.035em tracking at hero size.
  - Instrument Sans Variable for reading copy (17–19px, 1.6 line height).
  - Manrope stays confined to empty states, as in the app.
- **Palette**
  - Paper `#F4F4F4` and white cards.
  - Ink `#1C1C1E` for text and every primary button.
  - Coffee `#6F4E37` for accent words and links.
  - Matcha green for small brand moments: "going" counts and seat fills.
  - The nine category colors only on orbs, chips and route marks.
- **Spacing and rhythm.** The 8-pt scale. Sections at `clamp(4.5rem, 9vw, 8rem)`.
  Content width 72rem. Reading measure ≤ 36rem.
- **Cards**
  - Elevated: white, radius 20, `paper` shadow.
  - Featured: the plan cover and the demo, radius 28, `pinned` shadow.
  - Hairlines at 0.7px, as in the app.
- **Imagery**
  - Product UI rendered in HTML, so it is crisp, themeable and legible.
  - The quail, shown as the real app-icon tile. The bare `CoveyMark` crop reads as
    a cut-off shape without its tile.
  - No stock photos, and no invented people photos.
- **Icons.** Lucide outline glyphs, the closest open equivalent to SF Symbols, inlined as
  SVG at build time.
- **Motion**
  - One signature moment: the plan assembling in the hero.
  - A quiet layer: section rises, demo crossfades, press scale 0.97.
  - Nothing decorative loops.

## 6. Page narrative and copy

1. **Hero**
   - Eyebrow: "Small-group plans · San Francisco".
   - H1: "turn strangers into *friends*, one plan at a time."
   - Sub: "Covey is for adults in San Francisco who'd rather meet people by doing
     something. Join a small plan — a few stops, a few seats — and when it clicks, start a
     Covey and keep meeting up."
   - CTAs: **Join Covey** → signup; "See how a plan works" → the demo.
   - Micro: "Free · 18+ · On the web now, iOS by invite".
   - Visual: the "THE PLAN" example invitation, assembling on load.
2. **What people plan.** The app's own sample plans ("Trail run", "Gallery crawl", "Ramen
   run", …) as orb chips.
3. **Why once isn't enough**
   - Title: "one good night isn't a friendship."
   - A three-way contrast: big events, chat-first apps, Covey.
   - One cited statistic (Hall, 2019: about 50 hours to go from acquaintance to casual
     friend).
4. **How it works**
   - Title: "every plan is a small itinerary."
   - The interactive demo: three example plans × Itinerary/Map/Group.
   - Three steps: find or post; take a seat; show up together.
5. **The second hangout**
   - Title: "when it clicks, make it a covey."
   - The name definition and the quail.
   - A four-beat journey joined by the route thread: join → recap → start a Covey →
     meet every other week.
6. **Built for showing up.** Headcount set by the host, host approval, 18+ with
   verification, report and block, meet in public first.
7. **FAQ.** Six accurate answers.
8. **Close**
   - Title: "see you at the first stop."
   - CTAs: **Join Covey** and Sign in.

## 7. Motion spec

| Animation | Purpose | Trigger | Duration and easing | Reduced motion |
|---|---|---|---|---|
| Hero plan assembles | Shows what a plan is before any reading. Stops arrive in order along the thread. | First paint (CSS) | Card: 480ms rise `cubic-bezier(.22,1,.36,1)`. Stops: 60ms stagger starting at 180ms. Orbs pop with 1.35 overshoot. Thread draws over 700ms. Whole sequence ≤ 1.1s. | Final state, no motion |
| Demo view/plan change | Keeps spatial context when switching tabs or plans | Click, or arrow keys | 240ms crossfade with a 6px rise. Stops re-stagger at 30ms. | Instant swap |
| Section entrance | Paces the scroll without hiding content | IntersectionObserver, once | 420ms, 10px rise, 40ms child stagger (≤ 6) | Visible immediately |
| Covey journey thread | Continuity: one plan becomes a habit | Section enters | 900ms thread draw. Beats stagger at 90ms. | Static |
| Hover and press | Affordance and feedback | Pointer or keyboard | 2px lift / 0.97 press at 220ms `snappy` | Color and shadow only |

Every animation runs from CSS, with the final state as the base style wherever possible.
If JavaScript fails, content is never left invisible.

## 8. Follow-up decisions (not done here)

- **Contact form on Vercel.** Verify one real submission in production. If Netlify Forms
  isn't wired, move the form to a Vercel-compatible backend (a Supabase edge function or
  Formspree), or temporarily replace it with `mailto:`.
- **covey-web:** point `marketingWaitlistUrl` at the product's own `/login` and drop the
  "waitlist" wording.
- **Tokens drift.** iOS `moss` is `#329062` and `inkMuted` is `#636368`; `tokens.json`
  mirrors covey-web (`#3DB078`, `#6B6B70`). Decide on a source and reconcile across all
  three repos.
- **Real imagery.** Once there are consented photos from real plans, a recap strip would
  do more than any illustration.
- **App Store badge.** Add it when `appStoreUrl` exists. Until then the primary action is
  web signup.

## 9. Verification (2026-09-26, branch `redesign/strangers-to-friends`)

**Gates**

- `npx astro check`: 0 errors, 0 warnings, 0 hints.
- `npm run tokens:check`: up to date.
- `npm run build`: 15 pages.
- `npx playwright test`: **865/865 passed** across Chromium, Firefox, WebKit, Pixel 7
  and iPhone 14.
  - The suite includes the new `tests/landing.spec.ts`, which covers the desktop
    hamburger, CTA destinations, `/signup`, the "no waitlist" copy, the group-size
    claims, demo tabs and keyboard, demo join and undo, and reduced motion.
  - The last touch-target and heading tweaks came after that run. The landing, a11y,
    smoke and theme specs were re-run on Chromium and iPhone 14 afterwards: all passed.

**axe (WCAG 2.0/2.1/2.2 A and AA), after scrolling and settling**

- 0 violations on `/`, `/about`, `/contact`, `/events`, `/testimonials`, `/support`,
  `/privacy` and `/terms`, at 390 and 1440px, in light and dark.
- **Before:** home failed `color-contrast` (clay numerals, 3.3:1) and
  `scrollable-region-focusable` (the category rail). `/privacy` failed
  `scrollable-region-focusable` on its 3 tables. That one predated this work and is now
  fixed at build time. The legal text is byte-identical to live.

**Overflow.** None on any route at the 12 widths from 320 to 1920px.

**Keyboard**

- The tab order runs skip link → logo → nav → theme → Sign in → Join → hero CTAs → "Open
  the plan" → demo.
- Focus rings are visible (coffee in light mode, matcha in dark).
- Demo tabs follow the WAI-ARIA pattern: arrows, Home and End.
- The desktop hamburger no longer receives focus.

**Reduced motion.** The first frame (80ms after DOMContentLoaded) shows the complete hero.
No element sits below opacity 1.

**Lab performance.** Chromium on this machine, throttled to about 1.6 Mbps down,
750 kbps up, and 4× CPU. Median of 3 runs, cold cache. LCP was measured before any
scrolling.

| | Live `/` (Vercel CDN) | Redesign `/` (`astro preview`, localhost) |
|---|---|---|
| FCP, 390px | 700 ms | **532 ms** |
| LCP, 390px | 1,108 ms | **776 ms** |
| FCP, 1440px | 704 ms | **540 ms** |
| LCP, 1440px | 1,116 ms | **800 ms** |
| CLS | 0 | 0 |
| Transfer | 111 KB (4 hosts) | 125 KB (1 host + product links) |
| JS | 34 KB | 33 KB |

**Caveats on the performance numbers**

- The redesign was served from localhost (TTFB ~4ms). Live came from the CDN (TTFB
  ~90ms). Adding ~90ms to the redesign's figures still leaves it ahead.
- The gains come from inlining CSS (one fewer render-blocking round trip) and
  self-hosting fonts (no third-party font CSS).
- These are lab numbers. No real-user (CrUX or RUM) data was available.

**Page length.** At 390px, home grew from 7,612px to about 10,270px. The old page was
shorter but repeated itself: the same card twice, empty-state teasers, and a name story
ahead of the product. The new length is the interactive demo and the Coveys section. If
analytics show drop-off, the "extras" row and the Covey card are the first candidates to
trim on phones.

## 10. Decisions and revisions (2026-09-26, same day)

- **CTA destination:** keep `go.coveyapp.co/login` (owner's call). `joinUrl`, the
  `/signup` and `/waitlist` redirects, and the tests were updated. The closing CTA drops
  its duplicate "Sign in" button.
- **Canonical origin:** `https://www.coveyapp.co`. This affects `SITE.url`, `site` in
  `astro.config.mjs`, and the `robots.txt` sitemap line. Canonical and `og:url` no longer
  point at a URL that redirects.
- **Contact form:** the owner will test Netlify Forms separately.
- **Mobile length:** home at 390px is down from 10,204px to 8,566px, against 7,612px
  before the redesign. Desktop is unchanged. Phone-only changes:
  - The hero card uses the feed-card form (title, stop orbs, meta, going). The demo one
    scroll below opens the full itinerary, the way tapping a card does in the app.
  - Six sample plans instead of nine.
  - Tighter spacing in the Why section, the steps and the journey.
  - The demo drops the host row and neighbourhood line.
  - The journey hides its tag chips.
  - The secondary-features row shows from 768px up.
  - Safety items become a divided list instead of cards.
  - The footer's legal links sit two-up.
  - Phone section padding is 48px instead of 60px.

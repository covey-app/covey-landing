# Redesign, October 2026 — "a small flock in a big city"

The second pass on coveyapp.co this month. The first pass (docs/waitlist.md)
turned the site into a waitlist funnel. This one turns it into a brand: a
multi-page site with a character system, real motion, an editorial newsletter,
and an activities directory, while keeping the waitlist effortless.

## 1. Audit — what was wrong

| Area | Problem |
|---|---|
| Mascot | The app-icon quail did everything: logo, hero, closing section, success state, confirmation page. Clip art, not a character |
| Hero | The app icon blown up into a white tile with category dots around it. It read as an icon placed in a layout, not a designed moment |
| CTAs | Five "Join the waitlist" moments on one page (header, hero form, mid-page, closing form, mobile menu). Promotional, and it devalued the action |
| Architecture | One long page carried everything: product demo, Coveys, safety, FAQ, CTA. There was no reason to go anywhere else |
| Motion | One signature moment, and the rest quiet. Nothing a visitor would remember |
| Newsletter/activities | Didn't exist, though the team is already planning weekly Instagram content (the Social Media Manager sheet) |

## 2. What the design system actually contains

Found by searching the repos, git history, Figma, Drive, and Downloads:

| Asset | Source | Used for |
|---|---|---|
| **Primary mark**: the app-icon quail | covey-ios `AppIcon` | Header, footer, favicon, OG image. **Nowhere else** |
| **Quinn**: full body, 5-view turnaround + line art | `Downloads/COVEYcharacter-dev/QUINNversions.ai` (artboard 8) | Hero protagonist, About ("meet quinn") |
| **Quinn's 7 expressions** × 2 palettes | same file, artboards 9–10 | Waitlist reactions (`QuinnFace`) |
| **Nine category quails** (flat, one per activity category) | covey-ios `OnboardingBird*`, restored from git history (`c3f89703`) | Hero cast, How-it-works stage, Activities parade, pick cards, waitlist celebration. Filters and listing rows use the app's category glyphs instead (`src/lib/categories.ts`) |
| Category palette, Geist Mono / Instrument Sans, paper/ink, matcha + coffee | existing tokens | Everything |

The art was rendered from the vector `.ai` at 300dpi (its gradients are
Illustrator freeform meshes, which SVG can't express), cut per figure, and
encoded as WebP at two sizes (`public/brand/quinn/`, `public/brand/flock/`).
Nothing was redrawn or invented.

**Not found:** California poppy or toyon artwork, or any other "supporting
illustrations". They aren't in any repo, Figma file, Drive, or Downloads, so
none were drawn. The California connection is made truthfully instead: the
California quail is the state bird and lives in coveys (About page). If poppy
or toyon art exists, it has natural homes: the Activities band and the
newsletter masthead.

The character's name comes from the source file (`QUINN…`). It appears only on
the About page ("meet quinn"). Change it there if the name isn't final.

## 3. Creative direction

**"A small flock in a big city."** Keep Covey's printed-itinerary voice
(lowercase Geist Mono, paper, ink, category color) and push the execution:

- **Editorial scale.** `t-mega` (up to ~11rem) for one statement per page,
  type layered with characters, full-bleed color fields.
- **A cast, not clip art.** Quinn is the protagonist. The category quails are
  the flock, each doing its own thing. The primary mark only identifies the
  brand.
- **Rooms.** Each page sets `data-page` and gets its own ground:
  Home on paper with color bursts, **Waitlist in deep matcha** (the brand accent
  as a whole room), **Newsletter as warm newsprint** with a masthead red,
  **Activities in pale SF-sky blue** (bright, and every category quail reads against it), **About in sun-warmed clay** with a
  green "roots" band. Same type, components, and motion everywhere, so it
  reads as one house.
- **Rhythm.** Big moments (hero, problem, how-it-works, waitlist welcome)
  alternate with calm reading sections. Motion follows the visitor: pointer
  and scroll drive it, and nothing loops forever (WCAG 2.2.2).

## 4. Information architecture

| Route | Job | Primary action | Secondary |
|---|---|---|---|
| `/` | What Covey is, why it exists, how it's different | Waitlist (header + hero only) | Newsletter, activities |
| `/waitlist` | The signup, as an experience | Waitlist form | Newsletter (one line) |
| `/newsletter` | Covey Weekly: editorial home, latest picks, archive | Subscribe | Activities, about |
| `/newsletter/<week>` | One edition: Top Picks, then the complete guide | Subscribe | Previous / next edition |
| `/activities` | The two-week directory, filterable | Browse (filters) | Subscribe |
| `/about` | Mission, California roots, Quinn, principles, safety, FAQ | (none; nav has the CTA) | Contact |

Navigation: three destinations plus one action (header). On phones, a
full-screen menu with oversized type. The current page carries a marker with a
shared view-transition name, so it glides between links. Page transitions:
the old page fades out quickly, the new one rises in. `/events` redirects to
`/activities`. The FAQ, safety detail, and Coveys explanation moved off the
home page into About and the how-it-works story.

**Waitlist CTAs on the home page: two** (header + hero), both linking to
`/waitlist`. The mobile-menu CTA is the header's on phones. Footer and empty
states use plain text links. Enforced by `tests/landing.spec.ts`.

## 5. Motion map

| Moment | What happens | Driver |
|---|---|---|
| Hero entrance (once per session) | Words rise out of masks; Quinn appears facing away; the flock flies in from the edges; Quinn turns (side, then "hello" with open beak, then front) | CSS + 3 view swaps |
| Hero, after | Quinn turns toward the pointer; the flock drifts with pointer depth; scrolling away gathers the flock around Quinn | pointer (`data-pointer`), scroll (`--p`) |
| Problem | Pinned band; three beats light up in turn, then the 50-hours fact, then the answer | scroll, pinned (`data-progress="pin"`) |
| How it works | Sticky stage re-composes per step: scattered → seated → a covey | IntersectionObserver |
| Waitlist | Headline rises; card lifts; Quinn peeks over it. Quinn reacts: focus "oh", typing content, invalid skeptical, submitting focused, joined laughing while the flock springs up around the card, already-on-list unimpressed | CSS + form events |
| Newsletter | Masthead quail settles in; pick cards lift and tilt on hover | CSS |
| Activities | The flock parades across the band | scroll (`--p`) |
| About | Quinn turns through the turnaround (front → right → back → left) | scroll, pinned |
| Micro | CTA arrow hand-off, arrow-link nudge, chip press, nav marker glide, page rise | CSS |

Engine: `src/lib/motion.ts`, with one passive scroll listener, at most one rAF
per frame, and measurement only for elements near the screen. Transforms and
opacity only (the waitlist cheer and How-stage use transforms in container
units). Under reduced motion: no entrance, no pinning, no parallax, final
frames everywhere, and view and mood swaps without tweening. No-JS gets the
final frames.

## 6. Engineering notes

- **Content**: `src/content.config.ts` plus `src/lib/guide.ts`. One activity
  file feeds the directory, every edition it belongs to, and the email. See
  `docs/content.md`.
- **Newsletter backend**: `newsletter_subscribers`, double opt-in,
  RFC 8058 one-click unsubscribe. Separate from the waitlist in table, consent,
  and endpoint. See `docs/content.md` §4.
- **Astro `checkOrigin` is off**, because it refuses origin-less POSTs, which
  is how mail providers send one-click unsubscribes. The signup endpoints
  enforce origin themselves (`isCrossSiteForm`, unit- and e2e-tested).
- **Preview = production routing.** `scripts/preview.mjs` follows
  `.vercel/output/config.json` and runs the built Vercel function for dynamic
  routes, so `npm run preview` and Playwright exercise the real server pages.
- **Real content only.** The fictional sample set is gone; everything builds
  from `content/live` (first edition: the weekend of Oct 17–18, 2026).
  Playwright pins `COVEY_TODAY=2026-10-14` and `?today=`, and mocks
  `/api/weather`, so the suite doesn't depend on the day or the forecast.
- **Weather plans** (`WeatherPlans.astro`, `/api/weather`): the NWS 7-day
  forecast for SF, proxied and CDN-cached so visitors' IPs never reach a third
  party; each upcoming day gets an idea that suits it (`src/lib/weather/
  ideas.ts`: soup night when it's cold or wet, read in the park when it's
  sunny, Lands End when it's foggy) plus a listing that day that suits it.
  Without a forecast, the weather-proof ideas in the HTML stay.
- **Activities vs. the newsletter.** `/activities` is the utility view:
  compact rows, filters, two weeks, the weather strip. An edition is the
  curated view: editor's note, weather plan for its days, Top Picks with
  "know before you go" tips, ready-made plans (listings strung into an
  outing, drawn like plans in the app), quick lists (free, outside, after
  dark), and the complete guide by day and part of day with addresses,
  prices, tips, and every link.

## 7. Verification

- `npm run test:unit` covers 40 handler cases. `npm run test:db` covers both
  migrations against throwaway Postgres. `npx astro check` reports 0 errors.
- Playwright: 1,235 tests across Chromium, Firefox, WebKit, Pixel 7, and
  iPhone 14. They cover navigation, CTA limits, the hero acceptance criteria,
  waitlist states and Quinn's moods, newsletter states, confirm/unsubscribe,
  guide filters, past-day hiding, overflow at 12 widths on every route, and axe
  (WCAG 2 A/AA) on every route plus the waitlist error and success states in
  both themes.
- Reviewed by screenshot at 1440 and 390 in light and dark, at scroll
  positions through every page.

## 8. Open items

- **Privacy policy**: the redraft must cover the waitlist (docs/waitlist.md
  §3.1), **plus Covey Weekly**: email, consent record, attribution, Resend
  delivery, and retention until unsubscribe. Legal text isn't edited from this
  branch.
- **Commercial-email footer**: CAN-SPAM requires a physical postal address in
  every edition. `SITE` has none; add one to `src/config.ts` and the email
  template before the first send.
- **Listings**: the first 20 came from the team's Oct 17–18 list (sources
  linked; `verifiedAt` 2026-10-14). Keep filling the Social Media Manager sheet
  and importing (docs/content.md §2).
- **Poppy and toyon art**: not found; see §2.
- **Quinn's name**: taken from the source file; confirm it.

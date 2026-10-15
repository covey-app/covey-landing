# Weekly content: activities, editions, and sending Covey Weekly

One activity is entered once and used everywhere: the `/activities`
directory, each newsletter edition it falls in, the email, and (by its
`sheetId`) the row in the Social Media Manager sheet the Instagram posts are
planned from.

```
Social Media Manager sheet ──export CSV──▶ scripts/content/import-sheet.mjs
                                                   │
                                                   ▼
                         content/live/activities/*.md   content/live/editions/YYYY-MM-DD.md
                                   │                              │
                     ┌─────────────┼──────────────────┬───────────┘
                     ▼             ▼                  ▼
               /activities   /newsletter/<week>   /newsletter/<week>/email/ ──▶ send-edition.mjs ──▶ Resend
```

## 1. The files

### Activities: `content/live/activities/<anything>.md` (frontmatter only)

| Field | Required | Notes |
|---|---|---|
| `title` | yes | ≤ 90 chars |
| `kind` | yes | `event` (dated) or `place` (worth going any week) |
| `category` | yes | `food` `outdoors` `sports` `arts` `culture` `media` `nightlife` `fashion` `professional` |
| `activity` | | e.g. "Run club" (the sheet's Activity) |
| `venue`, `neighborhood` | yes | Public places; for events at businesses, as the organizer lists them |
| `address` | | |
| `date`, `endDate` | events | `YYYY-MM-DD`; multi-day events use `endDate` |
| `days` | places | e.g. `[sat, sun]`. When it makes sense to go |
| `time`, `endTime` | | 24h `HH:MM` |
| `priceMin`, `priceMax` | | USD per person; `0` is free; omit if unknown |
| `priceNote` | | Overrides the label ("Pay what you can") |
| `summary` | yes | 10–240 chars. One plain sentence or two |
| `source` | yes | `{ url, name }`. The organizer's page. **Every listing links out** |
| `tags` | | `after-work` `weekend` `free` `solo-friendly` `reservation` `outdoors` `all-ages`. `outdoors` also drives the weather plans (outside listings on nice days, inside ones when it's wet) |
| `tips` | | Up to 3 "know before you go" lines: RSVPs, age limits, codes, conflicting listings. Shown in editions, not on /activities |
| `links` | | Up to 3 more `{ url, name }` (an Instagram post, a ticket page) |
| `editions` | places | Edition slugs a place appears in (events join by date) |
| `sheetId` | | `EVT-001` / `LOC-001` from the sheet |
| `verifiedAt` | yes | The date someone checked the details at the source |
| `status` | | `published` (default) or `draft` |

### Editions: `content/live/editions/<Monday YYYY-MM-DD>.md`

```yaml
---
title: "Vampires, vintage cars, and Market Street after dark"
weekOf: "2026-10-12"        # the Monday of the week it covers
publishedAt: "2026-10-14"
dek: "One or two sentences for cards and the email preheader."
picks:                      # 1–6, in order (an even count lays out best)
  - activity: potrero-hill-rnb-festival   # an activity's file name, without .md
    why: "Why we'd go. 10–320 chars."
plans:                      # 0–3 ready-made plans, 2–4 stops each
  - title: "Saturday on the west side"
    for: "Early risers"       # who it's for
    note: "Why these fit together. 10–240 chars."
    stops: [sf-old-car-picnic, secondhand-saturday, international-vampire-film-festival]
---

The editor's note: a short paragraph or two of Markdown. It opens the web
edition and the email. Optional.
```

What makes an edition more than /activities: the note, the weather plan for
its days (automatic), Top Picks with tips, the plans, quick lists (free,
outside, after dark; automatic), and the guide by day and part of day with
every address, price, tip, and link.

The **complete guide** is computed: every published `event` dated in that
Monday–Sunday, plus every `place` that lists the edition in `editions`. Top
Picks are a curated subset and also appear, badged, in the guide.

Rules the schema enforces: required fields, formats, events need a date, and
places need days or an edition. Rules it can't enforce, so keep them yourself:
no listing without a working source link, no prices or times that didn't come
from the source, and **never claim the guide covers everything in the city**
(the pages already say so).

## 2. From the sheet

1. In the Social Media Manager sheet, fill the **Events** (or **Location
   Bank**) row completely: name, venue, neighborhood, dates and time, price,
   source link, category, **Last verified**, and a one-line **Notes / hook**
   (the summary).
2. File → Download → CSV (for that tab).
3. Import:
   ```bash
   npm run content:import -- ~/Downloads/events.csv          # writes content/live/activities/
   npm run content:import -- ~/Downloads/events.csv --dry-run
   ```
   Rows missing anything are skipped with the reason. Existing files are kept
   unless `--force`. Category names map from the sheet's taxonomy (Shopping →
   `fashion`, Culture & Sightseeing → `culture`, and so on).
4. Write the edition file and pick 2–5 Top Picks.
5. `npm run check` (schema) → `npm run build` → commit → deploy.

The site is static. A new edition goes live when it's deployed, and
`/activities` covers the two weeks from the build date (past days hide
themselves in the visitor's browser). Deploy at least weekly.

## 3. Previewing

```bash
npm run dev                                  # http://localhost:4321
COVEY_TODAY=2026-10-14 npm run build         # build as if it were that day
```
Add `?today=YYYY-MM-DD` to /activities or an edition to see it as of that
day in the browser (past days and the weather cards follow it).

## 3a. Weather plans

`/api/weather` proxies the National Weather Service forecast for downtown SF
(public domain, no key) and the CDN caches it for 30 minutes. The ideas are in
`src/lib/weather/ideas.ts`, grouped by kind of day (wet, cold, grey, sunny,
warm, hot, windy). They're evergreen suggestions, never listings, so edit them
freely: keep them small-group, cheap, and true to the city.

## 4. The newsletter: subscriptions, consent, sending

**Subscribing** (`/api/newsletter`, `NewsletterForm.astro`): email plus explicit
consent to `NEWSLETTER_CONSENT_TEXT` (`src/lib/newsletter/consent.ts`). The
server stores that exact sentence and a timestamp with the subscription. It's
**double opt-in**: the row is `pending` until the emailed link is used.
Separate from the waitlist in table, endpoint, and consent; neither signs you
up for the other.

**Confirming** (`/newsletter/confirm/?token=…`): a GET only shows a "Confirm"
button (mail scanners prefetch links), and the POST confirms. Links last seven
days.

**Unsubscribing** (`/newsletter/unsubscribe/?token=<uuid>`): a GET shows a
button, and a POST unsubscribes. That includes the RFC 8058 one-click POST
that Gmail and Yahoo send from the `List-Unsubscribe` header. Idempotent.

**Sending an edition:**
```bash
npm run build                                   # renders /newsletter/<week>/email/
npm run newsletter:send -- 2026-10-12           # dry run: counts recipients, writes .vercel/newsletter-preview-*.html
npm run newsletter:send -- 2026-10-12 --to you@coveyapp.co   # one test email
npm run newsletter:send -- 2026-10-12 --send --yes           # every confirmed subscriber
```
The email is built from the same content as the web edition. Each recipient
gets their own unsubscribe link plus one-click headers. Recipients are paged
500 at a time and sent via Resend's batch API, 100 per call, with idempotency
keys so a re-run doesn't double-send a batch. Needs `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `NEWSLETTER_EMAIL_FROM`.

**Before the first send:**
- Add a **physical postal address** to the email footer (CAN-SPAM);
  `src/pages/newsletter/[slug]/email.astro` has a slot after "Covey · San
  Francisco".
- Verify the sending domain in Resend; ideally use a separate subdomain from
  the app's alerts.
- Privacy policy: add Covey Weekly (docs/redesign-2026-10.md §8).
- Apply `db/migrations/20261014130000_newsletter_subscribers.sql` (same steps
  as the waitlist migration, docs/waitlist.md §3.2).

**Subscriber management** (Supabase SQL editor):
```sql
select status, count(*) from newsletter_subscribers group by 1;
select date_trunc('week', confirmed_at) as week, count(*) from newsletter_subscribers where status = 'subscribed' group by 1 order by 1 desc;
select coalesce(utm_source, '(none)'), count(*) from newsletter_subscribers group by 1 order by 2 desc;
-- Remove someone on request (unsubscribing is the normal path):
update newsletter_subscribers set status = 'unsubscribed' where email = lower(trim('person@example.com'));
delete from newsletter_subscribers where email = lower(trim('person@example.com'));
```

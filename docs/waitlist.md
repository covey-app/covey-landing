# Waitlist — architecture, operations, and launch checklist

Pre-launch, every primary CTA on coveyapp.co is **Join the waitlist** (product
decision, 2026-10-14). This doc covers how signups are stored and protected, how
the team reads and exports them, how conversion is measured, the opening
animation, and exactly what has to happen before it goes live.

`go.coveyapp.co` (covey-web) is untouched and keeps working. "Sign in" in the
header, mobile menu, and footer still goes there for existing members.

---

## 1. How it fits together

```
Browser (WaitlistForm.astro)
  │  POST /api/waitlist  {email, source, utm_*, referrer, landing_path, wl_check, elapsed_ms}
  ▼
Vercel Function  (src/pages/api/waitlist.ts → src/lib/waitlist/handler.ts)
  │  validate · honeypot · timing trap · per-instance limit · HMAC(ip) client key
  │  POST {SUPABASE_URL}/rest/v1/rpc/waitlist_join   (service-role key, server only)
  ▼
Supabase Postgres  (db/migrations/20261014120000_waitlist_signups.sql)
     waitlist_join()       SECURITY DEFINER, service_role only
       ├─ rate window: 8 attempts / 10 min per client key
       └─ INSERT … ON CONFLICT (email) DO NOTHING → created | existing
  │
  └─ optional: Resend confirmation email (only for "created")
```

- **Pages stay static.** `@astrojs/vercel` is there for one on-demand route; every
  page is still prerendered HTML.
- **One form, one place.** `WaitlistForm.astro` lives on the dedicated
  `/waitlist` page (redesign, docs/redesign-2026-10.md §4). The home page has
  two waitlist CTAs, header and hero, both linking there. The mobile menu, the
  footer, and empty states link there too. `/signup` 307s to `/waitlist`, so
  covey-web's "Join the waitlist" links land on it.
- **Without JavaScript** the form is a native POST. The endpoint answers with a
  303 to `/waitlist/joined/`, or back to `/waitlist/#invalid-email` /
  `/waitlist/#try-again`, where a `:target` message appears.

### Responses

| Situation | JSON | No-JS redirect | Visitor sees |
|---|---|---|---|
| New signup | `201 {ok, result:"created", followupToken}` | `/waitlist/joined/` | "you're on the list!" + optional city chips |
| Already on the list | `200 {ok, result:"existing"}` | `/waitlist/joined/` | "you're already on the list." |
| Bad email | `422 invalid_email` | `#invalid-email` | Inline error; email kept |
| Rate limited | `429 rate_limited` | `#try-again` | "Too many tries…" |
| Database/network failure | `502 unavailable` | `#try-again` | "We couldn't save that…"; email kept |
| Env vars missing | `503 not_configured` | `#try-again` | Same. **Never a fake success**, and the log says which var is missing |
| Honeypot filled, submitted <1.2s after load, or JSON without the timing field | Identical to a new signup (`201`, decoy token), **not stored** | — | Success (so bots learn nothing) |

Duplicate signups get a distinct "already on the list" message, as the brief
asked. The trade-off: someone can learn whether an address is on the list.
That's low-sensitivity for a waitlist, and the rate limits bound it. If you'd
rather not reveal it, make the `existing` branch in `handler.ts` return the same
body as `created` (without a token).

---

## 2. Data model

`public.waitlist_signups`, deliberately separate from every app table:

| Column | Notes |
|---|---|
| `id` | uuid |
| `email` | Trimmed + lower-cased; `CHECK` enforces it, unique index enforces one row per address. No Gmail dot/plus folding (those are real, distinct mailboxes) |
| `status` | `waiting` (default) · `invited` · `joined` · `removed` |
| `city` | `san-francisco` · `davis` · `other` · null. Optional, asked after signup |
| `source` | Which surface: `landing:page` (the /waitlist form) or `landing:nojs`. `hero`/`closing` remain valid for any future placement |
| `utm_source` … `utm_term` | From the visit's landing URL |
| `referrer` | External referrer, origin + path only (no query string) |
| `landing_path` | First page of the visit on coveyapp.co |
| `created_at`, `updated_at` | Automatic (`updated_at` via trigger) |
| `invited_at`, `joined_at` | Stamped automatically the first time `status` becomes `invited` / `joined` |
| `followup_token_hash`, `followup_expires_at` | SHA-256 of the one-time token for the city step; 1-hour life; pruned |

`public.waitlist_rate_limits` holds `(client_key, window_started_at, request_count)`.
`client_key` is an HMAC of the IP (keyed with the service key), never the IP
itself. Every signup call deletes rows older than a day.

**Why a migration in this repo and not in `covey/supabase`?** The landing site
shouldn't change the app's migration chain from here, and `supabase db push` from
this repo would fight the project's history. The file is ready to be copied into
`covey/supabase/migrations/` (the canonical directory) when convenient. It
touches no existing object.

### Security model

- RLS is on for both tables, with **no policies**, and every grant is revoked from
  `PUBLIC`, `anon`, and `authenticated` (overriding Supabase's default
  privileges). The anon key, which ships in covey-web, cannot read, count, insert,
  update, or delete a single row through PostgREST or GraphQL.
- The only write paths are two `SECURITY DEFINER` functions with an empty
  `search_path` and schema-qualified names, executable by `service_role` only.
- Existing rows are never modified by a signup, so a second submission can't
  overwrite someone's attribution, city, or status.
- The city follow-up needs a 32-byte random token that's returned only to the
  browser that created the row. Only its hash is stored, and it expires after
  an hour. An "existing" response never gets one. Nobody can edit a row they
  didn't create.
- The service-role key lives only in Vercel's server environment, read at
  request time through `astro:env/server`. It is never inlined into a bundle and
  never sent to the browser.
- Raw emails and IPs are never logged. Function logs are one JSON line per event
  (`waitlist.created`, `waitlist.existing`, `waitlist.rate_limited`, …).

Verified by `db/tests/waitlist_signups.test.sql`, and over HTTP against PostgREST
(anonymous reads, inserts, RPC calls, and rate-limit-table reads all return
`42501 permission denied`).

---

## 3. Deployment checklist

Do these in order. Nothing here has been applied to a real project yet.

### 3.1 Before anything ships — privacy policy (blocker)

The current policy (v2026-09-01) describes a waitlist that collects "first name,
city, and your confirmation that you are eighteen" and lists Netlify. The pending
redraft (v2026-10-15, PR "Legal 2026-10-15 redraft…") says the site has **no
sign-up form**, writes **only** `covey-theme` to storage, and uses **no
analytics**. This launch contradicts all three. Have counsel fold the following
into the redraft. Legal text is authoritative, and its version is pinned in the
iOS app and a migration, so it isn't edited from this branch.

- **§4.14 Website information** — proposed: *"The website at www.coveyapp.co
  offers a waitlist. If you join it, Covey collects your email address and,
  if you choose to tell us, the city where you would use Covey (San Francisco,
  Davis, or elsewhere). With your signup Covey records which page of the
  website you joined from, the campaign parameters in the link that brought you
  there (utm_source, utm_medium, utm_campaign, utm_content, utm_term), and the
  address of the external page that referred you, without its query string. To
  prevent abuse, Covey derives a one-way keyed hash from your IP address, which
  it keeps for about a day; it does not store the IP address itself."*
- **§5 Purposes** — waitlist email is used to tell you when Covey is available to
  you and about Covey's launch, and to plan which cities to open next.
- **§12.1 storage** — add `covey-attribution` (sessionStorage; the campaign
  details above, kept only until the tab closes, and sent only if you join the
  waitlist) and `covey-intro-v1` (localStorage; remembers that the opening
  animation has played).
- **§12.4** — replace "no … third-party analytics" with a description of
  **Vercel Web Analytics**: cookieless, no cross-site tracking, aggregate page
  views and named events with no email or account data. Or drop analytics
  (see §5) and keep the sentence.
- **Annex B** — Vercel: add *"server functions processing waitlist submissions;
  web analytics"* and *"email address and campaign details submitted to the
  waitlist; page-view information"*. Supabase already covers storage. If the
  confirmation email is enabled, Resend: add *"delivery of the waitlist
  confirmation email — email address"*.
- **Annex C** — add *"Waitlist signups: until Covey launches in your area and you
  have been invited, or until you ask us to delete it, and in any case no more
  than 24 months after signup"* (or whatever counsel prefers). Add *"rate-limit
  keys: one day"*.
- **Launch emails are commercial email.** Under CAN-SPAM, the invite emails need
  a working unsubscribe and a physical postal address. The on-page copy promises
  "Unsubscribe anytime"; deletion currently happens by emailing hello@ (see
  §4.4).

### 3.2 Database

1. Copy `db/migrations/20261014120000_waitlist_signups.sql` into
   `covey/supabase/migrations/` and apply it the way that repo deploys, or paste
   it once into the Supabase SQL editor for the production project.
2. Check it:
   ```sql
   select has_table_privilege('anon', 'public.waitlist_signups', 'select');   -- false
   select has_function_privilege('anon', 'public.waitlist_join(text,text,text,text,text,text,text,text,text,text,text)', 'execute'); -- false
   ```
3. If `pg_graphql` is enabled, nothing extra is needed: it honours the same grants.

### 3.3 Vercel environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, scoped to
**Production**, and mark the keys **Sensitive**:

| Variable | Value | Required |
|---|---|---|
| `SUPABASE_URL` | The project's API URL (covey-web uses `https://api.coveyapp.co`) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **Mint a dedicated `sb_secret_…` key for this project** (Supabase → Settings → API keys) so the marketing site's access can be revoked without touching the apps. The legacy `service_role` JWT also works | Yes |
| `RESEND_API_KEY` | Resend API key, for the optional confirmation email | No |
| `WAITLIST_EMAIL_FROM` | e.g. `Covey <hello@coveyapp.co>`, on a domain verified in Resend | No (both or neither) |

Don't give **Preview** deployments the production key, or test signups land in
the real table. Without it, previews answer `503 not_configured` and the form
shows its retry message, which is the correct, honest behaviour. To exercise
previews for real, point them at a Supabase branch or a staging project.

The build itself needs no secrets. A fresh clone builds and runs without them.

### 3.4 Analytics

Enable **Web Analytics** in the Vercel project (Analytics tab). The script is
emitted only on Vercel builds (`VERCEL=1`). Custom events (CTA clicks, submits,
signups) require a plan that includes custom events (Pro or above); page views
work on every plan.

After applying the migration, also confirm the realtime publication doesn't
publish every table (`select puballtables from pg_publication;` should be false
for `supabase_realtime`). Even if it did, the revoked grants block delivery to
API roles.

### 3.5 Deploy and verify

1. Merge; Vercel builds with the `@astrojs/vercel` adapter. Build output is
   `.vercel/output`, which Vercel picks up automatically; no project setting
   changes are needed.
2. On production: join with a real address you control. Check the row exists in
   the Supabase table editor with `source = landing:page`. Join again and confirm
   you see "already on the list". Tap a city and confirm `city` updates.
3. Visit `https://www.coveyapp.co/?utm_source=test&utm_campaign=checklist`, sign
   up with another address, and confirm the UTM columns.
4. Check Vercel → Logs for `waitlist.created` lines with no email in them.
5. `curl -I https://www.coveyapp.co/signup` should be a 307 to `/waitlist`.
6. Delete your test rows (§4.4).

### 3.6 Optional: confirmation email (recommended: launch with it off)

Anyone can submit any address, so turning this on lets a script with many IPs
make Covey send one email to each of a list of scraped addresses. Bounces and
complaints would count against the sending domain, which report-notify also
uses. Each address can only ever get one, so nobody can be flooded. If you
enable it, use a separate sending subdomain (e.g. `mail.coveyapp.co`) with its
own Resend key, and consider Turnstile first (§8).

Set both Resend variables. The email is short and transactional (subject:
"You're on the Covey waitlist"), replies go to hello@, it carries a
`List-Unsubscribe` header, and it's sent at most once per address: only a
brand-new signup triggers it, so re-submitting someone's email can't mail them
twice. A failed send is logged (`waitlist.confirmation_email {sent:false}`) and
never fails the signup.

---

## 4. Operating the waitlist

Team members with access to the Supabase project use the **Table editor** (filter,
sort, export CSV) or the **SQL editor** (runs as `postgres`). There is no public
admin page by design.

### 4.1 Totals and growth

```sql
select count(*) as signups,
       count(*) filter (where status = 'waiting') as waiting,
       count(*) filter (where status = 'invited') as invited,
       count(*) filter (where status = 'joined')  as joined
from waitlist_signups where status <> 'removed';

select date_trunc('day', created_at at time zone 'America/Los_Angeles') as day, count(*)
from waitlist_signups group by 1 order by 1 desc;
```

### 4.2 Sources, campaigns, cities

```sql
-- Campaign performance
select coalesce(utm_source, '(none)') as utm_source, coalesce(utm_campaign, '(none)') as campaign, count(*)
from waitlist_signups group by 1, 2 order by 3 desc;

-- Referring sites when there was no UTM
select coalesce(split_part(referrer, '/', 3), '(direct)') as referrer_host, count(*)
from waitlist_signups where utm_source is null group by 1 order by 2 desc;

-- Which form converts
select source, count(*) from waitlist_signups group by 1 order by 2 desc;

-- Launch-market interest
select coalesce(city, '(not answered)') as city, count(*) from waitlist_signups group by 1 order by 2 desc;
```

### 4.3 Export to CSV

- Table editor → `waitlist_signups` → filter as needed → **Export → CSV**, or
- SQL editor → run a query → **Download CSV**, or
- `psql "$DATABASE_URL" -c "\copy (select email, city, status, created_at, utm_source, utm_campaign from waitlist_signups where status = 'waiting' order by created_at) to 'waitlist.csv' csv header"`

Treat exports as personal data: keep them out of shared drives and delete them
when you're done.

### 4.4 Inviting, joining, removing

```sql
-- Invite the first 200 people in San Francisco (invited_at is stamped automatically)
update waitlist_signups set status = 'invited'
where id in (select id from waitlist_signups
             where status = 'waiting' and city in ('san-francisco') order by created_at limit 200)
returning email;

-- Mark people who created an account
update waitlist_signups set status = 'joined' where email = lower(trim('person@example.com'));

-- Unsubscribe / opt-out: keep the row so they aren't re-added by a stale form, but stop emailing
update waitlist_signups set status = 'removed' where email = lower(trim('person@example.com'));

-- Deletion request: remove entirely
delete from waitlist_signups where email = lower(trim('person@example.com'));
```

Matching against app accounts (to mark `joined` in bulk) can be done in SQL
against `auth.users.email` by someone with project access. That's deliberately not
automated, so the landing schema stays decoupled from app tables.

---

## 5. Measuring conversion

Vercel Web Analytics provides page views and visitors automatically, plus these
custom events from `src/lib/analytics.ts`. None carries an email, name, or free
text:

| Event | When | Properties |
|---|---|---|
| (page view) | Every page | automatic: path, referrer, UTM, device, country |
| `waitlist_cta_click` | Header, hero, mobile menu, empty-state CTA | `placement`, `device` |
| `waitlist_form_focus` | First focus of an email field per page view | `placement`, `device` |
| `waitlist_submit` | A valid submit is sent | `placement`, `device`, `utm_source?`, `utm_campaign?` |
| `waitlist_signup` | Server confirmed | `placement`, `result` (`created`/`existing`), `device`, UTM |
| `waitlist_error` | Any failure | `placement`, `reason`, `device` |
| `waitlist_city` | City chip chosen | `city`, `saved` |

- **Visitors**: Vercel Analytics → Visitors.
- **Signups**: `waitlist_signup` where `result = created`, or authoritatively
  `count(*)` from the table (§4.1). The table is the source of truth. Analytics
  undercounts blocked browsers.
- **Visitor → waitlist conversion**: `waitlist_signup(created)` ÷ unique visitors
  for the same range. Without custom events: table signups ÷ Vercel visitors.
- **Signup source**: `source` and `referrer` columns (§4.2), or event `placement`.
- **Campaign performance**: UTM columns in the table (§4.2); Vercel's UTM panel
  for visits per campaign; divide the two.
- **Mobile vs desktop**: filter `waitlist_signup` by `device` and divide by
  visitors filtered to the same device in Vercel Analytics.
- **Funnel drop-off**: `waitlist_form_focus` → `waitlist_submit` →
  `waitlist_signup`; `waitlist_error.reason` says why submits fail.

Attribution is captured on the landing page of a visit and kept in
**sessionStorage** (`covey-attribution`) until the tab closes. Someone who clicks
an Instagram link, leaves, and comes back directly the next day signs up
unattributed. That's a deliberate privacy trade-off; switch to localStorage with
an expiry if campaign accuracy matters more.

---

## 6. The waitlist page and the opening animation

The first pass of this branch built a hero around the app-icon quail in its
tile, refined from the Figma "Circle orbit motion". The October redesign
retired that: the primary mark is now reserved for brand identification, and
the hero is a cast of Quinn plus the nine category quails, whose entrance
keeps the Figma idea of the flock arriving and gathering. The waitlist page has
Quinn's expressions react to the form. See docs/redesign-2026-10.md §5 for the
motion map.

## 7. Testing

```bash
npm run test:unit   # handler: 15 cases, fake fetch, no network
npm run test:db     # applies the migration to a throwaway Postgres (Docker) and runs its assertions
npm run test:e2e    # Playwright: builds (COVEY_TODAY pinned), serves via scripts/preview.mjs, mocks /api/waitlist per test
```

`npm run preview` serves the production build with Vercel's routing,
running the built function for /api/* and the newsletter confirm and
unsubscribe pages. `astro preview` doesn't support the Vercel adapter. To run the whole loop
against a real database locally, start Postgres + PostgREST in Docker, apply the
migration, and set `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `.env`. The
endpoint calls `${SUPABASE_URL}/rest/v1/rpc/…`, so put a `/rest/v1` prefix in
front of PostgREST or use `supabase start`.

---

## 8. Known limitations

- **Rate limiting** is per IPv4 address or IPv6 /64 (via HMAC) in the database,
  plus per warm function instance. A distributed bot with many IPs can still add junk rows (they're
  harmless and greppable). If that happens, add a Vercel WAF rate-limit rule on
  `/api/waitlist` or Cloudflare Turnstile. Both were left out to keep third-party
  scripts off the page.
- **Hosting:** the endpoint is a Vercel Function. `netlify.toml` remains a
  mirror for static pages only; moving hosts means swapping the adapter.
- **The contact form** still uses Netlify Forms, which does nothing on Vercel
  (pre-existing; see README). It's out of scope here, but the same endpoint
  pattern would fix it.
- **No unsubscribe link flow yet.** Removal is by reply or email to hello@ and a
  status update (§4.4). Build a tokenized unsubscribe link before sending invite
  emails at volume.

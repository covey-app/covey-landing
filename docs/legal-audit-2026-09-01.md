# Legal audit — Privacy Policy and Terms of Service

**Date:** 1 September 2026
**Scope:** `docs/legal/terms-of-service.md`, `docs/legal/privacy-policy.md` (authoritative
text), and the published pages `src/pages/terms.astro`, `src/pages/privacy.astro`
**Evidence base:** `~/Documents/GitHub/covey` (113 Supabase migrations, 8 non-Stripe edge
functions, `ios/Covey`), plus this repo.

> **This is not legal advice.** It is an engineering-grade audit and a drafting pass by a
> non-lawyer. Both documents need review by a licensed attorney before launch. Section 5
> lists the questions to put to them.

---

## 1. What the product actually does

Everything below was verified in code. Where the previous drafts asserted something the
product does not do, that claim was removed rather than softened.

### Collected

| Area | Evidence |
|---|---|
| Account: email, auth identity (password / Apple / Google) | `auth.users`, `auth.identities`, `AuthRepository.swift` |
| Profile: display name, username, avatar, bio, home city, occupation, MBTI, social links | `profiles`, `profile_social_links` |
| Date of birth, gender | `profile_sensitive` |
| **Government ID photo + selfie** | `user_identity_verification.document_path` / `.selfie_path`, private `identity-docs` bucket, `ProfileRepository.submitIdentityVerification` |
| **Dating: gender identity, sexual orientation, attraction, target age, height, workout frequency** | `profile_dating` |
| Taste graph: activities, cuisines, dietary, food, media genres, fashion, sport skill, nightlife, outdoor | `user_*_preferences` tables |
| Content: plans, plan stops (name/address/lat/lng), posts, photos, plan chat, DMs, groups, bookmarks, comments | `plans`, `plan_stops`, `feed_posts`, `dm_messages`, `plan_chat_messages`, `covey_groups`, `bookmarks` |
| Safety: reports, evidence, blocks, moderation actions and audit log | `reports`, `report_evidence`, `user_blocks`, `moderation_actions`, `moderation_audit_log` |
| Analytics: event name, session, app version, device type, properties | `analytics_events`, `user_behavior_logs` — **first-party, in our own Postgres** |
| Push: APNs token, device id, environment, locale | `user_push_tokens` — **direct APNs, no OneSignal/Firebase** |
| Consent ledger: document, version, source, timestamp | `policy_acceptances`, `record_policy_acceptance()` |

### Not collected — claims removed from the previous drafts

| Removed claim | Why it was wrong |
|---|---|
| "precise device location", "location-based features", "background location" | **No `NSLocationWhenInUseUsageDescription` in `ios/project.yml`**, and no `requestWhenInUseAuthorization` anywhere in `ios/Covey`. The app cannot read device location. Maps render *plan stops* resolved through MapKit search. |
| Google Places | Place search is Apple MapKit (`CoveyMapsService`, `MKMapItem`). `ExternalMaps.googlePlaceId` is fed `"apple:<lat>,<lng>"` and only builds a deep link out to the Google Maps app. `GOOGLE_API_KEY` in the edge functions is an alias for `GEMINI_API_KEY` (`_shared/gemini.ts`). |
| Spotify account connection | Users paste a public share link (`PlanSpotifyLinks`, `PlanSpotifyHostEditor`). `user_media_connections` holds provider/status/handle — **no OAuth tokens, no listening history**. |
| Stripe, payments, subscriptions, refunds | `launch_paid_plans_enabled` defaults **false** and `20260823130000_paid_plans_launch_gate.sql` blocks paid plan creation while closed. Per instruction, all payment provisions were removed. |
| "we do not collect sexual orientation" | Flatly contradicted by `profile_dating.sexual_orientation_label`. Now disclosed as sensitive PI. |

### Subprocessors (now accurate)

Supabase · Apple (App Store, SIWA, APNs, Maps) · Google (Sign-in; **Gemini 2.5 Flash Lite**
for `generate-bio`, `plan-draft`, `chat-icebreakers`, `covey-description`, `explore-search`,
`onboarding-prefill`) · Sentry (`ios/Covey/App/CrashReporting.swift`) · Netlify (marketing
site only).

---

## 2. Material changes

### Terms — 5 sections → 24

New and load-bearing:

- **§4 Identity verification** — describes the check *and* states in a boxed callout what it
  is not: not a background check, not a registry search, no character assessment. Without
  this, an ID-verified badge implies a screening promise we do not keep.
- **§9 We do not screen members** — conspicuous, standalone, uppercase. This is the single
  most important clause in the document for a product that introduces strangers.
- **§10 Meeting people, dating, and real-world risk** — assumption of risk, express release
  naming personal injury / assault / harassment / financial loss, and a California Civil
  Code §1542 waiver (needed for the release to reach unknown claims under California law).
- **§2 Eligibility** — 18+, plus no sex-offender registrants and no violent/sexual felony
  convictions, made a continuing representation. Standard for dating-adjacent products.
- **§7 AI-generated content** — output is unreviewed, may be wrong, becomes the user's
  content once kept.
- **§8 Acceptable use** — 14 specific prohibitions including romance/advance-fee scams,
  block evasion, ban evasion by re-registration, and screenshotting others' private content.
- **§11 Reporting, blocking, moderation** — mirrors what `moderation_actions` actually
  supports (`warn`, `content_remove`, `temporary_suspend`, `permanent_ban`, `dismiss`).
- **§§16–19** — disclaimers, $100 liability cap (framed against the service being free),
  indemnity, and arbitration with a 30-day opt-out, small-claims carve-out, and explicit
  carve-outs for reporting to law enforcement and seeking protective orders.
- **§21** — Apple Schedule 1 minimum terms, required when shipping your own EULA.
- All payment, subscription, refund, and Stripe provisions **removed**; §5 affirmatively
  states the service is free and that money around a plan is not ours.

### Privacy — 17 → 20 sections, rebuilt on verified facts

- **§2.4** discloses ID + selfie collection, human-eye review, no automated facial
  recognition or biometric template, and states plainly that indefinite retention is not
  appropriate and is being fixed.
- **§2.5** discloses dating data as sensitive.
- **§4 "What we do not collect"** — a conspicuous card leading with *Covey does not collect
  your device's location*, plus no ad SDKs, no ATT, no contacts, no Spotify account, no
  payment data.
- **§6 AI features** — names Gemini, lists what is sent and the four categories never sent.
- **§10** ends with an honest note that a photo URL, once shared, may remain openable by
  someone who kept the link (see 3.1).
- **§15** — CCPA table rebuilt with ten statutory categories including biometric information
  and sensitive PI, and a correct sensitive-PI analysis (the previous draft claimed we
  collect none, which was wrong on three counts).
- **§12** — retention table matched to what the deletion RPCs actually do.
- **§13 Security** — describes TLS, provider-side encryption at rest, and RLS. It does **not**
  promise anything unimplemented, and says outright that we do not promise the system is
  secure.

### Enforceability of acceptance

`policy_acceptances` + `record_policy_acceptance()` already give a versioned consent ledger
with a `source` (`signup` / `apple` / `google` / `reconsent`) — good clickwrap
infrastructure. Both documents now carry a visible **version stamp** (`SITE.legal.version`,
`2026-09-01`) so the ledger points at identifiable text. Terms §1 and §22 and Privacy §19
explain the versioning and commit to re-prompting on material change.

---

## 3. Product and engineering work required

Ordered by whether it blocks launch.

### 3.1 Blocking

0. **Decide which text is the agreement.** Two versions of each document are now in
   the repo: the formal instruments in `docs/legal/`, and the plain-language pages
   served at `coveyapp.co/terms` and `/privacy`. `LegalPolicy.termsURL` points at
   the web page, so that is what users actually assent to, and what
   `policy_acceptances` stamps a version against. Publishing two differing texts of
   the same agreement is an enforceability problem in its own right. See
   `docs/legal/README.md` for the three options; (a) render the Markdown at those
   routes is the recommendation.

1. **Bump the policy version in all three places, together.**
   `SITE.legal.version` (done, `2026-09-01`) · `LegalPolicy.currentVersion` in
   `ios/Covey/App/LegalPolicy.swift` (currently `2026-08-23`, pinned by `LegalPolicyTests`)
   · the literal in `public.current_policy_version()`. Mismatched, the ledger records
   consent to text nobody saw.

2. **Ship a re-consent prompt.** `has_accepted_current_policy()` exists; nothing forces
   existing accounts through it after a version bump. Without this, everyone who signed up
   before today is bound only to the 2026-08-23 text.

3. **Delete storage objects on account deletion.** `delete_my_account()` drops `auth.users`
   and cascades the tables, but **nothing deletes `storage.objects`** — no `DELETE FROM
   storage.objects` exists in any migration. Government ID documents and selfies in
   `identity-docs`, plus avatars, chat photos, and post photos, survive deletion
   indefinitely. This contradicts Privacy §12 and §14 as written, and is the most serious
   finding in this audit.

4. **Revoke the Sign in with Apple token on deletion.** No revocation call exists in
   `ios/Covey`. Apple requires it, and it is an App Review rejection trigger.

5. **Make `chat-photos` a private bucket.** `20260812000000_prelaunch_authz_hardening.sql`
   documents the deliberate deferral: `GET /storage/v1/object/public/chat-photos/<thread>/<file>`
   bypasses RLS for anyone holding a full URL, so a former thread member keeps access.
   Privacy §10 currently discloses this honestly; closing it lets that disclosure soften.

### 3.2 Before or shortly after launch

6. **Set a retention period for identity documents** and delete the images once the
   pass/fail outcome is recorded. `user_identity_verification` has no `expires_at` and no
   purge job. Privacy §2.4 commits to this.

7. **Set retention on `analytics_events` and `user_behavior_logs`.** Both grow without
   bound. Privacy §12 says the identifier is detached on deletion — true, both are
   `ON DELETE SET NULL` — but a maximum age should exist.

8. **Explicitly close `launch_payments_enabled`.** `launch_paid_plans_enabled` defaults
   false, but `20260823160000_launch_contract_rollback_levers.sql` says
   `launch_payments_enabled` **defaults true**. For a free launch, set it false explicitly
   so the documents and the runtime agree.

9. **Build a data-export path.** Privacy §14 promises portability. Nothing implements it.
   Even a manual, support-operated export satisfies the promise; nothing does not.

10. **Reconcile the plan age floor.** `plans_min_age_nonneg CHECK (min_age >= 13)` allows a
    plan gated at 13 in a strictly 18+ product. The iOS stepper is `18...80`, so the DB
    constraint is looser than the UI. Raise the constraint to 18.

11. **Add an in-app "delete my identity documents" control**, or route it through support
    and document the SLA. Privacy §2.4 offers this today.

12. **Add a `PrivacyInfo.xcprivacy` privacy manifest** and reconcile it against the App
    Store nutrition labels and this policy. Guideline 5.1.1(b) requires the three to agree.
    Notably: the labels must **not** declare location, and must declare sensitive data.

13. **Surface the in-app links to both documents** at signup (clickwrap) and in settings.
    `LegalPolicy.termsURL` / `.privacyURL` exist and point at this site.

### 3.3 Contradiction to resolve

14. `src/pages/deletion.astro` says deletion removes "app data where removal is technically
    and legally possible". Given 3.1(3) that is doing a lot of work. Update it once storage
    deletion ships.

---

## 4. Facts that need confirming

These were inferred and are **not** verified. Each appears in the published documents.

| Item | Current value | Source of the guess |
|---|---|---|
| Legal entity name | `Covey Co.` | The footer copyright line. Must match App Store Connect exactly. |
| Entity type and state of incorporation | not stated | Unknown. A Delaware corporation should say so. |
| Registered mailing address | only "San Francisco, CA" | Not required for an online-only CCPA business, but usually expected. |
| Governing law / venue | California / San Francisco County | Inferred from `SITE.city`. |
| Arbitration forum | AAA Consumer Arbitration Rules | Convention, not a decision anyone made. |
| Privacy contact | `support@coveyapp.co` | A dedicated `privacy@` alias is more usual. |
| DMCA agent | `support@coveyapp.co` | **No agent is registered with the Copyright Office.** Registration costs $6 and is what secures the safe harbour. |

---

## 5. Questions for a licensed attorney

1. **Arbitration and the class waiver.** Enforceability is jurisdiction-specific and moving.
   Confirm the AAA reference, the 30-day opt-out mechanics, mass-arbitration exposure, and
   whether a batching provision is wanted.

2. **The §10 release, applied to personal injury.** California Civil Code §1668 voids
   contracts exempting a party from liability for their own fraud, wilful injury, or
   violation of law. §17 carves those out, but a release covering assault by another member
   is precisely the clause plaintiffs attack. Ask whether it survives as drafted.

3. **The $100 liability cap in a free consumer product.** Unconscionability risk where the
   user paid nothing and the alleged harm is physical.

4. **Is the selfie "biometric information"?** Illinois BIPA, Texas CUBI, and Washington's My
   Health My Data Act attach duties — including written release and a published retention
   schedule — to biometric identifiers. Our position is that human-eye comparison creates no
   scan or template. That position is defensible but contested, and the CCPA category is
   broader than BIPA's. Confirm before opening Illinois, Texas, or Washington.

5. **Demographic gating and the Unruh Civil Rights Act.** `demographic_gate_telemetry`,
   `profile_dating.target_genders`, and the plan eligibility functions gate access by gender
   and age. California dating and event businesses have faced Unruh claims for exactly this.
   Ask what is defensible as user preference versus what is business discrimination.

6. **Duty of care arising from verification.** By checking IDs, does Covey assume a duty it
   would not otherwise owe — such that a failure to catch a forged document becomes
   negligence? §§4, 9, and 16 are drafted to disclaim it. Confirm that holds in California.

7. **Sex-offender screening.** Several states have statutes requiring dating services either
   to run screening or to make a conspicuous disclosure that they do not, in prescribed
   wording (New Jersey, Illinois, New York, Texas among them). §9 is a disclosure but does
   not use any state's prescribed language. Confirm what is required per state before
   expanding beyond California.

8. **Section 230 and moderation.** Confirm §11's framing preserves the protection.

9. **Retention of moderation records after deletion.** Privacy §12 keeps ban records to stop
   re-registration. Confirm this survives a CCPA or GDPR deletion request — we think it does
   under the security/fraud-prevention exemptions, but the analysis should be written down.

10. **GDPR applicability.** Covey is US-only and invite-only, so Article 3(2) probably does
    not bite. §7 of the privacy policy nevertheless states legal bases. Confirm whether to
    keep that or drop it, and whether an Article 27 representative is needed.

11. **Breach notification.** All 50 states have statutes. Confirm the response plan matches
    what Privacy §13 promises.

12. **Minors.** The 18+ gate is a self-declared checkbox plus an ID check. Confirm this is
    adequate under COPPA and the state age-appropriate design codes, given a minor who lies
    can reach onboarding before the ID step.

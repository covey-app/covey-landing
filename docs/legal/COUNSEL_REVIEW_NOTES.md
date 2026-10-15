# Counsel review notes: Privacy Policy and Terms, version 2026-10-15

These are the notes for whoever reviews `privacy-policy.md` and
`terms-of-service.md` before publication. Covey has no counsel and no legal entity
yet. The two documents were redrafted by a non-lawyer (with Claude) from the App
Store audit of 2026-10-07 and the code as it will ship in 1.0. They are meant to
be accurate to the product. Whether they are adequate in law is the open question.

This file is not published. Only the two documents are rendered on the site.

## 1. What has to happen before publication

1. Form the entity. Replace `{{LEGAL_ENTITY}}` (7 places) and `{{POSTAL_ADDRESS}}`
   (5 places). The name must match the App Store Connect seller name and the
   copyright line. An Organization membership in App Store Connect is expected for
   an app that handles sensitive data (Guideline 5.1.1(ix)).
2. Register a DMCA agent at dmca.copyright.gov ($6, renewed every 3 years) and
   replace `{{DMCA_AGENT}}` in Terms Annex C with the registered name, address and
   telephone number. Until it is registered, the § 512(c) safe harbour is not
   available.
3. Confirm a data processing agreement (DPA) is in place with each Service Provider
   in Privacy Annex B (section 4 below).
4. Decide each question in section 3.
5. Deploy the site, then apply the `current_policy_version()` migration (covey PR
   "Bump policy version to 2026-10-15"), and ship the iOS and web builds that send
   `2026-10-15`.

## 2. Judgment calls made in the drafts

Each of these was a choice. Accept it or change it.

### Privacy Policy

| § | Call made | Why / alternative |
|---|---|---|
| Header, 20 | Version 2026-10-15 supersedes 2026-09-01. The app stamped 2026-09-08 on acceptances, a version that was never published. | Nothing in the documents mentions 2026-09-08. Counsel to decide whether existing accounts that "accepted" 2026-09-08 need notice or re-consent under § 20.2. No re-consent flow exists today. |
| Notice at collection | Rewritten to disclose location (When In Use, ~1 km area off the device only for suggestions and the co-pilot) and AI (consent-gated features; safety scanning not consent-gated). | Old notice said Covey "does not collect the geolocation of your device". |
| 2.7, 7.1, Annex A | A position rounded to two decimal places (~1.1 km north-south, ~0.9 km east-west at San Francisco's latitude) is treated as **not** "precise geolocation". | CPRA defines precise geolocation as within a 1,850-foot radius. Two-decimal rounding is coarser. Confirm. Other states use different definitions. |
| 4.5, 4.5A, 17.5 | Identity verification described as optional and "may be offered", because it is hidden at launch. A BIPA-style written notice and retention policy is included (4.5A) even though Covey never holds the biometric data. | See open question 3.1. |
| 4.5A(g) | Promises that Covey's instructions to Stripe require destruction at the earlier of purpose satisfied or the legal limit. | This depends on Stripe's terms and on Covey calling Stripe's redact endpoint (built for account deletion). Covey has no separate post-verification redaction today. Counsel to confirm the wording matches the Stripe contract, or narrow it. |
| 4.6, 4.16, 6, 17.3 | Dating fields and religion, politics and substance use are treated as sensitive data needing opt-in consent, collected through a separate consent line recorded server-side. School, occupation, MBTI and diet are optional but **not** consent-gated. | Diet and substance use could be "health" data under some state laws (e.g. Washington My Health My Data Act). Decide whether diet needs the consent line too, and whether MHMDA applies at all to a US-only social app. |
| 4.10, 9.5, 15.6.5, Annex C | Usage events kept after deletion are called **pseudonymised**, not de-identified, and are not disclosed under 9.5. | Events keep session id, device model and other members' ids in properties. Calling them de-identified would be overstated. |
| 4.14, 12 | The website is described as having no forms and setting no cookies. The Netlify contact form was removed in the same change. | If a contact form or analytics is added later, §§ 4.14 and 12 must change first. |
| 5 (last para), 8.5 | States that Covey does not train models on personal data and that Google's paid Gemini terms prohibit Google from using it to train or improve models. Google may retain prompts for a limited period for abuse monitoring. | Relies on the Gemini key being on a billed Cloud project (owner decision). Confirm against the current Gemini API Additional Terms; Google's retention period for abuse monitoring is not stated in the policy. |
| 8.4 | States that the AI features do not send Google the user's account identifier. | True of the code read on 2026-10-07: prompts carry no user id. Re-check if a feature adds one. |
| 8.7 | Safety scanning of all UGC, including DMs and images, by Gemini is **disclosed but not consent-gated**, on the basis of legitimate interest in safety and as a condition of the Terms (Terms § 8.5). | Owner decision. Apple Guideline 5.1.2(i) asks for explicit permission before sharing personal data with third-party AI; whether a safety function is covered is a counsel call. The conservative alternative is a one-time disclosure in the sign-up flow. |
| 8.7 | "Covey sends the content to be checked, not your name, email address, or profile." | Depends on the content-filtering work (track T3) sending only content plus an internal reference. Verify before publishing. |
| 8.8 | "No Account is suspended or banned by an automated check alone." | Matches the shipped design (auto-hide, then human review). If automatic suspension is ever added, change this. |
| 11.1 | Optional profile details are visible only if added and not hidden. | Depends on the profile-read fixes (audit F-03, tracks T4/T8). Today the server returns hidden fields to any member. Do not publish until those ship. |
| 11.8 | Blocking hides the blocked person's messages in shared Plan and group chats. | Depends on track T5 shipping. |
| 15.6, Annex C | Deletion is immediate; photos are removed from storage within 24 hours; SIWA token revoked; Stripe Identity session redacted; consent records deleted with the account. | Depends on track T6 (storage purge schedule, `apple-revoke`, Stripe redaction). The old Annex C said consent records survive deletion; in fact `policy_acceptances` cascades from `auth.users`. If counsel wants consent records kept as evidence after deletion, that is a code change. |
| Annex C | Usage analytics: deleted after 90 days. Crash reports: Sentry retention up to 90 days. Report alert emails: up to 24 months after the report closes. Support email: up to 24 months. | 90 days for analytics depends on the retention job being scheduled with a 90-day cutoff (track T6). Sentry's retention must be checked in the Sentry project settings. The 24-month periods are a choice. |
| Annex C, 13.4 | Backups described as expiring "on their regular rolling schedule", without a number. | Supabase's backup window depends on the plan (and on PITR). Add a number once confirmed. |
| 16.4 | Account log-in credentials listed as Sensitive Personal Information. | CPRA lists "account log-in ... in combination with any required ... password". Conservative. |
| 16.4 | Right to limit (§ 1798.121) said not to arise. | Unchanged from the previous version. Confirm it still holds with religion and politics fields added. |
| 17.5 | Names BIPA, Texas CUBI, and Washington RCW 19.375 as the biometric laws 4.5A addresses. | Confirm the list. |
| 19 | GDPR legal-bases table kept although launch is US-only. | Harmless if the Service is US-only; could be dropped. |
| 21 | Adds privacy@coveyapp.co as the rights-request address (exists per owner). No DPO or Article 27 representative named. | Confirm none is needed for a US-only launch. |
| Annex B | Resend listed as "Plus Five Five, Inc. d/b/a Resend". | Confirm the contracting entity against Resend's DPA. Confirm the entity names of every other provider against the signed DPAs. |
| Annex B | Stripe listed for Identity only, with a sentence that Payments and Connect are not used. | Payments are off in 1.0. If paid plans launch, Annex B, § 7.2.5 and Terms § 6.3 must be amended first. |

### Terms of Service

| § | Call made | Why / alternative |
|---|---|---|
| Notice, 9.3, Annex A preamble | Explicit zero-tolerance clause added and set conspicuous: objectionable content removed; offenders suspended or banned. | Required by Guideline 1.2, and the sign-up checkbox already promises it. |
| 9.3, 12.4A | Commits to reviewing reports within 24 hours and removing violating content. | Matches `public.safety_policy` and the safety page. This is a contractual promise; confirm counsel is comfortable with it in the Terms rather than only on the safety page. |
| 12.2 | Replaced "no obligation to monitor ... does not undertake to do so" with an accurate description (Covey does scan and review) plus a limitation that moderation creates no duty beyond § 12. | The old text contradicted the automated scanning now shipped. Check the § 230 / duty-of-care consequences of the new wording. |
| 3.4, 4.3, A.4.3 | Removed all invitation-gate language. Launch is public. | Owner decision. |
| 3.6 | New: alcohol-centred Plans are 21+, and the host cannot lower it. | Owner decision. Check that "centred on alcohol" is defined well enough to enforce. |
| 5 | Rewritten to the Stripe Identity flow: optional, may not be offered, automated selfie match by Stripe, Covey keeps outcome and DOB. Conspicuous notice updated ("automated check" instead of "visual inspection"). | Old text described staff visually comparing images Covey stored. |
| 6.3 | States payments are not offered and payouts unavailable; commits to publishing amended terms, including refund terms, before any charge. | The audit suggests a fixed refund policy if paid plans launch: full refund before sign-up closes or if the host cancels, otherwise none. Not written into 2026-10-15 because no payments exist. |
| 6.5 | Removed "early-access basis". | Public launch. |
| 8.1, 8.5 | Names Gemini, says AI features need the user's agreement, and adds automated safety checks as a condition of use. | Pairs with Privacy § 8.7. |
| 16.2 | Gives the exact deletion path and the 24-hour photo window. | Depends on track T6. |
| 20.3, 21 | Kept California governing law and San Francisco as arbitration seat and venue. | Chosen before an entity existed. Revisit once the entity's state and principal place of business are known. |
| Annex D | Reduced to the entity name, notice address and email, with a statement that the Provider is the controller and the App Store seller. | The previous Annex D assumed a Delaware corporation. |

## 3. Open questions for counsel

### 3.1 Biometric notice for Stripe Identity (BIPA-style)
Stripe captures the ID and a live selfie and does an automated face match. Covey
never receives the images or any template, but it chooses to use Stripe and
initiates the session (`require_matching_selfie`, `require_live_capture`).
- Is Covey a "private entity in possession" or one that "collects, captures ...
  or otherwise obtains" biometric data under BIPA § 15(b) when a vendor does the
  capture? Recent Illinois decisions differ. The draft assumes the conservative
  answer and gives notice anyway (Privacy 4.5A).
- Does Stripe's own consent screen satisfy the written-release requirement, or
  must Covey present its own consent before launching the Stripe flow?
- Is a publicly available retention schedule and destruction guideline needed in
  addition to 4.5A? 4.5A(g) promises destruction at the earlier of purpose
  satisfied or the legal limit; Covey only redacts on account deletion today.
- Texas CUBI and Washington RCW 19.375 notice and consent.
- The feature is **hidden at launch**. Nothing above blocks 1.0, but it must be
  settled before the flag is turned on.

### 3.2 Age assurance: Texas SB 2420, Utah and Louisiana, with Apple's Declared Age Range
The app is 18+. It uses Apple's Declared Age Range where available and a
self-declared date of birth otherwise. Alcohol-centred plans are 21+.
- Texas SB 2420 (the App Store Accountability Act) and the Utah and Louisiana
  app store accountability acts put duties on app stores and on developers: use
  the store's age signal, respect parental consent for minors, and re-check on
  significant changes. The audit records Apple's guidance that 18+ apps must
  still check age with the API where these laws require it, with Texas
  obligations applying from 2026-06-04. Confirm the effective dates. Does using Declared Age Range plus an 18+ age rating and server-side
  refusal of under-18 dates of birth meet the developer's obligations in each
  state? Is anything owed when the API returns no signal (older OS, user
  declines)?
- Is the self-declared date of birth an acceptable fallback, or must the app
  block users in those states when no age range is available?
- Do these laws or any state's dating-service or alcohol laws affect the 21+
  alcohol rule as drafted (Terms 3.6, Privacy 18.1)?
- Apple blocks 18+ downloads for unconfirmed adults in Australia, Brazil and
  Singapore. Launch is US-only, so this is noted, not asked.

### 3.3 DMCA agent registration
Who is the agent (a person or a role at the entity's address)? Register at
dmca.copyright.gov once the entity exists, then fill `{{DMCA_AGENT}}`. Confirm a
repeat-infringer policy (Terms 14.3) is enough as written.

### 3.4 Export compliance year-end report
The app declares `ITSAppUsesNonExemptEncryption = NO` and uses only
OS-provided encryption (TLS via URLSession, Apple's frameworks). Under EAR
§ 740.17(b)(1) and the mass-market rules, apps that only call OS encryption are
generally exempt from the annual self-classification report. Confirm that no
report is owed, including for the bundled third-party SDKs (supabase-swift,
stripe-ios, sentry-cocoa), and that the "NO" answer in App Store Connect is
right.

### 3.5 Other questions
- **Sensitive-data consent mechanism.** The drafts assume one consent line at the
  dating opt-in and one before religion, politics or substance-use fields are
  first filled, each recorded server-side with a timestamp. Is that sufficient
  "opt-in consent" for Virginia, Colorado, Connecticut and Texas, and for
  Colorado's specific consent-request requirements?
- **Contacts matching** sends raw E.164 numbers of non-users to the server, which
  matches and discards them. Is notice to the uploading user enough, given the
  non-users never consented? Hashing on the device was recommended but not built.
- **Safety scanning of DMs by a third party** (Privacy 8.7). Any wiretap or
  ECPA / CIPA exposure in sending message content to Google for classification,
  given the Terms disclose it and it is a condition of use?
- **Release in Terms § 11** as applied to personal injury, and the Unruh Act
  exposure of demographic gating on Plans (carried over from the 2026-09-01
  audit; unchanged here).
- **Re-consent.** Is the 2026-10-15 change "material" under Privacy § 20.2 and
  Terms § 23.2 for existing accounts? If yes, a re-consent screen is needed
  before or at launch; none exists.

### 3.6 Website sign-ups added on merge (2026-10-15)

This redraft was written on 2026-10-07, when the website had no forms. The site
on `main` has since launched a waitlist (2026-10-14) and Covey Weekly, an email
newsletter. Merging main into this branch added the following to the Privacy
Policy, taken from the proposals in `docs/waitlist.md` §3.1 and
`docs/redesign-2026-10.md` §8. **None of it has been reviewed.**

- § 4.14 rewritten: the waitlist (email, optional city, page/campaign/referrer)
  and Covey Weekly (email, consent wording and time, same attribution; double
  opt-in; unsubscribe link). It also covers the one-day keyed IP hash used against abuse.
- § 5.13 added: purposes for both sign-ups.
- § 12.1 now lists `covey-attribution` and `covey-hero` (session storage) as well
  as `covey-theme`. § 12.4 now describes Vercel Web Analytics (cookieless,
  aggregate) instead of "no third-party analytics".
- Annex B: Vercel's row covers the sign-up functions and analytics; Resend's row
  covers waitlist and newsletter email.
- Annex C: three rows (waitlist, Covey Weekly, abuse-prevention keys).

Questions:
- **Retention of unsubscribed and unconfirmed newsletter rows.** Today they are
  kept indefinitely with that status (no purge job), which Annex C now states.
  Is a suppression-list rationale enough, or should there be a limit (e.g. keep
  only a hash of the address after unsubscribe)?
- **CAN-SPAM.** Newsletter editions and waitlist launch emails are commercial
  email and need a physical postal address. `{{POSTAL_ADDRESS}}` is still a
  placeholder, and the site config has no address.
- **The waitlist and "public launch".** The Terms drop the invitation gate, while
  the site now says Covey is "opening in waves" from the waitlist. Is that
  consistent, or should the Terms mention staged availability?

## 4. Service Providers: DPA checklist

| Provider | Entity in Annex B | DPA confirmed? |
|---|---|---|
| Supabase | Supabase, Inc. | Not confirmed |
| Google (Gemini API, Sign in with Google) | Google LLC | Not confirmed; also confirm paid-tier billing on the Gemini key |
| Apple | Apple Inc. | Covered by the Apple Developer Program License Agreement |
| Stripe (Identity) | Stripe, Inc. | Not confirmed |
| Twilio (Verify) | Twilio Inc. | Not confirmed |
| Sentry | Functional Software, Inc. d/b/a Sentry | Not confirmed; also turn on "Prevent storing IP addresses" |
| Vercel | Vercel Inc. | Not confirmed |
| Cloudflare | Cloudflare, Inc. | Not confirmed; confirm which Covey properties Cloudflare serves |
| Resend | Plus Five Five, Inc. d/b/a Resend | Not confirmed; confirm entity name |

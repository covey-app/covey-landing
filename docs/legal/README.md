# Covey legal instruments

This directory holds the **authoritative text** of Covey's legal documents.

| File | Document | Version |
|---|---|---|
| `terms-of-service.md` | Terms of Service | 2026-09-01 |
| `privacy-policy.md` | Privacy Policy | 2026-09-01 |

`../legal-audit-2026-09-01.md` records the code audit these were drafted from, the
engineering work they require, and the questions outstanding for counsel.

---

## ⚠️ Unresolved: two texts are currently published

**This must be decided before launch.** Right now there are two versions of each
document:

1. **These files** — formal, defined terms, numbered clauses, conspicuous
   statutory blocks, annexes. Drafted to be enforceable and to be redlined by an
   attorney.
2. **`src/pages/terms.astro` and `src/pages/privacy.astro`** — plain-language, in
   Covey's voice. These are what is actually served at `coveyapp.co/terms` and
   `/privacy`.

They cover the same ground and reach the same substantive positions, but they are
not word-identical.

**Why that is a problem.** `LegalPolicy.termsURL` and `.privacyURL` in the iOS app
point at the marketing site. Users therefore assent to the *web page*, and
`policy_acceptances` stamps a version against the text served there. A formal
document that no user was ever shown is not the agreement, however well drafted.
If the two texts ever say different things about arbitration, liability, or
consent, the conflict is resolved against the drafter.

**Three ways out, in order of preference:**

**(a) Publish the formal text; render these files at `/terms` and `/privacy`.**
One source of truth, no divergence, and the text the user assents to is the text
counsel approved. Costs the plain-language voice on those two pages. Astro can
import Markdown directly, so the change is small; the design system's `legal-prose`
class already exists to style it.

**(b) Publish the formal text, keep a labelled summary.** Serve the formal document
at `/terms` and `/privacy`, and move the plain-language version to a clearly marked
"summary — not the agreement" page. The summary must say so conspicuously, and must
link to the operative text. This is what most consumer platforms do.

**(c) Treat the web pages as operative and these as drafting notes.** Cheapest, but
it discards the enforceability work: the conspicuousness formatting, the defined
terms, the annexes, and the acceptance mechanics in Terms § 2 are the parts that do
the work if the agreement is ever tested.

Until this is decided, **do not describe the repository files as "the terms"** in
any external communication, and do not send them to a counterparty as though they
were in force.

---

## Version discipline

The Version in each document header is not decorative. It is one of a triple that
must move together:

| Location | Constant |
|---|---|
| `docs/legal/*.md` | the `**Version:**` header line |
| `src/config.ts` | `SITE.legal.version` |
| `covey/ios/Covey/App/LegalPolicy.swift` | `LegalPolicy.currentVersion` |
| `covey/supabase/migrations/…_signup_policy_consent.sql` | `current_policy_version()` |

The iOS app stamps `policy_acceptances.policy_version` with its constant. If these
drift, the consent ledger records assent to text nobody was shown, which is worse
than having no ledger — it is a record that affirmatively misstates what happened.
`LegalPolicyTests` pins the Swift literal as a tripwire, so a bump there fails the
test with a message naming the migration to bump alongside it.

Bumping the version does **not** re-prompt existing users. `has_accepted_current_policy()`
exists but nothing calls it as a gate. Until a re-consent flow ships, every account
created before a bump remains bound only to the version it accepted.

## Amending a document

1. Edit the Markdown here. Keep the clause numbering stable — cross-references
   inside the documents and from the app rely on it. Add rather than renumber.
2. Decide whether the change is material within the meaning of Terms § 23 or
   Privacy § 20. If it is, a re-consent prompt is required, not just a publish.
3. Bump the Version and Effective Date in the header, and record what the previous
   version was in `**Supersedes:**`.
4. Bump the other three constants in the same commit.
5. Mirror the change into the published surface, per whichever of (a)/(b)/(c)
   above has been chosen.

## Placeholders still open

Both documents contain bracketed blocks that must be resolved before publication:

- **Entity particulars** — Terms Annex D. Drafted as "Covey, Inc., a Delaware
  corporation" on instruction. The exact registered name must be verified against
  the certificate of incorporation and must match the App Store Connect account.
  Registered office, principal place of business, and a notice address for legal
  process are all missing.
- **DMCA designated agent** — Terms Annex C. No agent is registered with the
  Copyright Office. Registration costs $6 at dmca.copyright.gov and is what
  secures the § 512(c) safe harbour. Until it is done, the safe harbour is not
  available.
- **Privacy contact** — Privacy § 21. Currently `support@`; a dedicated `privacy@`
  alias is customary. A postal address is required.
- **Identity document retention period** — Privacy Annex C. Committed to in the
  text but not yet fixed or implemented. The policy is inaccurate until it is.
- **Service Provider entity names and DPAs** — Privacy Annex B. Each needs a
  countersigned data processing agreement.

---

**These documents were drafted by a non-lawyer from a code audit. They have not
been reviewed by counsel and no representation is made that any provision is
enforceable in any jurisdiction.** See § 5 of the audit for the specific questions
to put to an attorney — in particular the release in Terms § 11 as applied to
personal injury, the biometric characterisation of the verification selfie, and
the Unruh Act exposure of demographic gating.

# Covey legal instruments

This directory holds the **authoritative text** of Covey's legal documents.

| File | Document | Version |
|---|---|---|
| `terms-of-service.md` | Terms of Service | 2026-09-01 |
| `privacy-policy.md` | Privacy Policy | 2026-09-01 |

`../legal-audit-2026-09-01.md` records the code audit these were drafted from, the
engineering work they require, and the questions outstanding for counsel.

---

## These files are what is published

`src/pages/terms.astro` and `src/pages/privacy.astro` render these Markdown files
directly, through `src/components/LegalDocument.astro`. Neither page contains any
legal text of its own.

That is deliberate. `LegalPolicy.termsURL` in the iOS app links users here to
accept, and `policy_acceptances` stamps a version against whatever is served. If
two differently-worded versions of the same agreement were published, the conflict
between them would be resolved against the drafter. One source of truth removes
the question.

**To change the published agreement, edit the Markdown in this directory.** Do not
add legal text to the Astro pages.

A note on presentation: every provision set off as a `>` blockquote in these files
is rendered as a conspicuous block — bordered, elevated, accent rule. That is not
decoration. UCC § 1-201(b)(10) conditions the enforceability of a warranty
disclaimer on conspicuousness, and California courts reason similarly about
releases and limitations of liability. The `.legal-doc blockquote` rule in
`src/styles/global.css` is load-bearing; do not flatten it into a quiet
pull-quote, and do not use `>` for ordinary emphasis.

---

## Version discipline

The Version in each document header is not decorative. It is one of a triple that
must move together:

| Location | Constant |
|---|---|
| `docs/legal/*.md` | the `**Version:**` header line — **the authority** |
| `covey/ios/Covey/App/LegalPolicy.swift` | `LegalPolicy.currentVersion` |
| `covey/supabase/migrations/…_signup_policy_consent.sql` | `current_policy_version()` |

The landing site holds no version constant of its own; it renders the Markdown, so
the header line is the only value it can show.

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
5. Rebuild and redeploy the landing site. No mirroring step is required — the
   pages render these files.

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

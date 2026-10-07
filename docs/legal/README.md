# Covey legal instruments

This directory holds the **authoritative text** of Covey's legal documents.

| File | Document | Version |
|---|---|---|
| `terms-of-service.md` | Terms of Service | 2026-10-15 (pending publication) |
| `privacy-policy.md` | Privacy Policy | 2026-10-15 (pending publication) |

Version 2026-10-15 was redrafted from the App Store audit of 2026-10-07
(`covey/docs/audits/app-store-audit-2026-10-07/PRIVACY_AND_DATA_MAP.md`) and
describes the 1.0 launch build. `COUNSEL_REVIEW_NOTES.md` lists every legal
judgment call in it and the questions open for counsel. The live site served
2026-09-01 while the app stamped acceptances as 2026-09-08; 2026-10-15 closes
that gap only if all four constants below move together.

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
| `covey/supabase/migrations/…_policy_version_*.sql` (newest) | `current_policy_version()` |
| `covey/src/lib/legal.ts` | `CURRENT_POLICY_VERSION` (TanStack web app) |
| `covey-web/lib/config/legal.ts` | `LEGAL_POLICY_VERSION` (Expo web app) |

The landing site holds no version constant of its own; it renders the Markdown, so
the header line is the only value it can show.

The iOS app stamps `policy_acceptances.policy_version` with its constant. If these
drift, the consent ledger records assent to text nobody was shown, which is worse
than having no ledger — it is a record that affirmatively misstates what happened.
`LegalPolicyTests` pins the Swift literal as a tripwire, so a bump there fails the
test with a message naming the migration to bump alongside it.

Bumping the version does **not** re-prompt existing users. `has_accepted_current_policy()`
gates only onboarding completion (`complete_onboarding_bundle`), so it binds new
accounts and nobody else. Until a re-consent flow ships, every account created
before a bump remains bound only to the version it accepted.

## Amending a document

1. Edit the Markdown here. Keep the clause numbering stable — cross-references
   inside the documents and from the app rely on it. Add rather than renumber.
2. Decide whether the change is material within the meaning of Terms § 23 or
   Privacy § 20. If it is, a re-consent prompt is required, not just a publish.
3. Bump the Version and Effective Date in the header, and record what the previous
   version was in `**Supersedes:**`.
4. Bump the app, server, and web constants in the same release, and apply the
   server migration only after this site is deployed.
5. Rebuild and redeploy the landing site. No mirroring step is required — the
   pages render these files.

## Placeholders still open

Three placeholders remain, deliberately, because no legal entity has been formed
yet. Each renders literally until it is replaced, so the site must not be
deployed to production with them in place.

| Placeholder | Where | Replace with |
|---|---|---|
| `{{LEGAL_ENTITY}}` | Privacy header, §1.1, §21; Terms header, Recital A, §25, Annex D | Exact registered name, entity form, and state, e.g. "Example, Inc., a Delaware corporation". Must match the App Store Connect seller name and the copyright line |
| `{{POSTAL_ADDRESS}}` | Privacy header, §21; Terms header, §25, Annex D | Postal address for notices and legal process |
| `{{DMCA_AGENT}}` | Terms Annex C | Designated agent's name, postal address, and telephone number, exactly as registered at dmca.copyright.gov |

Everything else that needs a lawyer's decision is in `COUNSEL_REVIEW_NOTES.md`,
not in the documents.

---

**These documents were drafted by a non-lawyer from a code audit. They have not
been reviewed by counsel and no representation is made that any provision is
enforceable in any jurisdiction.** See § 5 of the audit for the specific questions
to put to an attorney — in particular the release in Terms § 11 as applied to
personal injury, the biometric characterisation of the verification selfie, and
the Unruh Act exposure of demographic gating.

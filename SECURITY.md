# Security

This is a static marketing site with no user accounts, no stored payment
data, and no backend beyond form submissions (waitlist + contact).

## Reporting an issue

If you find a security issue with this site (e.g. an XSS vector, a
misconfigured header, exposed data in a form), email
**jwu@coveyapp.co** or **jsesteaga@coveyapp.co** directly (`security@coveyapp.co`
isn't a live inbox yet — update this once it is). Please don't open a public
GitHub issue for anything sensitive.

## What's already in place

- Dependabot checks for vulnerable dependencies weekly (`.github/dependabot.yml`).
- CI runs a full build on every pull request before merge (`.github/workflows/ci.yml`).
- Security response headers (CSP-adjacent hardening) are set in `vercel.json`.
- No secrets or API keys are stored in this repo — if that ever changes
  (e.g. a Supabase key gets added), it must go through environment
  variables in the hosting provider's dashboard, never committed to git.

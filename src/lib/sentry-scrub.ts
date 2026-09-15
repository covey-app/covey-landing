// Sentry event scrubbing for the marketing and legal site.
//
// The same file as in covey-ios and covey-web, and aligned with the native
// app's ios/Covey/App/CrashReporting.swift. Three surfaces report into one
// Sentry organisation; they must not disagree about what counts as sensitive.
//
// This site holds the least user content of the three — it is static pages
// plus two Netlify forms — but the forms are the signup funnel, and /terms and
// /privacy are the URLs App Review opens. Keeping the rules identical costs
// nothing and means there is no third policy to reason about.

import type { ErrorEvent, EventHint } from "@sentry/core";

/// Query parameters are where user content leaks into a URL — `?q=` on Explore
/// most obviously, but also anything a future route adds. The path is what
/// makes an error groupable; the query string is not worth the exposure, so it
/// is dropped wholesale rather than allowlisted key by key. An allowlist fails
/// open the first time someone adds a parameter and forgets this file.
export function scrubUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    // Relative or malformed. Keep everything before the first delimiter.
    return rawUrl.split(/[?#]/)[0] ?? rawUrl;
  }
}

/// Supabase puts the access token in the URL fragment on the magic-link and
/// OAuth return paths. `scrubUrl` already drops the fragment, but breadcrumbs
/// and message strings can carry a token inline, so match it as text too.
const TOKEN_PATTERN =
  /\b(access_token|refresh_token|provider_token|apikey|code)=[^&\s"']+/gi;

/// Long-lived bearer tokens are three base64url segments. Matching the shape
/// catches one pasted into a message where no `key=value` framing exists.
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

export function scrubText(value: string): string {
  return value
    .replace(TOKEN_PATTERN, (_m, key: string) => `${key}=[redacted]`)
    .replace(JWT_PATTERN, "[redacted-jwt]");
}

/// Applied to every event on both runtimes before it leaves the process.
///
/// Returning the event (rather than null) on an unexpected shape is
/// intentional: a scrubber that silently drops events is a monitoring system
/// that lies about the error rate. Anything it cannot parse is passed through
/// having had the text-level redaction applied.
export function scrubEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  // Never ship the query string as structured data either.
  if (event.request?.query_string) {
    delete event.request.query_string;
  }
  // Cookies carry the Supabase session. sendDefaultPii: false should already
  // prevent this; deleting it is the belt to that braces, because the cost of
  // being wrong is a session token in a third-party system.
  if (event.request?.cookies) {
    delete event.request.cookies;
  }
  if (event.request?.headers) {
    delete event.request.headers.cookie;
    delete event.request.headers.authorization;
  }

  if (event.message) {
    event.message = scrubText(event.message);
  }

  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrubText(exception.value);
    }
  }

  event.breadcrumbs = event.breadcrumbs?.map((crumb) => ({
    ...crumb,
    message: crumb.message ? scrubText(crumb.message) : crumb.message,
    data: crumb.data
      ? {
          ...crumb.data,
          ...(crumb.data.url ? { url: scrubUrl(String(crumb.data.url)) } : {}),
        }
      : crumb.data,
  }));

  return event;
}

/// Errors that say nothing about Covey's code.
///
/// These are not "noise" in the sense of being unimportant — they are events
/// generated outside the app entirely (a browser extension, a network the user
/// walked out of range of, a tab closed mid-request). Left in, they dominate
/// the issue list and the crash-free-session rate stops meaning anything.
const IGNORED_ERROR_PATTERNS: Array<RegExp> = [
  // Fired by ResizeObserver in every browser; benign and unactionable.
  /ResizeObserver loop/i,
  // A navigation or tab close that cancelled an in-flight fetch.
  /AbortError|The user aborted a request|cancelled|The operation was aborted/i,
  // Offline or flaky network, not a defect.
  /Failed to fetch|NetworkError when attempting to fetch|Load failed/i,
  // Browser extensions injecting into the page.
  /chrome-extension:|moz-extension:|safari-extension:/i,
];

export function isIgnoredError(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/// Shared across both SDKs so a change to the privacy posture cannot be made on
/// one runtime and forgotten on the other.
export const SHARED_SENTRY_OPTIONS = {
  sendDefaultPii: false,
  beforeSend: (event: ErrorEvent, hint: EventHint): ErrorEvent | null => {
    const message = event.exception?.values?.[0]?.value ?? event.message ?? "";
    if (message && isIgnoredError(message)) return null;
    return scrubEvent(event, hint);
  },
} as const;

/*
 * Waitlist input rules, shared by the browser form and the /api/waitlist
 * endpoint so the two can't disagree about what a valid signup is. The
 * database re-checks email shape and the city vocabulary as a final backstop
 * (db/migrations/20261014120000_waitlist_signups.sql).
 */

export const CITIES = ["san-francisco", "davis", "other"] as const;
export type City = (typeof CITIES)[number];

/** Where on coveyapp.co a signup came from. Stored as `landing:<placement>`. */
export const PLACEMENTS = ["hero", "closing", "page", "nojs"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export type Attribution = Partial<Record<UtmKey | "referrer" | "landing_path", string>>;

/**
 * Trim and lower-case. Deliberately no Gmail dot/plus folding: those are real,
 * distinct mailboxes on most providers, and folding would email the wrong one.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// One @, something on both sides, a dot in the domain with a 2+ char TLD, no
// whitespace, and none of the characters that make an address parse as a
// display name plus a different mailbox (`prize<victim@example.com>`) when it
// reaches an email API. Stricter checks reject real addresses; delivery is
// the real test.
const EMAIL_RE = /^[^\s@<>"(),;:\[\]\\]+@[^\s@<>"(),;:\[\]\\]+\.[^\s@.<>"(),;:\[\]\\]{2,}$/;

export function isValidEmail(email: string): boolean {
  return email.length >= 6 && email.length <= 254 && EMAIL_RE.test(email);
}

export function isCity(value: unknown): value is City {
  return typeof value === "string" && (CITIES as readonly string[]).includes(value);
}

export function isPlacement(value: unknown): value is Placement {
  return typeof value === "string" && (PLACEMENTS as readonly string[]).includes(value);
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // Strip control characters; attribution is free text from a URL.
  const v = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return v ? v.slice(0, max) : undefined;
}

/** Keep only origin + path of an external referrer — never its query string. */
export function cleanReferrer(value: unknown): string | undefined {
  const raw = clean(value, 2000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return undefined;
  }
}

export function cleanAttribution(input: Record<string, unknown>): Attribution {
  const out: Attribution = {};
  for (const key of UTM_KEYS) {
    const v = clean(input[key], 200);
    if (v) out[key] = v;
  }
  const referrer = cleanReferrer(input.referrer);
  if (referrer) out.referrer = referrer;
  const landing = clean(input.landing_path, 200);
  if (landing && landing.startsWith("/")) out.landing_path = landing.split(/[?#]/)[0];
  return out;
}

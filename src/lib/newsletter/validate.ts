/*
 * Newsletter input rules shared by the form and /api/newsletter. Email shape
 * and attribution cleaning are the waitlist's (src/lib/waitlist/validate.ts);
 * only what differs lives here. Client-safe: no server imports.
 */

/** Where on coveyapp.co a subscription came from. Stored as `landing:<placement>`. */
export const NEWSLETTER_PLACEMENTS = ["newsletter-page", "home", "activities", "edition", "footer"] as const;
export type NewsletterPlacement = (typeof NEWSLETTER_PLACEMENTS)[number];

export const DEFAULT_NEWSLETTER_PLACEMENT: NewsletterPlacement = "newsletter-page";

export function isNewsletterPlacement(value: unknown): value is NewsletterPlacement {
  return typeof value === "string" && (NEWSLETTER_PLACEMENTS as readonly string[]).includes(value);
}

/*
 * The waitlist's isValidEmail accepts anything without whitespace or a second
 * @, including `name<victim@example.com>` — which a mail API may parse as a
 * display name plus a different mailbox. Every newsletter address is mailed,
 * so these characters are refused outright (the database CHECK agrees).
 */
const UNSAFE_EMAIL_CHARS = /[<>"(),;:[\]\\]/;

export function hasUnsafeEmailChars(email: string): boolean {
  return UNSAFE_EMAIL_CHARS.test(email);
}

/** 32 random bytes, base64url, no padding — the token in a confirmation link. */
export const CONFIRM_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** newsletter_subscribers.unsubscribe_token (gen_random_uuid()). */
export const UNSUBSCRIBE_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

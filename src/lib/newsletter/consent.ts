/*
 * The exact sentence a subscriber agrees to. The newsletter form renders this
 * constant beside its button, and /api/newsletter stores this constant (never
 * client-supplied text) in newsletter_subscribers.consent_text, so the record
 * always matches what was on screen. Changing the wording changes what new
 * signups consent to; existing rows keep the text they agreed to.
 *
 * Client-safe: no server imports.
 */
export const NEWSLETTER_CONSENT_TEXT =
  "Send me Covey's weekly email of things to do in San Francisco. I can unsubscribe anytime.";

/*
 * POST /api/newsletter, plus the server-side halves of the confirm and
 * unsubscribe pages. Framework-free so it can be unit tested with plain
 * Request objects (tests/unit/newsletter-handler.test.ts).
 *
 * Subscribing to Covey Weekly is a separate action from joining the waitlist:
 * separate table, separate consent, separate endpoint. Double opt-in — a
 * signup stays `pending` until the emailed link is opened.
 *
 * Body: { email, consent: true, source?, utm_*?, referrer?, landing_path?,
 *         wl_check?, elapsed_ms? }
 * JSON gets JSON back; a native (no-JS) form POST gets a 303.
 *
 * Bot handling, body limits, the per-instance limiter, and the HMAC client key
 * are the waitlist's own (src/lib/waitlist/handler.ts), imported rather than
 * copied; the client key uses its own scope so the shared rate-limit table
 * counts the two forms separately.
 *
 * Privacy: raw emails and IPs are never logged.
 */
import {
  MIN_HUMAN_MS,
  clientKeyFor,
  instanceRateLimited,
  json,
  randomToken,
  readBody,
  sha256Hex,
  type Body,
} from "../waitlist/handler.ts";
import { cleanAttribution, isValidEmail, normalizeEmail } from "../waitlist/validate.ts";
import { NEWSLETTER_CONSENT_TEXT } from "./consent.ts";
import { sendNewsletterConfirmation } from "./email.ts";
import {
  confirmNewsletterToken,
  subscribeNewsletter,
  unsubscribeNewsletterToken,
  type SubscribeResult,
  type SupabaseConfig,
} from "./supabase.ts";
import {
  CONFIRM_TOKEN_RE,
  DEFAULT_NEWSLETTER_PLACEMENT,
  UNSUBSCRIBE_TOKEN_RE,
  hasUnsafeEmailChars,
  isNewsletterPlacement,
  type NewsletterPlacement,
} from "./validate.ts";

export { resetInstanceRateLimit } from "../waitlist/handler.ts";

export interface NewsletterEnv {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  resendKey?: string;
  emailFrom?: string;
}

export interface NewsletterDeps {
  fetch: typeof fetch;
  /** Structured, PII-free log line. */
  log: (event: string, detail?: Record<string, string | number | boolean>) => void;
  now: () => number;
}

export type NewsletterErrorCode =
  | "invalid_email"
  | "consent_required"
  | "invalid_request"
  | "rate_limited"
  | "not_configured"
  | "unavailable";

export type ConfirmOutcome = "confirmed" | "already" | "invalid" | "unavailable" | "not_configured";
export type UnsubscribeOutcome = "unsubscribed" | "invalid" | "unavailable" | "not_configured";

const RATE_LIMIT_SCOPE = "newsletter-rl";

function dbConfig(env: NewsletterEnv): SupabaseConfig | null {
  return env.supabaseUrl && env.supabaseServiceKey ? { url: env.supabaseUrl, serviceKey: env.supabaseServiceKey } : null;
}

function fail(status: number, error: NewsletterErrorCode, isForm: boolean, extra?: Record<string, string>): Response {
  if (isForm) {
    // No-JS fallback: the newsletter page reveals a matching message with :target.
    const anchor = error === "invalid_email" || error === "consent_required" ? "nl-invalid" : "nl-retry";
    return new Response(null, { status: 303, headers: { location: `/newsletter/#${anchor}`, "cache-control": "no-store" } });
  }
  return json(status, { ok: false, error }, extra);
}

function ok(status: number, payload: Record<string, unknown>, isForm: boolean): Response {
  if (isForm) {
    return new Response(null, { status: 303, headers: { location: "/newsletter/thanks/", "cache-control": "no-store" } });
  }
  return json(status, { ok: true, ...payload });
}

/**
 * Consent must be affirmative and explicit: JSON boolean `true`, or a form
 * checkbox/hidden field posting "yes" / "on". Anything else — absent, false,
 * the string "true" in JSON — is not consent.
 */
function hasConsent(body: Body, isForm: boolean): boolean {
  return isForm ? body.consent === "yes" || body.consent === "on" : body.consent === true;
}

export async function handleNewsletterRequest(
  request: Request,
  clientAddress: string | undefined,
  env: NewsletterEnv,
  deps: NewsletterDeps,
): Promise<Response> {
  const parsed = await readBody(request);
  if (!parsed) {
    deps.log("newsletter.bad_request");
    return json(400, { ok: false, error: "invalid_request" });
  }
  const { body, isForm } = parsed;

  const db = dbConfig(env);
  if (!db) {
    deps.log("newsletter.not_configured", {
      supabaseUrl: Boolean(env.supabaseUrl),
      serviceKey: Boolean(env.supabaseServiceKey),
    });
    return fail(503, "not_configured", isForm);
  }

  const ip = clientAddress || request.headers.get("x-real-ip") || "unknown";
  const clientKey = await clientKeyFor(ip, db.serviceKey, RATE_LIMIT_SCOPE);
  if (instanceRateLimited(clientKey, deps.now())) {
    deps.log("newsletter.rate_limited", { layer: "instance" });
    return fail(429, "rate_limited", isForm, { "retry-after": "60" });
  }

  // Bot traps, as on the waitlist: a filled honeypot, an instant submit, or a
  // JSON post without the timing field our own form always sends gets exactly
  // what a real new signup gets, and nothing is stored or emailed.
  const honeypot = typeof body.wl_check === "string" && body.wl_check.trim() !== "";
  const elapsed = typeof body.elapsed_ms === "number" ? body.elapsed_ms : Number(body.elapsed_ms);
  const untimed = !isForm && !Number.isFinite(elapsed);
  const tooFast = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_HUMAN_MS;
  if (honeypot || tooFast || untimed) {
    deps.log("newsletter.bot_suspected", { honeypot, tooFast, untimed });
    return ok(201, { result: "pending", confirmation: "sent" }, isForm);
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!isValidEmail(email) || hasUnsafeEmailChars(email)) {
    deps.log("newsletter.invalid_email");
    return fail(422, "invalid_email", isForm);
  }
  if (!hasConsent(body, isForm)) {
    deps.log("newsletter.consent_required");
    return fail(422, "consent_required", isForm);
  }

  const placement: NewsletterPlacement = isNewsletterPlacement(body.source) ? body.source : DEFAULT_NEWSLETTER_PLACEMENT;
  const token = randomToken();
  const tokenHash = await sha256Hex(token);

  let result: SubscribeResult;
  try {
    result = await subscribeNewsletter(
      db,
      {
        email,
        clientKey,
        // Always the server's constant; a client-sent consent_text is ignored.
        consentText: NEWSLETTER_CONSENT_TEXT,
        source: `landing:${placement}`,
        attribution: cleanAttribution(body),
        confirmTokenHash: tokenHash,
      },
      deps.fetch,
    );
  } catch (err) {
    deps.log("newsletter.store_failed", { status: (err as { status?: number }).status ?? 0 });
    return fail(502, "unavailable", isForm);
  }

  switch (result.result) {
    case "created":
    case "pending":
    case "resubscribe": {
      let confirmation: "sent" | "deferred";
      if (!env.resendKey || !env.emailFrom) {
        confirmation = "deferred";
      } else if (!result.resend) {
        // The database issued a link under two minutes ago (double submit);
        // that email is already on its way and its token is still valid.
        confirmation = "sent";
      } else {
        const sent = await sendNewsletterConfirmation(
          { resendKey: env.resendKey, from: env.emailFrom },
          email,
          token,
          `newsletter-confirm/${result.id}/${tokenHash.slice(0, 16)}`,
          deps.fetch,
        );
        confirmation = sent ? "sent" : "deferred";
      }
      deps.log(`newsletter.${result.result}`, { placement, nojs: isForm, confirmation, resend: result.resend });
      return ok(result.result === "created" ? 201 : 200, { result: "pending", confirmation }, isForm);
    }
    case "subscribed":
      deps.log("newsletter.subscribed", { placement, nojs: isForm });
      return ok(200, { result: "subscribed" }, isForm);
    case "rate_limited":
      deps.log("newsletter.rate_limited", { layer: "database" });
      return fail(429, "rate_limited", isForm, { "retry-after": "600" });
    case "invalid_email":
      deps.log("newsletter.invalid_email", { layer: "database" });
      return fail(422, "invalid_email", isForm);
  }
}

/**
 * For the /newsletter/confirm/?token=… page (server-rendered). Token shape is
 * checked before any database call. Call it from an explicit user action (a
 * POST from a "Confirm" button, or client JS after load) rather than on a
 * plain GET, or mail-scanner prefetches will confirm addresses unattended.
 */
export async function confirmNewsletter(
  token: string,
  env: NewsletterEnv,
  deps: Pick<NewsletterDeps, "fetch" | "log">,
): Promise<{ result: ConfirmOutcome }> {
  if (typeof token !== "string" || !CONFIRM_TOKEN_RE.test(token)) {
    deps.log("newsletter.confirm", { result: "invalid", layer: "shape" });
    return { result: "invalid" };
  }
  const db = dbConfig(env);
  if (!db) {
    deps.log("newsletter.not_configured", { supabaseUrl: Boolean(env.supabaseUrl), serviceKey: Boolean(env.supabaseServiceKey) });
    return { result: "not_configured" };
  }
  try {
    const result = await confirmNewsletterToken(db, await sha256Hex(token), deps.fetch);
    deps.log("newsletter.confirm", { result });
    return { result };
  } catch (err) {
    deps.log("newsletter.store_failed", { status: (err as { status?: number }).status ?? 0, intent: "confirm" });
    return { result: "unavailable" };
  }
}

/**
 * For the /newsletter/unsubscribe/?token=… page, including the RFC 8058
 * one-click POST mail clients send to the List-Unsubscribe URL. Idempotent:
 * an already-unsubscribed token is still "unsubscribed".
 */
export async function unsubscribeNewsletter(
  token: string,
  env: NewsletterEnv,
  deps: Pick<NewsletterDeps, "fetch" | "log">,
): Promise<{ result: UnsubscribeOutcome }> {
  if (typeof token !== "string" || !UNSUBSCRIBE_TOKEN_RE.test(token)) {
    deps.log("newsletter.unsubscribe", { result: "invalid", layer: "shape" });
    return { result: "invalid" };
  }
  const db = dbConfig(env);
  if (!db) {
    deps.log("newsletter.not_configured", { supabaseUrl: Boolean(env.supabaseUrl), serviceKey: Boolean(env.supabaseServiceKey) });
    return { result: "not_configured" };
  }
  try {
    const found = await unsubscribeNewsletterToken(db, token.toLowerCase(), deps.fetch);
    const result: UnsubscribeOutcome = found ? "unsubscribed" : "invalid";
    deps.log("newsletter.unsubscribe", { result });
    return { result };
  } catch (err) {
    deps.log("newsletter.store_failed", { status: (err as { status?: number }).status ?? 0, intent: "unsubscribe" });
    return { result: "unavailable" };
  }
}

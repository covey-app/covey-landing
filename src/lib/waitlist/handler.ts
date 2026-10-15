/*
 * POST /api/waitlist — framework-free so it can be unit tested with plain
 * Request objects (tests/unit/waitlist-handler.test.ts). The Astro route in
 * src/pages/api/waitlist.ts only supplies config and the client address.
 *
 * Two intents:
 *   join — { email, source?, utm_*?, referrer?, landing_path?, wl_check?, elapsed_ms? }
 *   city — { intent: "city", token, city }   (optional one-tap follow-up)
 *
 * Accepts JSON (the enhanced form) or form-urlencoded (JavaScript disabled).
 * JSON gets JSON back; a native form POST gets a 303 to a static page.
 *
 * Privacy: raw emails and IPs are never logged. The IP only ever exists as an
 * HMAC (the rate-limit key) on its way to the database.
 */
import {
  cleanAttribution,
  isCity,
  isPlacement,
  isValidEmail,
  normalizeEmail,
  type Placement,
} from "./validate.ts";
import { isDisposableEmail } from "./disposable.ts";
import { joinWaitlist, setWaitlistCity, type SupabaseConfig } from "./supabase.ts";
import { sendConfirmation, type EmailConfig } from "./email.ts";

export interface WaitlistEnv {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  resendKey?: string;
  emailFrom?: string;
}

export interface WaitlistDeps {
  fetch: typeof fetch;
  /** Structured, PII-free log line. */
  log: (event: string, detail?: Record<string, string | number | boolean>) => void;
  now: () => number;
}

export type ErrorCode =
  | "invalid_email"
  | "disposable_email"
  | "invalid_request"
  | "rate_limited"
  | "not_configured"
  | "unavailable"
  | "expired";

export const MAX_BODY_BYTES = 4096;
// A person can't read the page, type an address, and press submit in under
// this long. Bots that fill and post the form instantly can.
export const MIN_HUMAN_MS = 1200;

// First line of defence, per warm function instance. The durable limit is the
// database (8 / 10 min and 30 / 24 h per client key); this one only saves a round
// trip when a single instance is being hammered.
const INSTANCE_WINDOW_MS = 60_000;
const INSTANCE_MAX = 12;
const instanceHits = new Map<string, number[]>();

export function instanceRateLimited(key: string, now: number): boolean {
  const recent = (instanceHits.get(key) ?? []).filter((t) => now - t < INSTANCE_WINDOW_MS);
  recent.push(now);
  instanceHits.set(key, recent);
  if (instanceHits.size > 5000) instanceHits.clear();
  return recent.length > INSTANCE_MAX;
}

export function resetInstanceRateLimit(): void {
  instanceHits.clear();
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

/**
 * The unit a rate limit should count. IPv6 hosts are routinely handed a whole
 * /64, so keying on the full address would give one client unlimited keys.
 */
export function rateLimitSubject(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head] = ip.split("%");
  const parts = head.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(":") : [];
  const full = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${full.slice(0, 4).map((h) => h.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * HMAC the IP so the database sees a stable, non-reversible client key.
 * `scope` keeps keys from different forms (which share one rate-limit table)
 * from colliding; the waitlist's default must never change.
 */
export async function clientKeyFor(ip: string, secret: string, scope = "waitlist-rl"): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${scope}:${rateLimitSubject(ip)}`))).slice(0, 40);
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export type Body = Record<string, unknown>;

/**
 * CSRF guard for native form posts. Astro's blanket checkOrigin is off
 * (astro.config.mjs) because it also refuses origin-less POSTs, which is how
 * mail providers send RFC 8058 one-click unsubscribes. So the signup
 * endpoints check here instead: a form post whose Origin names another site
 * is refused; JSON needs a CORS preflight and never gets this far
 * cross-site; a post with no Origin (old browsers, server-to-server) is
 * allowed — it carries no visitor's cookies, and these endpoints use none.
 */
export function isCrossSiteForm(request: Request): boolean {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  const formLike = type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data") || type.includes("text/plain");
  const origin = request.headers.get("origin");
  if (!formLike || !origin || origin === "null") return false;
  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

export async function readBody(request: Request): Promise<{ body: Body; isForm: boolean } | null> {
  if (isCrossSiteForm(request)) return null;
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  if (type === "application/json") {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { body: parsed as Body, isForm: false } : null;
    } catch {
      return null;
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    return { body: Object.fromEntries(new URLSearchParams(text)), isForm: true };
  }
  return null;
}

export function json(status: number, payload: Record<string, unknown>, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

function fail(status: number, error: ErrorCode, isForm: boolean, extra?: Record<string, string>): Response {
  if (isForm) {
    // No-JS fallback: the waitlist page reveals a matching message with :target.
    const anchor = error === "invalid_email" || error === "disposable_email" ? "invalid-email" : "try-again";
    return new Response(null, { status: 303, headers: { location: `/waitlist/#${anchor}`, "cache-control": "no-store" } });
  }
  return json(status, { ok: false, error }, extra);
}

function ok(status: number, payload: Record<string, unknown>, isForm: boolean): Response {
  if (isForm) {
    return new Response(null, { status: 303, headers: { location: "/waitlist/joined/", "cache-control": "no-store" } });
  }
  return json(status, { ok: true, ...payload });
}

export async function handleWaitlistRequest(
  request: Request,
  clientAddress: string | undefined,
  env: WaitlistEnv,
  deps: WaitlistDeps,
): Promise<Response> {
  const parsed = await readBody(request);
  if (!parsed) {
    deps.log("waitlist.bad_request");
    return json(400, { ok: false, error: "invalid_request" });
  }
  const { body, isForm } = parsed;

  // Missing configuration is an operator problem, never a fake success: the
  // visitor is told to try again and the log says exactly what's missing.
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    deps.log("waitlist.not_configured", {
      supabaseUrl: Boolean(env.supabaseUrl),
      serviceKey: Boolean(env.supabaseServiceKey),
    });
    return fail(503, "not_configured", isForm);
  }
  const db: SupabaseConfig = { url: env.supabaseUrl, serviceKey: env.supabaseServiceKey };

  const ip = clientAddress || request.headers.get("x-real-ip") || "unknown";
  const clientKey = await clientKeyFor(ip, env.supabaseServiceKey);
  if (instanceRateLimited(clientKey, deps.now())) {
    deps.log("waitlist.rate_limited", { layer: "instance" });
    return fail(429, "rate_limited", isForm, { "retry-after": "60" });
  }

  if (body.intent === "city") return handleCity(body, db, deps);

  // Bot traps. A filled honeypot, an instant submit, or a JSON post without
  // the timing field our own form always sends gets exactly the answer a real
  // new signup gets — same status, a (decoy) token — and is not stored.
  const honeypot = typeof body.wl_check === "string" && body.wl_check.trim() !== "";
  const elapsed = typeof body.elapsed_ms === "number" ? body.elapsed_ms : Number(body.elapsed_ms);
  const untimed = !isForm && !Number.isFinite(elapsed);
  const tooFast = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_HUMAN_MS;
  if (honeypot || tooFast || untimed) {
    deps.log("waitlist.bot_suspected", { honeypot, tooFast, untimed });
    return ok(201, { result: "created", followupToken: randomToken() }, isForm);
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!isValidEmail(email)) {
    deps.log("waitlist.invalid_email");
    return fail(422, "invalid_email", isForm);
  }
  // Throwaway inboxes are refused before the database: no row, no rate-limit
  // hit. The domain isn't logged either; the event count is enough.
  if (isDisposableEmail(email)) {
    deps.log("waitlist.disposable_email");
    return fail(422, "disposable_email", isForm);
  }

  const placement: Placement = isForm ? "nojs" : isPlacement(body.source) ? body.source : "page";
  const token = randomToken();

  let result;
  try {
    result = await joinWaitlist(
      db,
      {
        email,
        clientKey,
        source: `landing:${placement}`,
        attribution: cleanAttribution(body),
        followupTokenHash: await sha256Hex(token),
      },
      deps.fetch,
    );
  } catch (err) {
    const status = (err as { status?: number }).status;
    deps.log("waitlist.store_failed", { status: status ?? 0 });
    return fail(502, "unavailable", isForm);
  }

  switch (result.result) {
    case "created": {
      deps.log("waitlist.created", { placement });
      if (env.resendKey && env.emailFrom) {
        const emailed = await sendConfirmation(
          { resendKey: env.resendKey, from: env.emailFrom } satisfies EmailConfig,
          email,
          `waitlist-confirm/${result.id}`,
          deps.fetch,
        );
        deps.log("waitlist.confirmation_email", { sent: emailed });
      }
      return ok(201, { result: "created", followupToken: token }, isForm);
    }
    case "existing":
      deps.log("waitlist.existing", { placement });
      return ok(200, { result: "existing" }, isForm);
    case "rate_limited":
      deps.log("waitlist.rate_limited", { layer: "database", limit: result.limit });
      return fail(429, "rate_limited", isForm, { "retry-after": result.limit === "daily" ? "3600" : "600" });
    case "invalid_email":
      deps.log("waitlist.invalid_email", { layer: "database" });
      return fail(422, "invalid_email", isForm);
  }
}

async function handleCity(body: Body, db: SupabaseConfig, deps: WaitlistDeps): Promise<Response> {
  const token = body.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token) || !isCity(body.city)) {
    return json(400, { ok: false, error: "invalid_request" });
  }
  try {
    const updated = await setWaitlistCity(db, { followupTokenHash: await sha256Hex(token), city: body.city }, deps.fetch);
    deps.log("waitlist.city", { updated, city: body.city });
    return updated ? json(200, { ok: true }) : json(410, { ok: false, error: "expired" });
  } catch (err) {
    deps.log("waitlist.store_failed", { status: (err as { status?: number }).status ?? 0, intent: "city" });
    return json(502, { ok: false, error: "unavailable" });
  }
}

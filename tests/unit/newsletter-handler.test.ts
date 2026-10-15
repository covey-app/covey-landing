// Unit tests for the /api/newsletter handler and the confirm/unsubscribe
// helpers. No network: Supabase and Resend are replaced by a fake fetch that
// records every call.
//
//   npm run test:unit
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  confirmNewsletter,
  handleNewsletterRequest,
  resetInstanceRateLimit,
  unsubscribeNewsletter,
  type NewsletterEnv,
} from "../../src/lib/newsletter/handler.ts";
import { clientKeyFor } from "../../src/lib/waitlist/handler.ts";
import { NEWSLETTER_CONSENT_TEXT } from "../../src/lib/newsletter/consent.ts";
import { listUnsubscribeHeaders, newsletterConfirmationEmail, unsubscribeUrl } from "../../src/lib/newsletter/email.ts";
import { newsletterRecipients } from "../../src/lib/newsletter/supabase.ts";

const ENV: NewsletterEnv = { supabaseUrl: "https://db.example.test", supabaseServiceKey: "sb_secret_test_key_123" };
const MAIL: NewsletterEnv = { ...ENV, resendKey: "re_test", emailFrom: "Covey Weekly <weekly@coveyapp.co>" };
const IP = "203.0.113.9";
const ID = "0b4c2f9e-1111-4222-8333-444455556666";
const RPC = "https://db.example.test/rest/v1/rpc/";
const RESEND = "https://api.resend.com/emails";

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

function harness(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const fakeFetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const call: Call = { url: String(input), init, body: JSON.parse(String(init.body ?? "{}")) };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const deps = {
    fetch: fakeFetch,
    now: () => Date.now(),
    log: (event: string, detail?: Record<string, unknown>) => logs.push(JSON.stringify({ event, ...detail })),
  };
  return { calls, logs, deps, rpcCalls: () => calls.filter((c) => c.url.startsWith(RPC)), resendCalls: () => calls.filter((c) => c.url === RESEND) };
}

const rpcOk = (payload: unknown) =>
  new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });

/** Supabase answers `subscribe`; Resend answers `resendStatus`. */
function backend(subscribe: unknown, resendStatus = 200) {
  return (call: Call) => (call.url === RESEND ? new Response("{}", { status: resendStatus }) : rpcOk(subscribe));
}

function jsonReq(body: unknown): Request {
  return new Request("https://www.coveyapp.co/api/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formReq(fields: Record<string, string>): Request {
  return new Request("https://www.coveyapp.co/api/newsletter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const human = { elapsed_ms: 5000, consent: true };

beforeEach(() => resetInstanceRateLimit());

// --- subscribe: result branches ---------------------------------------------

test("created: 201 pending, normalized email, server consent text, attribution, hashed token, email sent", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  const res = await handleNewsletterRequest(
    jsonReq({
      ...human,
      email: "  Pat.Doe@Example.COM ",
      source: "activities",
      utm_source: "instagram",
      utm_campaign: "weekly",
      referrer: "https://l.instagram.com/some/path?secret=1",
      landing_path: "/activities?utm_source=instagram",
    }),
    IP,
    MAIL,
    h.deps,
  );
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { ok: true, result: "pending", confirmation: "sent" });

  const [call] = h.rpcCalls();
  assert.equal(call.url, `${RPC}newsletter_subscribe`);
  assert.equal(call.body.p_email, "pat.doe@example.com");
  assert.equal(call.body.p_consent_text, NEWSLETTER_CONSENT_TEXT);
  assert.equal(call.body.p_source, "landing:activities");
  assert.equal(call.body.p_utm_source, "instagram");
  assert.equal(call.body.p_utm_campaign, "weekly");
  assert.equal(call.body.p_referrer, "https://l.instagram.com/some/path", "referrer query string is dropped");
  assert.equal(call.body.p_landing_path, "/activities");
  assert.match(String(call.body.p_confirm_token_hash), /^[0-9a-f]{64}$/);
  assert.match(String(call.body.p_client_key), /^[0-9a-f]{40}$/);

  const [mail] = h.resendCalls();
  assert.ok(mail, "confirmation email sent");
  assert.deepEqual(mail.body.to, ["pat.doe@example.com"]);
  assert.equal(mail.body.subject, "Confirm your subscription to Covey Weekly");
  assert.equal(mail.body.from, MAIL.emailFrom);
  const link = /https:\/\/www\.coveyapp\.co\/newsletter\/confirm\/\?token=([A-Za-z0-9_-]{43})/.exec(String(mail.body.text));
  assert.ok(link, "text body carries the confirm link");
  assert.ok(String(mail.body.html).includes(link[0]), "html body carries the same link");
  const { sha256Hex } = await import("../../src/lib/waitlist/handler.ts");
  assert.equal(await sha256Hex(link[1]), call.body.p_confirm_token_hash, "the emailed token is the one whose hash was stored");
  assert.ok(!JSON.stringify(call.body).includes(link[1]), "the raw token never reaches the database");
  const idem = (mail.init.headers as Record<string, string>)["idempotency-key"];
  assert.equal(idem, `newsletter-confirm/${ID}/${String(call.body.p_confirm_token_hash).slice(0, 16)}`);
});

test("pending and resubscribe: 200 pending, a fresh email is sent", async () => {
  for (const result of ["pending", "resubscribe"]) {
    const h = harness(backend({ result, id: ID, resend: true }));
    const res = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, h.deps);
    assert.equal(res.status, 200, result);
    assert.deepEqual(await res.json(), { ok: true, result: "pending", confirmation: "sent" });
    assert.equal(h.resendCalls().length, 1, result);
    assert.ok(h.logs.some((l) => l.includes(`newsletter.${result}`)));
  }
});

test("pending inside the database's resend cooldown: no second email, previous link stays valid", async () => {
  const h = harness(backend({ result: "pending", id: ID, resend: false }));
  const res = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, h.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: "pending", confirmation: "sent" });
  assert.equal(h.resendCalls().length, 0);
});

test("subscribed: 200, nothing emailed", async () => {
  const h = harness(backend({ result: "subscribed", id: null, resend: false }));
  const res = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, h.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: "subscribed" });
  assert.equal(h.resendCalls().length, 0);
});

test("confirmation is 'deferred' when Resend is not configured or the send fails; the row is still stored", async () => {
  const unconfigured = harness(backend({ result: "created", id: ID, resend: true }));
  const r1 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, unconfigured.deps);
  assert.equal(r1.status, 201);
  assert.deepEqual(await r1.json(), { ok: true, result: "pending", confirmation: "deferred" });
  assert.equal(unconfigured.resendCalls().length, 0);
  assert.equal(unconfigured.rpcCalls().length, 1);

  const throttledNoMail = harness(backend({ result: "pending", id: ID, resend: false }));
  const r2 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, throttledNoMail.deps);
  assert.equal((await r2.json()).confirmation, "deferred", "never claim 'sent' when email was never configured");

  const failing = harness(backend({ result: "created", id: ID, resend: true }, 500));
  const r3 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, failing.deps);
  assert.equal(r3.status, 201);
  assert.deepEqual(await r3.json(), { ok: true, result: "pending", confirmation: "deferred" });

  const offline = harness((call) => {
    if (call.url === RESEND) throw new TypeError("fetch failed");
    return rpcOk({ result: "created", id: ID, resend: true });
  });
  const r4 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, offline.deps);
  assert.equal(r4.status, 201);
  assert.equal((await r4.json()).confirmation, "deferred");
});

// --- consent ------------------------------------------------------------------

test("consent must be explicit: JSON boolean true only", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  for (const consent of [undefined, false, "true", "yes", 1, "on", null]) {
    const res = await handleNewsletterRequest(jsonReq({ elapsed_ms: 5000, email: "pat@example.com", consent }), IP, ENV, h.deps);
    assert.equal(res.status, 422, String(consent));
    assert.deepEqual(await res.json(), { ok: false, error: "consent_required" });
  }
  assert.equal(h.calls.length, 0, "nothing stored without consent");
});

test("consent in a no-JS form: 'yes' or 'on' only", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  for (const consent of ["yes", "on"]) {
    const res = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent }), IP, ENV, h.deps);
    assert.equal(res.status, 303, consent);
    assert.equal(res.headers.get("location"), "/newsletter/thanks/");
  }
  const refused: Record<string, string>[] = [
    { email: "pat@example.com" },
    { email: "pat@example.com", consent: "no" },
    { email: "pat@example.com", consent: "true" },
  ];
  for (const fields of refused) {
    const res = await handleNewsletterRequest(formReq(fields), IP, ENV, h.deps);
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/newsletter/#nl-invalid", JSON.stringify(fields));
  }
  assert.equal(h.rpcCalls().length, 2);
});

test("the stored consent text is the server constant; a client cannot override it", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  await handleNewsletterRequest(
    jsonReq({ ...human, email: "pat@example.com", consent_text: "I agree to nothing", p_consent_text: "x", consentText: "y" }),
    IP,
    ENV,
    h.deps,
  );
  await handleNewsletterRequest(formReq({ email: "pat2@example.com", consent: "yes", consent_text: "I agree to nothing" }), IP, ENV, h.deps);
  const sent = h.rpcCalls().map((c) => c.body.p_consent_text);
  assert.deepEqual(sent, [NEWSLETTER_CONSENT_TEXT, NEWSLETTER_CONSENT_TEXT]);
  assert.equal(
    NEWSLETTER_CONSENT_TEXT,
    "Send me Covey's weekly email of things to do in San Francisco. I can unsubscribe anytime.",
  );
});

// --- validation and placement --------------------------------------------------

test("invalid email is rejected before the database", async () => {
  const h = harness(backend({}));
  for (const email of ["", "nope", "a@b", "a b@c.co", "x@y.c", "prize<victim@example.com>", '"x"<v@example.com>', "a,b@c.co", "a;b@c.co"]) {
    const res = await handleNewsletterRequest(jsonReq({ ...human, email }), IP, ENV, h.deps);
    assert.equal(res.status, 422, email);
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_email" });
  }
  assert.equal(h.calls.length, 0);
});

test("source is allowlisted; anything else falls back to newsletter-page", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  for (const source of ["newsletter-page", "home", "activities", "edition", "footer"]) {
    await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com", source }), IP, ENV, h.deps);
  }
  for (const source of ["hero", "landing:home", "<script>", 7]) {
    await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com", source }), IP, ENV, h.deps);
  }
  assert.deepEqual(
    h.rpcCalls().map((c) => c.body.p_source),
    [
      "landing:newsletter-page",
      "landing:home",
      "landing:activities",
      "landing:edition",
      "landing:footer",
      "landing:newsletter-page",
      "landing:newsletter-page",
      "landing:newsletter-page",
      "landing:newsletter-page",
    ],
  );
});

// --- bots ------------------------------------------------------------------------

test("honeypot, instant, and untimed submits get the decoy success and store nothing", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  for (const body of [
    { ...human, email: "bot@example.com", wl_check: "Acme" },
    { email: "bot@example.com", consent: true, elapsed_ms: 40 },
    { email: "bot@example.com", consent: true }, // our form always sends elapsed_ms
  ]) {
    const res = await handleNewsletterRequest(jsonReq(body), IP, MAIL, h.deps);
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.deepEqual(await res.json(), { ok: true, result: "pending", confirmation: "sent" });
  }
  const form = await handleNewsletterRequest(formReq({ email: "bot@example.com", consent: "yes", wl_check: "x" }), IP, MAIL, h.deps);
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "/newsletter/thanks/");
  assert.equal(h.calls.length, 0, "no database write, no email");
  assert.ok(h.logs.some((l) => l.includes("newsletter.bot_suspected")));
});

// --- rate limits -------------------------------------------------------------------

test("database rate limit is a 429 with retry-after 600; database email rejection is a 422", async () => {
  const limited = harness(backend({ result: "rate_limited", id: null, resend: false }));
  const r1 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, limited.deps);
  assert.equal(r1.status, 429);
  assert.equal(r1.headers.get("retry-after"), "600");
  assert.deepEqual(await r1.json(), { ok: false, error: "rate_limited" });
  assert.equal(limited.resendCalls().length, 0);

  const rejected = harness(() => new Response(JSON.stringify({ message: "invalid_email" }), { status: 400 }));
  const r2 = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, rejected.deps);
  assert.equal(r2.status, 422);
  assert.deepEqual(await r2.json(), { ok: false, error: "invalid_email" });
});

test("per-instance limiter trips before the database is hammered", async () => {
  const h = harness(backend({ result: "subscribed", id: null, resend: false }));
  const statuses: number[] = [];
  for (let i = 0; i < 14; i++) {
    statuses.push((await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, h.deps)).status);
  }
  assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
  assert.deepEqual(statuses.slice(12), [429, 429]);
  assert.equal(h.rpcCalls().length, 12);
  const other = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), "198.51.100.1", ENV, h.deps);
  assert.equal(other.status, 200, "a different client is unaffected");
});

test("newsletter and waitlist rate-limit keys never collide in the shared table", async () => {
  const h = harness(backend({ result: "subscribed", id: null, resend: false }));
  await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, h.deps);
  const newsletterKey = h.rpcCalls()[0].body.p_client_key;
  const waitlistKey = await clientKeyFor(IP, ENV.supabaseServiceKey!);
  assert.equal(newsletterKey, await clientKeyFor(IP, ENV.supabaseServiceKey!, "newsletter-rl"));
  assert.notEqual(newsletterKey, waitlistKey);
  assert.ok(!String(newsletterKey).includes(IP));
});

// --- failure modes -------------------------------------------------------------------

test("missing configuration is a 503, never a fake success", async () => {
  const h = harness(backend({}));
  const res = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, { resendKey: "re_x", emailFrom: "x@y.co" }, h.deps);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, error: "not_configured" });
  assert.equal(h.calls.length, 0);
  assert.ok(h.logs.some((l) => l.includes("newsletter.not_configured")));
});

test("database and network failures are a 502 and send no email", async () => {
  for (const respond of [
    () => new Response("{}", { status: 500 }),
    () => {
      throw new TypeError("fetch failed");
    },
    () => rpcOk({ surprise: true }),
    () => rpcOk({ result: "created" }), // no id
  ]) {
    const h = harness(respond);
    const res = await handleNewsletterRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, MAIL, h.deps);
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { ok: false, error: "unavailable" });
    assert.equal(h.resendCalls().length, 0);
  }
});

test("malformed, oversized, and unsupported bodies are a 400", async () => {
  const h = harness(backend({}));
  const url = "https://www.coveyapp.co/api/newsletter";
  const bad = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
  assert.equal((await handleNewsletterRequest(bad, IP, ENV, h.deps)).status, 400);
  const arr = new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: "[]" });
  assert.equal((await handleNewsletterRequest(arr, IP, ENV, h.deps)).status, 400);
  const big = jsonReq({ ...human, email: "a@b.co", pad: "x".repeat(5000) });
  const bigRes = await handleNewsletterRequest(big, IP, ENV, h.deps);
  assert.equal(bigRes.status, 400);
  assert.deepEqual(await bigRes.json(), { ok: false, error: "invalid_request" });
  const text = new Request(url, { method: "POST", headers: { "content-type": "text/plain" }, body: "a@b.co" });
  assert.equal((await handleNewsletterRequest(text, IP, ENV, h.deps)).status, 400);
  assert.equal(h.calls.length, 0);
});

// --- no-JS ------------------------------------------------------------------------------

test("no-JS form posts redirect: thanks on success, #nl-invalid or #nl-retry on failure", async () => {
  const created = harness(backend({ result: "created", id: ID, resend: true }));
  const r1 = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent: "yes", source: "home" }), IP, ENV, created.deps);
  assert.equal(r1.status, 303);
  assert.equal(r1.headers.get("location"), "/newsletter/thanks/");
  assert.equal(created.rpcCalls()[0].body.p_source, "landing:home");

  const subscribed = harness(backend({ result: "subscribed", id: null, resend: false }));
  const r2 = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent: "on" }), IP, ENV, subscribed.deps);
  assert.equal(r2.headers.get("location"), "/newsletter/thanks/");

  const bad = await handleNewsletterRequest(formReq({ email: "nope", consent: "yes" }), IP, ENV, created.deps);
  assert.equal(bad.status, 303);
  assert.equal(bad.headers.get("location"), "/newsletter/#nl-invalid");

  const unconfigured = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent: "yes" }), IP, {}, created.deps);
  assert.equal(unconfigured.headers.get("location"), "/newsletter/#nl-retry");

  const down = harness(() => new Response("{}", { status: 500 }));
  const r3 = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent: "yes" }), IP, ENV, down.deps);
  assert.equal(r3.headers.get("location"), "/newsletter/#nl-retry");

  const limited = harness(backend({ result: "rate_limited", id: null, resend: false }));
  const r4 = await handleNewsletterRequest(formReq({ email: "pat@example.com", consent: "yes" }), IP, ENV, limited.deps);
  assert.equal(r4.headers.get("location"), "/newsletter/#nl-retry");
});

// --- privacy ------------------------------------------------------------------------------

test("logs never contain the email address, the IP, or a token", async () => {
  const h = harness(backend({ result: "created", id: ID, resend: true }));
  await handleNewsletterRequest(jsonReq({ ...human, email: "secret.person@example.com" }), IP, MAIL, h.deps);
  await handleNewsletterRequest(jsonReq({ ...human, email: "secret.person" }), IP, MAIL, h.deps);
  await handleNewsletterRequest(jsonReq({ elapsed_ms: 5000, email: "secret.person@example.com" }), IP, MAIL, h.deps);
  await handleNewsletterRequest(formReq({ email: "secret.person@example.com", consent: "yes" }), IP, MAIL, h.deps);
  const confirmToken = "A".repeat(43);
  const unsubToken = "11111111-2222-4333-8444-555555555555";
  const c = harness(() => rpcOk({ result: "confirmed" }));
  await confirmNewsletter(confirmToken, ENV, c.deps);
  const u = harness(() => rpcOk(true));
  await unsubscribeNewsletter(unsubToken, ENV, u.deps);
  const all = [...h.logs, ...c.logs, ...u.logs].join("\n");
  assert.ok(!all.includes("secret.person"), all);
  assert.ok(!all.includes(IP), all);
  assert.ok(!all.includes(confirmToken) && !all.includes(unsubToken), all);
  const mailToken = /token=([A-Za-z0-9_-]{43})/.exec(String(h.resendCalls()[0].body.text))![1];
  assert.ok(!all.includes(mailToken), "emailed token not logged");
});

// --- confirm / unsubscribe helpers -----------------------------------------------------------

test("confirmNewsletter: validates token shape first, maps every database result", async () => {
  for (const bad of ["", "short", "A".repeat(42), "A".repeat(44), "A".repeat(42) + "=", "A".repeat(42) + "/"]) {
    const h = harness(() => rpcOk({ result: "confirmed" }));
    assert.deepEqual(await confirmNewsletter(bad, ENV, h.deps), { result: "invalid" }, bad);
    assert.equal(h.calls.length, 0, `no database call for ${bad}`);
  }
  const token = "abcDEF0123456789_-abcDEF0123456789_-abcDEF0";
  for (const result of ["confirmed", "already", "invalid"]) {
    const h = harness(() => rpcOk({ result }));
    assert.deepEqual(await confirmNewsletter(token, ENV, h.deps), { result });
    assert.equal(h.calls[0].url, `${RPC}newsletter_confirm`);
    assert.match(String(h.calls[0].body.p_token_hash), /^[0-9a-f]{64}$/);
    assert.notEqual(h.calls[0].body.p_token_hash, token, "only the hash is sent");
  }
  assert.deepEqual(await confirmNewsletter(token, {}, harness(() => rpcOk({})).deps), { result: "not_configured" });
  assert.deepEqual(await confirmNewsletter(token, ENV, harness(() => new Response("{}", { status: 500 })).deps), { result: "unavailable" });
  assert.deepEqual(await confirmNewsletter(token, ENV, harness(() => rpcOk({ result: "maybe" })).deps), { result: "unavailable" });
});

test("unsubscribeNewsletter: validates uuid shape first; idempotent true is 'unsubscribed', unknown is 'invalid'", async () => {
  for (const bad of ["", "not-a-uuid", "11111111-2222-4333-8444-55555555555", "11111111222243338444555555555555", "' OR 1=1 --"]) {
    const h = harness(() => rpcOk(true));
    assert.deepEqual(await unsubscribeNewsletter(bad, ENV, h.deps), { result: "invalid" }, bad);
    assert.equal(h.calls.length, 0);
  }
  const token = "ABCDEF12-2222-4333-8444-555555555555";
  const yes = harness(() => rpcOk(true));
  assert.deepEqual(await unsubscribeNewsletter(token, ENV, yes.deps), { result: "unsubscribed" });
  assert.equal(yes.calls[0].url, `${RPC}newsletter_unsubscribe`);
  assert.equal(yes.calls[0].body.p_token, token.toLowerCase());
  assert.deepEqual(await unsubscribeNewsletter(token, ENV, harness(() => rpcOk(false)).deps), { result: "invalid" });
  assert.deepEqual(await unsubscribeNewsletter(token, {}, harness(() => rpcOk(true)).deps), { result: "not_configured" });
  assert.deepEqual(await unsubscribeNewsletter(token, ENV, harness(() => new Response("{}", { status: 502 })).deps), { result: "unavailable" });
  assert.deepEqual(await unsubscribeNewsletter(token, ENV, harness(() => rpcOk({ ok: 1 })).deps), { result: "unavailable" });
});

// --- email helpers ---------------------------------------------------------------------------

test("unsubscribe URL and one-click List-Unsubscribe headers", () => {
  const t = "11111111-2222-4333-8444-555555555555";
  assert.equal(unsubscribeUrl(t), `https://www.coveyapp.co/newsletter/unsubscribe/?token=${t}`);
  assert.deepEqual(listUnsubscribeHeaders(t), {
    "List-Unsubscribe": `<https://www.coveyapp.co/newsletter/unsubscribe/?token=${t}>, <mailto:hello@coveyapp.co?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
  const mail = newsletterConfirmationEmail("A".repeat(43));
  assert.equal(mail.subject, "Confirm your subscription to Covey Weekly");
  assert.ok(mail.text.includes(`https://www.coveyapp.co/newsletter/confirm/?token=${"A".repeat(43)}`));
});

test("newsletterRecipients returns subscribed rows and rejects a malformed answer", async () => {
  const rows = [{ email: "a@example.com", unsubscribe_token: "11111111-2222-4333-8444-555555555555" }];
  const h = harness(() => rpcOk(rows));
  assert.deepEqual(await newsletterRecipients({ url: ENV.supabaseUrl!, serviceKey: ENV.supabaseServiceKey! }, h.deps.fetch), rows);
  assert.equal(h.calls[0].url, `${RPC}newsletter_recipients`);
  await assert.rejects(
    newsletterRecipients({ url: ENV.supabaseUrl!, serviceKey: ENV.supabaseServiceKey! }, harness(() => rpcOk([{ email: 1 }])).deps.fetch),
  );
});

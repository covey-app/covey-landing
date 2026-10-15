// Unit tests for the /api/waitlist handler. No network: Supabase and Resend
// are replaced by a fake fetch that records every call.
//
//   npm run test:unit
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleWaitlistRequest, resetInstanceRateLimit, type WaitlistEnv } from "../../src/lib/waitlist/handler.ts";
import { cleanAttribution, isValidEmail, normalizeEmail } from "../../src/lib/waitlist/validate.ts";
import { isDisposableEmail } from "../../src/lib/waitlist/disposable.ts";

const ENV: WaitlistEnv = { supabaseUrl: "https://db.example.test", supabaseServiceKey: "sb_secret_test_key_123" };
const IP = "203.0.113.9";

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
  return { calls, logs, deps };
}

const rpcOk = (payload: unknown) =>
  new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });

function jsonReq(body: unknown): Request {
  return new Request("https://www.coveyapp.co/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formReq(fields: Record<string, string>): Request {
  return new Request("https://www.coveyapp.co/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const human = { elapsed_ms: 5000 };

beforeEach(() => resetInstanceRateLimit());

test("created: stores a normalized email with attribution and returns a follow-up token", async () => {
  const h = harness(() => rpcOk({ result: "created", id: "0b4c2f9e-1111-4222-8333-444455556666" }));
  const res = await handleWaitlistRequest(
    jsonReq({
      ...human,
      email: "  Pat.Doe@Example.COM ",
      source: "hero",
      utm_source: "instagram",
      utm_campaign: "launch",
      referrer: "https://l.instagram.com/some/path?secret=1",
      landing_path: "/?utm_source=instagram",
    }),
    IP,
    ENV,
    h.deps,
  );
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.result, "created");
  assert.match(json.followupToken, /^[A-Za-z0-9_-]{43}$/);

  assert.equal(h.calls.length, 1, "only the RPC is called when email is not configured");
  const [call] = h.calls;
  assert.equal(call.url, "https://db.example.test/rest/v1/rpc/waitlist_join");
  assert.equal((call.init.headers as Record<string, string>).apikey, ENV.supabaseServiceKey);
  assert.equal((call.init.headers as Record<string, string>).authorization, undefined, "sb_secret keys are not bearer JWTs");
  assert.equal(call.body.p_email, "pat.doe@example.com");
  assert.equal(call.body.p_source, "landing:hero");
  assert.equal(call.body.p_utm_source, "instagram");
  assert.equal(call.body.p_utm_campaign, "launch");
  assert.equal(call.body.p_referrer, "https://l.instagram.com/some/path", "referrer query string is dropped");
  assert.equal(call.body.p_landing_path, "/");
  assert.match(String(call.body.p_followup_token_hash), /^[0-9a-f]{64}$/);
  assert.notEqual(call.body.p_followup_token_hash, json.followupToken, "only the hash is stored");
  assert.match(String(call.body.p_client_key), /^[0-9a-f]{40}$/);
  assert.ok(!String(call.body.p_client_key).includes(IP), "IP is never sent raw");
});

test("legacy JWT service keys are also sent as a bearer token", async () => {
  const h = harness(() => rpcOk({ result: "existing", id: null }));
  await handleWaitlistRequest(jsonReq({ ...human, email: "a@b.co" }), IP, { ...ENV, supabaseServiceKey: "eyJhbGciOi.fake.jwt" }, h.deps);
  assert.equal((h.calls[0].init.headers as Record<string, string>).authorization, "Bearer eyJhbGciOi.fake.jwt");
});

test("existing: confirms without a token and without sending email", async () => {
  const h = harness(() => rpcOk({ result: "existing", id: null }));
  const res = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, { ...ENV, resendKey: "re_x", emailFrom: "Covey <hi@coveyapp.co>" }, h.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: "existing" });
  assert.equal(h.calls.length, 1, "no Resend call for an existing signup");
});

test("invalid email is rejected before the database", async () => {
  const h = harness(() => rpcOk({}));
  for (const email of ["", "nope", "a@b", "a b@c.co", "x@y.c", "prize<victim@example.com>", 'a"b@c.co', "a@b.co;c@d.co"]) {
    const res = await handleWaitlistRequest(jsonReq({ ...human, email }), IP, ENV, h.deps);
    assert.equal(res.status, 422, email);
    assert.deepEqual(await res.json(), { ok: false, error: "invalid_email" });
  }
  assert.equal(h.calls.length, 0);
});

test("honeypot, instant, and untimed submits look exactly like a new signup but store nothing", async () => {
  const h = harness(() => rpcOk({ result: "created", id: "x" }));
  for (const body of [
    { ...human, email: "bot@example.com", wl_check: "Acme" },
    { email: "bot@example.com", elapsed_ms: 40 },
    { email: "bot@example.com" }, // our form always sends elapsed_ms
  ]) {
    const res = await handleWaitlistRequest(jsonReq(body), IP, ENV, h.deps);
    assert.equal(res.status, 201, JSON.stringify(body));
    const json = await res.json();
    assert.equal(json.result, "created");
    assert.match(json.followupToken, /^[A-Za-z0-9_-]{43}$/, "decoy token, same shape as a real one");
  }
  assert.equal(h.calls.length, 0);
  assert.ok(h.logs.some((l) => l.includes("bot_suspected")));
});

test("IPv6 clients are rate-limited per /64, IPv4 per address", async () => {
  const { rateLimitSubject, clientKeyFor } = await import("../../src/lib/waitlist/handler.ts");
  assert.equal(rateLimitSubject("203.0.113.9"), "203.0.113.9");
  assert.equal(rateLimitSubject("2001:db8:abcd:12:1::5"), "2001:db8:abcd:12::/64");
  assert.equal(rateLimitSubject("2001:0DB8:abcd:0012:ffff:ffff:ffff:ffff"), "2001:db8:abcd:12::/64");
  assert.equal(rateLimitSubject("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(await clientKeyFor("2001:db8:abcd:12::1", "s"), await clientKeyFor("2001:db8:abcd:12:9:9:9:9", "s"));
  assert.notEqual(await clientKeyFor("2001:db8:abcd:12::1", "s"), await clientKeyFor("2001:db8:abcd:13::1", "s"));
});

test("missing configuration is a 503, never a fake success", async () => {
  const h = harness(() => rpcOk({}));
  const res = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, {}, h.deps);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, error: "not_configured" });
  assert.equal(h.calls.length, 0);
  assert.ok(h.logs.some((l) => l.includes("waitlist.not_configured")));
});

test("database and network failures are a 502", async () => {
  const down = harness(() => new Response("{}", { status: 500 }));
  const r1 = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, down.deps);
  assert.equal(r1.status, 502);
  assert.deepEqual(await r1.json(), { ok: false, error: "unavailable" });

  const offline = harness(() => {
    throw new TypeError("fetch failed");
  });
  const r2 = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, offline.deps);
  assert.equal(r2.status, 502);

  const garbage = harness(() => rpcOk({ surprise: true }));
  const r3 = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, garbage.deps);
  assert.equal(r3.status, 502);
});

test("database rate limit and database-side email rejection are surfaced", async () => {
  const limited = harness(() => rpcOk({ result: "rate_limited", id: null }));
  const r1 = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, limited.deps);
  assert.equal(r1.status, 429);
  assert.equal(r1.headers.get("retry-after"), "600");

  assert.ok(limited.logs.some((l) => l.includes('"limit":"window"')), "pre-hardening shape is treated as the window limit");

  const daily = harness(() => rpcOk({ result: "rate_limited", id: null, limit: "daily" }));
  const rd = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, daily.deps);
  assert.equal(rd.status, 429);
  assert.deepEqual(await rd.json(), { ok: false, error: "rate_limited" });
  assert.equal(rd.headers.get("retry-after"), "3600");
  assert.ok(daily.logs.some((l) => l.includes('"limit":"daily"')));

  const rejected = harness(() => new Response(JSON.stringify({ message: "invalid_email" }), { status: 400 }));
  const r2 = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, rejected.deps);
  assert.equal(r2.status, 422);
});

test("per-instance limiter trips before the database is hammered", async () => {
  const h = harness(() => rpcOk({ result: "existing", id: null }));
  const statuses: number[] = [];
  for (let i = 0; i < 14; i++) {
    statuses.push((await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), IP, ENV, h.deps)).status);
  }
  assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
  assert.deepEqual(statuses.slice(12), [429, 429]);
  assert.equal(h.calls.length, 12);
  // A different client is unaffected.
  const other = await handleWaitlistRequest(jsonReq({ ...human, email: "pat@example.com" }), "198.51.100.1", ENV, h.deps);
  assert.equal(other.status, 200);
});

test("no-JS form posts redirect to static pages", async () => {
  const h = harness(() => rpcOk({ result: "created", id: "x" }));
  const okRes = await handleWaitlistRequest(formReq({ email: "pat@example.com" }), IP, ENV, h.deps);
  assert.equal(okRes.status, 303);
  assert.equal(okRes.headers.get("location"), "/waitlist/joined/");
  assert.equal(h.calls[0].body.p_source, "landing:nojs");

  const bad = await handleWaitlistRequest(formReq({ email: "nope" }), IP, ENV, h.deps);
  assert.equal(bad.status, 303);
  assert.equal(bad.headers.get("location"), "/waitlist/#invalid-email");

  const unconfigured = await handleWaitlistRequest(formReq({ email: "pat@example.com" }), IP, {}, h.deps);
  assert.equal(unconfigured.headers.get("location"), "/waitlist/#try-again");
});

test("malformed, oversized, and unsupported bodies are a 400", async () => {
  const h = harness(() => rpcOk({}));
  const bad = new Request("https://www.coveyapp.co/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: "{nope" });
  assert.equal((await handleWaitlistRequest(bad, IP, ENV, h.deps)).status, 400);
  const big = jsonReq({ email: "a@b.co", pad: "x".repeat(5000) });
  assert.equal((await handleWaitlistRequest(big, IP, ENV, h.deps)).status, 400);
  const text = new Request("https://www.coveyapp.co/api/waitlist", { method: "POST", headers: { "content-type": "text/plain" }, body: "a@b.co" });
  assert.equal((await handleWaitlistRequest(text, IP, ENV, h.deps)).status, 400);
  assert.equal(h.calls.length, 0);
});

test("city follow-up: valid token updates, expired token is a 410, junk is a 400", async () => {
  let updated = true;
  const h = harness(() => rpcOk(updated));
  const token = "A".repeat(43);
  const r1 = await handleWaitlistRequest(jsonReq({ intent: "city", token, city: "davis" }), IP, ENV, h.deps);
  assert.equal(r1.status, 200);
  assert.equal(h.calls[0].url, "https://db.example.test/rest/v1/rpc/waitlist_set_city");
  assert.equal(h.calls[0].body.p_city, "davis");
  assert.match(String(h.calls[0].body.p_followup_token_hash), /^[0-9a-f]{64}$/);

  updated = false;
  const r2 = await handleWaitlistRequest(jsonReq({ intent: "city", token, city: "davis" }), IP, ENV, h.deps);
  assert.equal(r2.status, 410);

  const r3 = await handleWaitlistRequest(jsonReq({ intent: "city", token: "short", city: "davis" }), IP, ENV, h.deps);
  assert.equal(r3.status, 400);
  const r4 = await handleWaitlistRequest(jsonReq({ intent: "city", token, city: "atlantis" }), IP, ENV, h.deps);
  assert.equal(r4.status, 400);
  assert.equal(h.calls.length, 2);
});

test("confirmation email: sent once on create when configured; its failure never fails the signup", async () => {
  const h = harness((call) =>
    call.url.startsWith("https://api.resend.com") ? new Response("{}", { status: 500 }) : rpcOk({ result: "created", id: "abc" }),
  );
  const res = await handleWaitlistRequest(jsonReq({ ...human, email: "Pat@Example.com" }), IP, { ...ENV, resendKey: "re_test", emailFrom: "Covey <hello@coveyapp.co>" }, h.deps);
  assert.equal(res.status, 201);
  const sent = h.calls.find((c) => c.url === "https://api.resend.com/emails");
  assert.ok(sent, "Resend was called");
  assert.deepEqual(sent.body.to, ["pat@example.com"]);
  assert.equal((sent.init.headers as Record<string, string>)["idempotency-key"], "waitlist-confirm/abc");
  assert.ok(h.logs.some((l) => l.includes('"sent":false')));
});

test("logs never contain the email address or the IP", async () => {
  const h = harness(() => rpcOk({ result: "created", id: "x" }));
  await handleWaitlistRequest(jsonReq({ ...human, email: "secret.person@example.com" }), IP, ENV, h.deps);
  await handleWaitlistRequest(jsonReq({ ...human, email: "secret.person" }), IP, ENV, h.deps);
  const all = h.logs.join("\n");
  assert.ok(!all.includes("secret.person"), all);
  assert.ok(!all.includes(IP), all);
});

test("validate helpers", () => {
  assert.equal(normalizeEmail("  A@B.CO "), "a@b.co");
  assert.equal(isValidEmail("pat@example.com"), true);
  assert.equal(isValidEmail("pat@example"), false);
  assert.deepEqual(cleanAttribution({ utm_source: " ig\u0000 ", referrer: "javascript:alert(1)", landing_path: "nope" }), {
    utm_source: "ig",
  });
  assert.equal(cleanAttribution({ utm_term: "x".repeat(500) }).utm_term?.length, 200);
});

test("cross-site native form posts are refused; same-site and origin-less ones are allowed", async () => {
  const h = harness(() => rpcOk({ result: "existing", id: null }));
  const form = (origin?: string) =>
    new Request("https://www.coveyapp.co/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...(origin ? { origin } : {}) },
      body: "email=pat%40example.com",
    });
  assert.equal((await handleWaitlistRequest(form("https://evil.example"), IP, ENV, h.deps)).status, 400);
  assert.equal(h.calls.length, 0);
  assert.equal((await handleWaitlistRequest(form("https://www.coveyapp.co"), IP, ENV, h.deps)).status, 303);
  assert.equal((await handleWaitlistRequest(form(), IP, ENV, h.deps)).status, 303);
});

test("disposable domains are a 422 disposable_email before the database; no-JS goes to #invalid-email", async () => {
  const h = harness(() => rpcOk({ result: "created", id: "x" }));
  for (const email of [
    "pat@mailinator.com",
    "  Pat@MAILINATOR.com ",
    "someone@guerrillamail.com",
    "x@sharklasers.com",
    "x@10minutemail.com",
    "x@yopmail.com",
    "x@temp-mail.org",
    "x@trashmail.com",
    "x@getnada.com",
    "x@inbox.mailinator.com", // subdomain of a listed domain
  ]) {
    const res = await handleWaitlistRequest(jsonReq({ ...human, email }), IP, ENV, h.deps);
    assert.equal(res.status, 422, email);
    assert.deepEqual(await res.json(), { ok: false, error: "disposable_email" }, email);
  }
  assert.equal(h.calls.length, 0, "no RPC (and so no rate-limit row) for a throwaway address");
  assert.ok(h.logs.every((l) => !l.includes("mailinator")), "the domain isn't logged");

  const form = await handleWaitlistRequest(formReq({ email: "pat@yopmail.com" }), IP, ENV, h.deps);
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "/waitlist/#invalid-email");
  assert.equal(h.calls.length, 0);
});

test("disposable matching is by domain label, and privacy relays are allowed", async () => {
  for (const email of [
    "pat@notmailinator.com",
    "pat@mailinator.com.example.org",
    "pat@gmail.com",
    "pat@icloud.com",
    "abc123@privaterelay.appleid.com",
    "pat@duck.com",
    "pat@mozmail.com",
    "pat@simplelogin.com",
    "pat@proton.me",
    "pat@ucdavis.edu",
  ]) {
    assert.equal(isDisposableEmail(email), false, email);
  }
  assert.equal(isDisposableEmail("pat@mailinator.com."), true, "trailing dot");
  assert.equal(isDisposableEmail("pat@a.b.yopmail.fr"), true);

  const h = harness(() => rpcOk({ result: "created", id: "0b4c2f9e-1111-4222-8333-444455556666" }));
  const res = await handleWaitlistRequest(jsonReq({ ...human, email: "abc123@privaterelay.appleid.com" }), IP, ENV, h.deps);
  assert.equal(res.status, 201);
  assert.equal(h.calls.length, 1);
});

test("plus-tag and Gmail-dot variants are sent to the database as typed; dedupe is the database's job", async () => {
  const h = harness(() => rpcOk({ result: "existing", id: null }));
  const res = await handleWaitlistRequest(jsonReq({ ...human, email: " A.B+Covey@GoogleMail.com " }), IP, ENV, h.deps);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, result: "existing" });
  assert.equal(h.calls[0].body.p_email, "a.b+covey@googlemail.com", "send address is kept, only trimmed and lower-cased");
});

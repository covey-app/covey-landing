import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * /waitlist — the dedicated signup. /api/waitlist is mocked per test with
 * page.route so every state is deterministic; the real handler is covered by
 * tests/unit/waitlist-handler.test.ts, and one test below hits the real
 * endpoint (no database in CI → 503).
 */

const form = (page: Page) => page.locator("[data-waitlist][data-placement='page']");
const emailField = (page: Page) => form(page).getByLabel("Your email");
const face = (page: Page) => page.locator("[data-wl-quinn] [data-quinn-face]");

async function mockApi(page: Page, respond: (body: Record<string, unknown>) => { status: number; json?: unknown } | "abort") {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/waitlist", async (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    bodies.push(body);
    const r = respond(body);
    if (r === "abort") return route.abort("internetdisconnected");
    await new Promise((res) => setTimeout(res, 250));
    return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.json ?? {}) });
  });
  return bodies;
}

async function trackEvents(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    document.addEventListener("covey:track", (e) => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; data?: Record<string, unknown> }[] }).__events);
}

const waitLikeAPerson = (page: Page) => page.waitForTimeout(1300);

test("new signup: Quinn reacts, the flock cheers, focus moves, city follow-up, attribution, analytics", async ({ page }) => {
  const events = await trackEvents(page);
  const bodies = await mockApi(page, (body) =>
    body.intent === "city" ? { status: 200, json: { ok: true } } : { status: 201, json: { ok: true, result: "created", followupToken: "A".repeat(43) } },
  );
  await page.goto("/waitlist?utm_source=instagram&utm_medium=social&utm_campaign=fall-launch");
  await waitLikeAPerson(page);
  await expect(face(page)).toHaveAttribute("data-mood", "content");

  await emailField(page).focus();
  await expect(face(page)).toHaveAttribute("data-mood", "oh");
  await emailField(page).fill("  Pat.Doe@Example.com ");
  await form(page).getByRole("button", { name: "Join the waitlist" }).click();
  await expect(form(page).locator("[data-waitlist-submit]")).toHaveAttribute("aria-busy", "true");
  await expect(face(page)).toHaveAttribute("data-mood", "focused");

  const title = form(page).getByRole("heading", { name: "you're on the list!" });
  await expect(title).toBeFocused();
  await expect(face(page)).toHaveAttribute("data-mood", "laugh");
  await expect(page.locator("[data-wl]")).toHaveClass(/is-joined/);

  const join = bodies[0];
  expect(join).toMatchObject({ email: "pat.doe@example.com", source: "page", utm_source: "instagram", utm_campaign: "fall-launch", landing_path: "/waitlist", wl_check: "" });
  expect(Number(join.elapsed_ms)).toBeGreaterThan(1200);

  // Keyboard activation: the chip must keep focus (Safari doesn't focus
  // buttons on mouse click, so this is the case that matters).
  await form(page).getByRole("button", { name: "Davis" }).focus();
  await page.keyboard.press("Enter");
  await expect(form(page).getByText("Thanks — noted.")).toBeVisible();
  await expect(form(page).getByRole("button", { name: "Davis" })).toBeFocused();
  expect(bodies[1]).toEqual({ intent: "city", token: "A".repeat(43), city: "davis" });

  const names = (await events()).map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining(["waitlist_form_focus", "waitlist_submit", "waitlist_signup", "waitlist_city"]));
  expect(JSON.stringify(await events())).not.toContain("example.com");
});

test("already on the list: Quinn is unimpressed, no city step, no cheering", async ({ page }) => {
  await mockApi(page, () => ({ status: 200, json: { ok: true, result: "existing" } }));
  await page.goto("/waitlist");
  await waitLikeAPerson(page);
  await emailField(page).fill("pat@example.com");
  await emailField(page).press("Enter");
  await expect(form(page).getByRole("heading", { name: "you're already on the list." })).toBeVisible();
  await expect(face(page)).toHaveAttribute("data-mood", "unimpressed");
  await expect(form(page).locator("[data-waitlist-city]")).toBeHidden();
  await expect(page.locator("[data-wl]")).not.toHaveClass(/is-joined/);
});

test("invalid email: caught in the browser, Quinn is skeptical, no request", async ({ page }) => {
  const bodies = await mockApi(page, () => ({ status: 201, json: { ok: true, result: "created" } }));
  await page.goto("/waitlist");
  for (const bad of ["pat", "pat@example", "pat @example.com", "prize<victim@example.com>"]) {
    await emailField(page).fill(bad);
    await emailField(page).press("Enter");
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(form(page).getByRole("alert")).toContainText("doesn't look quite right");
    await expect(face(page)).toHaveAttribute("data-mood", "skeptical");
  }
  expect(bodies).toHaveLength(0);
  await emailField(page).fill("pat@example.com");
  await expect(emailField(page)).not.toHaveAttribute("aria-invalid", "true");
});

for (const [name, response, message] of [
  ["server says invalid", { status: 422, json: { ok: false, error: "invalid_email" } }, "doesn't look quite right"],
  ["rate limited", { status: 429, json: { ok: false, error: "rate_limited" } }, "Too many tries"],
  ["database down", { status: 502, json: { ok: false, error: "unavailable" } }, "couldn't save that"],
  ["not configured", { status: 503, json: { ok: false, error: "not_configured" } }, "couldn't save that"],
  ["non-JSON gateway error", { status: 504 }, "couldn't save that"],
] as const) {
  test(`failure (${name}) keeps the email and explains`, async ({ page }) => {
    await mockApi(page, () => response);
    await page.goto("/waitlist");
    await waitLikeAPerson(page);
    await emailField(page).fill("pat@example.com");
    await emailField(page).press("Enter");
    await expect(form(page).getByRole("alert")).toContainText(message);
    await expect(emailField(page)).toHaveValue("pat@example.com");
    await expect(form(page).locator("[data-waitlist-submit]")).toHaveAttribute("aria-busy", "false");
    await expect(form(page).locator("[data-waitlist-success]")).toBeHidden();
  });
}

test("offline, then a retry succeeds", async ({ page }) => {
  let offline = true;
  await mockApi(page, () => (offline ? "abort" : { status: 201, json: { ok: true, result: "created" } }));
  await page.goto("/waitlist");
  await waitLikeAPerson(page);
  await emailField(page).fill("pat@example.com");
  await emailField(page).press("Enter");
  await expect(form(page).getByRole("alert")).toContainText("couldn't reach Covey");
  await expect(emailField(page)).toHaveValue("pat@example.com");
  offline = false;
  await form(page).getByRole("button", { name: "Join the waitlist" }).click();
  await expect(form(page).getByRole("heading", { name: "you're on the list!" })).toBeVisible();
});

test("repeated clicks send exactly one request", async ({ page }) => {
  const bodies = await mockApi(page, () => ({ status: 201, json: { ok: true, result: "created" } }));
  await page.goto("/waitlist");
  await waitLikeAPerson(page);
  await emailField(page).fill("pat@example.com");
  const submit = form(page).locator("[data-waitlist-submit]");
  await submit.click();
  await submit.click({ force: true });
  await emailField(page).press("Enter").catch(() => {});
  await expect(form(page).getByRole("heading", { name: "you're on the list!" })).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test("the real endpoint never pretends to succeed without a database", async ({ page }) => {
  test.skip(!!process.env.SUPABASE_URL, "a database is configured for this run");
  await page.goto("/waitlist");
  await waitLikeAPerson(page);
  await emailField(page).fill("pat@example.com");
  await emailField(page).press("Enter");
  await expect(form(page).getByRole("alert")).toContainText("couldn't save that");
  await expect(form(page).locator("[data-waitlist-success]")).toBeHidden();
});

for (const [w, h] of [[320, 568], [375, 667], [390, 844]] as const) {
  test(`phones: the email field and button are on the first screen at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/waitlist");
    // Measure the settled layout, not the entrance mid-flight.
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    const box = await form(page).locator("[data-waitlist-submit]").boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(Math.min(h, 560));
  });
}

test("no-JS error anchors reveal their message", async ({ page }) => {
  await page.goto("/waitlist");
  await expect(page.locator("#invalid-email")).toBeHidden();
  await page.goto("/waitlist#invalid-email");
  await expect(page.locator("#invalid-email")).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the form still posts natively, with native validation on", async ({ page }) => {
    await page.goto("/waitlist");
    const f = form(page).locator("form");
    await expect(f).toHaveAttribute("method", "post");
    await expect(f).toHaveAttribute("action", "/api/waitlist");
    expect(await f.evaluate((el) => (el as HTMLFormElement).noValidate)).toBe(false);
  });
});

test("the home hero CTA opens the waitlist page", async ({ page }) => {
  await page.goto("/");
  await page.locator("a[data-cta='hero']").click();
  await expect(page).toHaveURL(/\/waitlist\/?$/);
  await expect(emailField(page)).toBeEditable();
});

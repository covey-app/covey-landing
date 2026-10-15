import { mockWeather } from "./fixtures/weather";
import { test, expect, type Page } from "@playwright/test";

/**
 * Covey Weekly: the editorial pages (the real first edition), the subscription form
 * (mocked /api/newsletter), and the server-rendered confirm / unsubscribe
 * pages (real, via the built function; no database in CI).
 */

const CONSENT = "Send me Covey's weekly email of things to do in San Francisco. I can unsubscribe anytime.";
const slip = (page: Page) => page.locator("[data-newsletter][data-placement='newsletter-page']");

async function mockNewsletter(page: Page, json: unknown, status = 200) {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/newsletter", async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await new Promise((r) => setTimeout(r, 200));
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  });
  return bodies;
}

test("the newsletter page: masthead, two-part promise, latest picks, archive, and it isn't the waitlist", async ({ page }) => {
  await page.goto("/newsletter");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("covey");
  await expect(page.getByText("Top picks", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready-made plans", { exact: true })).toBeVisible();
  await expect(page.getByText("The complete guide", { exact: true })).toBeVisible();
  // The latest edition's lead pick plus four, two to a row.
  await expect(page.locator(".latest .pick")).toHaveCount(5);
  // One edition so far, so no archive yet; it appears with the second.
  await expect(page.locator(".archive-row")).toHaveCount(0);
  await expect(page.getByText("This isn't the app waitlist")).toBeVisible();
  await expect(slip(page).locator(".nl-consent")).toContainText(CONSENT);
  await expect(page.locator("main a[data-cta]")).toHaveCount(0);
});

for (const [name, json, title] of [
  ["confirmation sent", { ok: true, result: "pending", confirmation: "sent" }, "check your inbox."],
  ["confirmation deferred (no email provider)", { ok: true, result: "pending", confirmation: "deferred" }, "you're signed up."],
  ["already subscribed", { ok: true, result: "subscribed" }, "you're already subscribed."],
] as const) {
  test(`subscribe: ${name}`, async ({ page }) => {
    const bodies = await mockNewsletter(page, json);
    await page.goto("/newsletter?utm_source=tiktok");
    await page.waitForTimeout(1300);
    await slip(page).getByLabel("Your email").fill("Pat@Example.com");
    await slip(page).getByRole("button", { name: /Subscribe/ }).click();
    await expect(slip(page).locator("[data-nl-done-title]")).toHaveText(title);
    await expect(slip(page).locator("[data-nl-done-title]")).toBeFocused();
    expect(bodies[0]).toMatchObject({ email: "pat@example.com", consent: true, source: "newsletter-page", utm_source: "tiktok", wl_check: "" });
  });
}

test("subscribe: invalid email and server errors keep the email and explain", async ({ page }) => {
  const bodies = await mockNewsletter(page, { ok: false, error: "unavailable" }, 502);
  await page.goto("/newsletter");
  const email = slip(page).getByLabel("Your email");
  await email.fill("pat@nowhere");
  await email.press("Enter");
  await expect(slip(page).getByRole("alert")).toContainText("doesn't look quite right");
  expect(bodies).toHaveLength(0);
  await page.waitForTimeout(1300);
  await email.fill("pat@example.com");
  await email.press("Enter");
  await expect(slip(page).getByRole("alert")).toContainText("couldn't save that");
  await expect(email).toHaveValue("pat@example.com");
});

test("an edition is the curated version: note, weather, detailed picks, plans, quick lists, full guide", async ({ page }) => {
  await mockWeather(page);
  await page.goto("/newsletter/2026-10-12?today=2026-10-14");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("vampires, vintage cars, and market street after dark");
  await expect(page.locator(".ed-rule")).toContainText("No. 1");
  await expect(page.locator(".kicker").first()).toContainText("Oct 17–18");
  await expect(page.locator(".ed-glance")).toContainText(/20\s*things to do/);

  // Contents link to every section that exists.
  const toc = await page.locator(".ed-toc a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
  expect(toc).toEqual(["#note", "#weather", "#picks", "#plans", "#lists", "#guide"]);
  for (const href of toc) await expect(page.locator(href!)).toBeAttached();

  await expect(page.locator("#note .ed-letter")).toContainText("Halloween has taken over");

  // Weather plan: only the edition's days (Sat, Sun).
  const wx = page.locator("#ed-weather [data-wx-live] .wx-day");
  await expect(wx).toHaveCount(2);
  expect(await wx.evaluateAll((els) => els.map((e) => e.getAttribute("data-date")))).toEqual(["2026-10-17", "2026-10-18"]);

  // Six picks: two leads, then four two to a row; tips ride along.
  await expect(page.locator("#picks .pick")).toHaveCount(6);
  await expect(page.locator("#picks .pick--lg")).toHaveCount(2);
  await expect(page.locator("#picks .pick-tips").first()).toBeVisible();

  // Plans read like plans: stops in order, each linked out.
  const plans = page.locator("#plans .plan");
  await expect(plans).toHaveCount(3);
  await expect(plans.first().locator(".stop")).toHaveCount(3);
  await expect(plans.first().locator(".stop-title").first()).toContainText("38th SF Old Car Picnic");

  // Quick lists jump to the entry in the guide.
  const free = page.locator("#lists .ed-list").first();
  await expect(free.locator(".ed-list-t")).toContainText("free");
  const target = await free.locator("a").first().getAttribute("href");
  await expect(page.locator(target!)).toBeAttached();

  // The guide: by day, then part of day, with the detail /activities leaves out.
  const guide = page.locator("#ed-guide");
  await expect(guide.locator(".eg-day")).toHaveCount(2);
  expect(await guide.locator(".eg-day").first().locator(".eg-part-title").allTextContents()).toEqual(["Morning", "Afternoon", "Late"]);
  await expect(guide.locator(".eg-pick")).toHaveCount(6);
  await expect(guide.getByText("Listings say 7pm or 8pm; confirm the time before you go")).toBeVisible();
  await expect(guide.getByText("3158 Mission St", { exact: false })).toBeVisible();
  const links = await guide.locator(".eg-title a").evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThanOrEqual(20);
  expect(links.every((h) => h.startsWith("https://") && !h.includes("google.com/url"))).toBeTruthy();
  await expect(page.locator("#guide a[href='/activities']")).toBeVisible();
});

test("every edition builds an email with an unsubscribe placeholder", async ({ request }) => {
  const res = await request.get("/newsletter/2026-10-12/email/");
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toContain("ready-made plans");
  expect(html).toContain("Halloween has taken over");
  expect(html).toContain("Free with an RSVP; a few shows are ticketed");
  expect(html).toContain("%%UNSUBSCRIBE_URL%%");
  expect(html).toContain('name="robots" content="noindex"');
});

test("confirm: a GET never confirms — it asks; a bad token says so", async ({ page }) => {
  await page.goto(`/newsletter/confirm/?token=${"A".repeat(43)}`);
  await expect(page.locator("[data-confirm-state]")).toHaveAttribute("data-confirm-state", "ask");
  await expect(page.getByRole("button", { name: "Confirm subscription" })).toBeVisible();
  await page.goto("/newsletter/confirm/?token=not-a-token");
  await page.getByRole("button", { name: "Confirm subscription" }).click();
  await expect(page.locator("[data-confirm-state]")).toHaveAttribute("data-confirm-state", "invalid");
  await page.goto("/newsletter/confirm/");
  await expect(page.locator("[data-confirm-state]")).toHaveAttribute("data-confirm-state", "invalid");
});

test("unsubscribe: GET asks; the RFC 8058 one-click POST (no Origin) is accepted", async ({ page, request }) => {
  const token = "11111111-1111-4111-8111-111111111111";
  await page.goto(`/newsletter/unsubscribe/?token=${token}`);
  await expect(page.getByRole("button", { name: "Unsubscribe" })).toBeVisible();
  const oneClick = await request.post(`/newsletter/unsubscribe/?token=${token}`, {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: "List-Unsubscribe=One-Click",
  });
  expect(oneClick.status()).toBe(200);
  // Without a database the page says it couldn't, rather than pretending.
  expect(await oneClick.text()).toContain('data-unsubscribe-state="unavailable"');
});

test("cross-site native form posts to the signup endpoints are refused", async ({ request }) => {
  const res = await request.post("/api/newsletter", {
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://evil.example" },
    data: "email=pat%40example.com&consent=yes",
  });
  expect(res.status()).toBe(400);
});

import { test, expect } from "@playwright/test";

/**
 * Regression coverage for the 2026-09-26 landing audit
 * (docs/landing-audit-2026-09-26.md). Each test names the finding it guards.
 */

test.describe("header (P2-1: dead hamburger on desktop)", () => {
  test("menu button is hidden on wide screens and nav is visible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.locator("[data-menu-btn]")).toBeHidden();
    await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();
  });

  test("menu button works on phones and holds the primary CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden();
    await page.locator("[data-menu-btn]").click();
    const panel = page.locator("[data-menu-panel]");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Join Covey" })).toHaveAttribute(
      "href",
      "https://go.coveyapp.co/login",
    );
  });
});

test.describe("calls to action (P0-1, P0-3)", () => {
  test("every Join Covey link goes to the product's join screen", async ({ page }) => {
    await page.goto("/");
    const joins = page.getByRole("link", { name: "Join Covey" });
    expect(await joins.count()).toBeGreaterThan(1);
    for (const href of await joins.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      expect(href).toBe("https://go.coveyapp.co/login");
    }
    const signIn = page.getByRole("link", { name: "Sign in" }).first();
    await expect(signIn).toHaveAttribute("href", "https://go.coveyapp.co/login");
  });

  test("no page promises a waitlist or email capture that doesn't exist", async ({ page }) => {
    for (const route of ["/", "/about", "/events", "/testimonials", "/support"]) {
      await page.goto(route);
      const text = (await page.locator("main").innerText()).toLowerCase();
      expect(text, route).not.toContain("waitlist");
      expect(text, route).not.toContain("drop your email");
    }
  });

  test("group size claims match the product (P0-4)", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/2[–-]10|two (and|to) ten|ten to fifteen/i);
  });
});

test("/signup forwards to the product (P0-2: covey-web links here)", async ({ request }) => {
  const res = await request.get("/signup");
  expect(res.ok()).toBeTruthy();
  const html = await res.text();
  expect(html).toContain('http-equiv="refresh"');
  expect(html).toContain("url=https://go.coveyapp.co/login");
  expect(html).toContain('name="robots" content="noindex"');
});

test.describe("plan demo", () => {
  test("tabs follow the WAI-ARIA pattern with arrow keys", async ({ page }) => {
    await page.goto("/");
    const itinerary = page.locator("[data-tab='itinerary']");
    await itinerary.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("[data-tab='map']")).toBeFocused();
    await expect(page.locator("[data-tab='map']")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#demo-panel-map")).toBeVisible();
    await expect(page.locator("#demo-panel-itinerary")).toBeHidden();
    await page.keyboard.press("End");
    await expect(page.locator("#demo-panel-group")).toBeVisible();
    await page.keyboard.press("Home");
    await expect(page.locator("#demo-panel-itinerary")).toBeVisible();
  });

  test("plan picker swaps every view to the chosen plan", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-pick='ramen']").click();
    await expect(page.locator("[data-pick='ramen']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".demo-summary [data-plan='ramen']")).toBeVisible();
    await expect(page.locator(".demo-summary [data-plan='sunset']")).toBeHidden();
    await expect(page.locator("#demo-panel-itinerary [data-plan='ramen']")).toBeVisible();
  });

  test("demo join is local, reversible, and says nothing was sent", async ({ page }) => {
    await page.goto("/");
    const plan = page.locator(".demo-summary [data-plan='sunset']");
    const going = plan.locator("[data-going]");
    await expect(going).toHaveText("4/6 going");
    await plan.locator("[data-join]").click();
    await expect(going).toHaveText("5/6 going");
    await expect(page.locator("[data-live]")).toContainText("Nothing was actually sent");
    await plan.locator("[data-join]").click();
    await expect(going).toHaveText("4/6 going");
  });
});

test("reduced motion shows the hero plan fully, with no entrance", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  const opacities = await page
    .locator(".invite-sheet, .invite-stop-body, .invite-orb, .reveal")
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
  expect(opacities.every((o) => o === "1")).toBeTruthy();
  await ctx.close();
});

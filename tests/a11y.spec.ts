import { test, expect } from "@playwright/test";
import { mockWeather } from "./fixtures/weather";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// Contrast is judged on the settled page. The hero entrance runs ≤ 2.1s; axe
// reading a half-faded label mid-animation is a false positive, not a defect.
const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/testimonials",
  "/activities?today=2026-10-14",
  "/newsletter",
  "/newsletter/2026-10-12?today=2026-10-14",
  "/terms",
  "/privacy",
  "/safety",
  "/deletion",
  "/status",
  "/support",
  "/waitlist",
  "/waitlist/joined",
];

test.describe("accessibility (axe)", () => {
  for (const route of ROUTES) {
    test(`${route} has no serious/critical violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await mockWeather(page);
      await page.goto(route, { waitUntil: "networkidle" });
      await settle(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(
        serious,
        serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
      ).toEqual([]);
    });
  }

  test("dark mode home has no serious/critical violations", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/", { waitUntil: "networkidle" });
    await settle(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious.map((v) => v.id)).toEqual([]);
  });

  // Weather cards are tinted per mood and drawn by script; check them in dark too.
  for (const route of ["/activities?today=2026-10-14", "/newsletter/2026-10-12?today=2026-10-14"]) {
    test(`dark mode ${route} (weather plans drawn) has no serious/critical violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "dark" });
      await mockWeather(page);
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("[data-wx-live] .wx-day").first()).toBeVisible();
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
    });
  }

  // The waitlist form's error and success states only exist after interaction.
  for (const scheme of ["light", "dark"] as const) {
    test(`waitlist error and success states (${scheme}) have no serious/critical violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      let ok = false;
      await page.route("**/api/waitlist", (route) =>
        ok
          ? route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, result: "created", followupToken: "A".repeat(43) }) })
          : route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "unavailable" }) }),
      );
      await page.goto("/waitlist", { waitUntil: "networkidle" });
      await settle(page);
      const hero = page.locator("[data-waitlist][data-placement='page']");
      await page.waitForTimeout(1300);
      await hero.getByLabel("Your email").fill("pat@example.com");
      await hero.getByLabel("Your email").press("Enter");
      await expect(hero.getByRole("alert")).not.toBeEmpty();
      const check = async () => {
        const results = await new AxeBuilder({ page }).include("[data-waitlist][data-placement='page']").withTags(["wcag2a", "wcag2aa"]).analyze();
        return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help}`);
      };
      expect(await check()).toEqual([]);
      ok = true;
      await hero.getByRole("button", { name: "Join the waitlist" }).click();
      await expect(hero.locator("[data-waitlist-success]")).toBeVisible();
      await settle(page);
      expect(await check()).toEqual([]);
    });
  }
});

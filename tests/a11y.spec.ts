import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

// Contrast is judged on the settled page. The hero entrance runs ≤ 1.1s; axe
// reading a half-faded label mid-animation is a false positive, not a defect.
const settle = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/testimonials",
  "/events",
  "/terms",
  "/privacy",
  "/safety",
  "/deletion",
  "/status",
  "/support",
];

test.describe("accessibility (axe)", () => {
  for (const route of ROUTES) {
    test(`${route} has no serious/critical violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
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
});

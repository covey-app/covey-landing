import { test, expect } from "@playwright/test";

const ROUTES = [
  "/",
  "/about",
  "/contact",
  "/signup",
  "/testimonials",
  "/events",
  "/privacy",
  "/support",
  "/thanks",
];

const WIDTHS = [320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1440, 1920];

test.describe("no horizontal overflow", () => {
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      test(`${route} @ ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route, { waitUntil: "networkidle" });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        // Allow 1px for sub-pixel rounding.
        expect(scrollWidth, `${route} overflows at ${width}px`).toBeLessThanOrEqual(
          clientWidth + 1,
        );
      });
    }
  }
});

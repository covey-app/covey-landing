import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

/**
 * `networkidle` says nothing about CSS animations, and the hero
 * (DefinitionMoment) fades its word, pronunciation and definitions in from
 * `opacity: 0` with delays up to ~0.8s. Auditing mid-fade makes axe measure
 * blended intermediate colors against the background, so the color-contrast
 * results swing wildly from run to run. Wait for every finite animation to
 * settle so we audit the colors a user actually reads.
 */
async function gotoSettled(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => {
      if (a.playState === "finished") return true;
      // Looping animations (e.g. the button spinner) never finish.
      return a.effect?.getComputedTiming().iterations === Infinity;
    }),
  );
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

test.describe("accessibility (axe)", () => {
  for (const route of ROUTES) {
    test(`${route} has no serious/critical violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await gotoSettled(page, route);
      const serious = await seriousViolations(page);
      expect(
        serious,
        serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
      ).toEqual([]);
    });
  }

  /*
   * The home page carries all the decorative motion, so audit it across both
   * color schemes and both motion preferences. Reduced motion is a distinct
   * rendered state — it skips the fade-in rules entirely — and is worth
   * auditing in its own right rather than being used only to stabilise the
   * default-motion run.
   */
  for (const colorScheme of ["light", "dark"] as const) {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      test(`home (${colorScheme}, motion: ${reducedMotion}) has no serious/critical violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme, reducedMotion });
        await gotoSettled(page, "/");
        const serious = await seriousViolations(page);
        expect(
          serious,
          serious.map((v) => `${v.id}: ${v.help}`).join("\n"),
        ).toEqual([]);
      });
    }
  }
});

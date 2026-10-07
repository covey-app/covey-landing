import { test, expect } from "@playwright/test";

test("primary nav marks the current page", async ({ page }) => {
  await page.goto("/about");
  const current = page.locator('nav[aria-label="Primary"] a[aria-current="page"]');
  await expect(current).toHaveText(/About/i);
});

test("mobile menu opens, closes on Escape, and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const btn = page.locator("[data-menu-btn]");
  const panel = page.locator("[data-menu-panel]");
  await expect(panel).toBeHidden();
  await btn.click();
  await expect(panel).toBeVisible();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(btn).toBeFocused();
});

test("theme toggle flips the dark class and aria-pressed", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("[data-theme-toggle]").first();
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  await toggle.click();
  const after = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(after).toBe(!before);
  await expect(toggle).toHaveAttribute("aria-pressed", String(after));
});

test("FAQ exposes native expanded state", async ({ page }) => {
  await page.goto("/");
  const details = page.locator("details.faq-item").first();
  await expect(details).not.toHaveAttribute("open", /.*/);
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", /.*/);
});

test("contact and support offer email, not a form that goes nowhere", async ({ page }) => {
  // The Netlify form was removed: the site runs on Vercel, where it did nothing.
  for (const route of ["/contact", "/support"]) {
    await page.goto(route);
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator('main a[href="mailto:support@coveyapp.co"]').first()).toBeVisible();
  }
});

test("interactive touch targets meet 44px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  for (const sel of ["[data-theme-toggle]", "[data-menu-btn]"]) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box, sel).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

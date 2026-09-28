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

test("contact form surfaces validation before submit", async ({ page }) => {
  await page.goto("/contact");
  await page.locator("form[name='contact'] button[type='submit']").click();
  const name = page.locator("#field-name");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  // Still on the contact page (submit was blocked).
  await expect(page).toHaveURL(/\/contact\/?$/);
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

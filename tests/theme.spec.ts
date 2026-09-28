import { test, expect } from "@playwright/test";

/**
 * Theme toggle must flip the page palette on phones and desktops, and keep
 * the choice across soft navigations (ClientRouter).
 */
test.describe("theme toggle", () => {
  test("toggles dark class and persists across navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const html = page.locator("html");
    const toggle = page.locator("[data-theme-toggle]");
    await expect(toggle).toBeVisible();

    // Force a known starting point.
    await page.evaluate(() => {
      localStorage.setItem("covey-theme", "light");
      document.documentElement.classList.remove("dark");
    });
    await page.reload({ waitUntil: "networkidle" });
    await expect(html).not.toHaveClass(/dark/);

    const bgBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
    );

    await toggle.click();
    await expect(html).toHaveClass(/dark/);

    const bgAfter = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
    );
    expect(bgAfter.toLowerCase()).not.toBe(bgBefore.toLowerCase());
    expect(bgAfter.toLowerCase()).toBe("#0e0e10");

    const stored = await page.evaluate(() => localStorage.getItem("covey-theme"));
    expect(stored).toBe("dark");

    // Soft-nav to another page — theme must stay dark.
    // On phones the primary nav is in the hamburger panel.
    const desktopAbout = page.locator('nav[aria-label="Primary"] a[href="/about"]');
    if (await desktopAbout.isVisible()) {
      await desktopAbout.click();
    } else {
      await page.locator("[data-menu-btn]").click();
      await page.locator('#mobile-menu a[href="/about"]').click();
    }
    await page.waitForURL("**/about**");
    await expect(html).toHaveClass(/dark/);

    // Toggle back to light.
    await page.locator("[data-theme-toggle]").click();
    await expect(html).not.toHaveClass(/dark/);
    const storedLight = await page.evaluate(() => localStorage.getItem("covey-theme"));
    expect(storedLight).toBe("light");
  });
});

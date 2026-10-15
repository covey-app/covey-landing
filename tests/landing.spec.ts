import { test, expect } from "@playwright/test";

/**
 * Site structure, navigation, and the redesign's acceptance criteria
 * (docs/redesign-2026-10.md): distinct pages, the primary mark used only to
 * identify the brand, no app-icon tile in the hero, at most two prominent
 * waitlist CTAs on the home page, and motion that respects reduced motion.
 */

test.describe("navigation", () => {
  test("desktop: three destinations, the current one marked, one waitlist CTA", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [path, label] of [
      ["/activities", "Activities"],
      ["/newsletter", "Newsletter"],
      ["/about", "About"],
    ] as const) {
      await page.goto(path);
      const nav = page.locator('nav[aria-label="Primary"]');
      await expect(nav.getByRole("link")).toHaveText(["Activities", "Newsletter", "About"]);
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(label);
    }
    await expect(page.locator("[data-menu-btn]")).toBeHidden();
    await expect(page.locator("header a[data-cta='header']")).toHaveAttribute("href", "/waitlist");
  });

  test("the waitlist page doesn't advertise itself in the header", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/waitlist");
    await expect(page.locator("header a[data-cta='header']")).toHaveCount(0);
  });

  test("phones: full-screen menu with every destination, the CTA, and sign in", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden();
    await page.locator("[data-menu-btn]").click();
    const menu = page.locator("[data-menu-panel]");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".menu-list a")).toHaveText(["Home", "Activities", "Newsletter", "About"]);
    await expect(menu.getByRole("link", { name: "Join the waitlist" })).toHaveAttribute("href", "/waitlist");
    await expect(menu.getByRole("link", { name: /Sign in/ })).toHaveAttribute("href", "https://go.coveyapp.co/login");
  });

  test("soft navigation between pages keeps working (view transitions)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.locator('nav[aria-label="Primary"]').getByRole("link", { name: "Activities" }).click();
    await expect(page).toHaveURL(/\/activities\/?$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("what's on.");
    await page.locator('nav[aria-label="Primary"]').getByRole("link", { name: "Newsletter" }).click();
    await expect(page).toHaveURL(/\/newsletter\/?$/);
    await expect(page.locator('nav[aria-label="Primary"] a[aria-current="page"]')).toHaveText("Newsletter");
  });
});

test.describe("home page (acceptance criteria)", () => {
  test("at most two prominent waitlist CTAs — header and hero — and no form", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const visible = await page.locator("a[data-cta]").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => [e.getAttribute("data-cta"), e.getAttribute("href")]),
    );
    expect(visible).toEqual([
      ["header", "/waitlist"],
      ["hero", "/waitlist"],
    ]);
    await expect(page.locator("main form[action='/api/waitlist']")).toHaveCount(0);
  });

  test("the hero is a cast, not an app-icon tile; the primary mark stays in the header and footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main img[src*='app-icon']")).toHaveCount(0);
    await expect(page.locator("main .tile")).toHaveCount(0);
    await expect(page.locator("[data-hero] img[src*='/brand/flock/']")).not.toHaveCount(0);
    await expect(page.locator("[data-hero] [data-quinn]")).toHaveCount(1);
    expect(await page.locator("header img[src*='app-icon'], footer img[src*='app-icon']").count()).toBe(2);
  });

  test("contextual actions lead to the newsletter and activities, not more waitlist buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main [data-newsletter]")).toHaveCount(1);
    await expect(page.locator("main a[href='/activities']")).not.toHaveCount(0);
  });

  test("group size claims match the product", async ({ page }) => {
    for (const route of ["/", "/about"]) {
      await page.goto(route);
      const text = await page.locator("main").innerText();
      expect(text, route).not.toMatch(/2[–-]10|two (and|to) ten|ten to fifteen/i);
    }
  });

  test("Quinn turns into the 3D model once the page settles, and the poster steps aside", async ({ page, browserName }) => {
    // Headless WebGL is software-rendered and only dependable in Chromium.
    test.skip(browserName !== "chromium", "WebGL 2 in headless Chromium only");
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const stand = page.locator(".hero-quinn");
    await expect(stand).toHaveAttribute("data-quinn3d", "ready", { timeout: 45_000 });
    await expect(stand.locator("canvas.quinn-3d")).toHaveCount(1);
    await expect(stand.locator("[data-quinn]")).toHaveCSS("opacity", "0");
    expect(errors).toEqual([]);
  });

  test("without WebGL, the illustrated Quinn stays put", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/.test(type) ? null : getContext.call(this, type as "2d", ...(rest as []));
      } as typeof getContext;
    });
    for (const [route, host] of [["/", ".hero-quinn"], ["/about", ".quinn-turn"]]) {
      await page.goto(route);
      const stand = page.locator(host);
      await stand.scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");
      await expect(stand, route).not.toHaveAttribute("data-quinn3d");
      await expect(stand.locator("canvas"), route).toHaveCount(0);
      await expect(stand.locator("[data-quinn]"), route).toHaveCSS("opacity", "1");
    }
    expect(errors).toEqual([]);
  });

  test("the hero entrance plays once per session", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-hero]")).toHaveClass(/is-intro/);
    await page.reload();
    await expect(page.locator("[data-hero]")).not.toHaveClass(/is-intro/);
    // The CTA is usable immediately either way.
    await expect(page.locator("a[data-cta='hero']")).toBeVisible();
  });
});

test("/about: the 3D Quinn loads as \"meet quinn\" approaches and stands in for the poster", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "WebGL 2 in headless Chromium only");
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/about");
  const stand = page.locator(".quinn-turn");
  await page.waitForLoadState("networkidle");
  await expect(stand.locator("canvas")).toHaveCount(0); // not until the section is near
  await stand.scrollIntoViewIfNeeded();
  await expect(stand).toHaveAttribute("data-quinn3d", "ready", { timeout: 45_000 });
  await expect(stand.locator("[data-quinn]")).toHaveCSS("opacity", "0");
  expect(errors).toEqual([]);
});

test("reduced motion: final frames, no entrance, pinned beats fully visible", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("[data-hero]")).not.toHaveClass(/is-intro/);
  const opacities = await page
    .locator("[data-hero] .bird-art, [data-hero] .line > span, .problem .beat, .problem .answer, [data-reveal]")
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
  expect(opacities.length).toBeGreaterThan(10);
  expect(opacities.every((o) => o === "1")).toBeTruthy();
  await ctx.close();
});

test("redirects: /signup → /waitlist, /events → /activities", async ({ request }) => {
  const signup = await request.get("/signup", { maxRedirects: 0 });
  expect(signup.status()).toBe(307);
  expect(signup.headers()["location"]).toBe("/waitlist");
  const events = await request.get("/events", { maxRedirects: 0 });
  expect(events.status()).toBe(308);
  expect(events.headers()["location"]).toBe("/activities");
  const fallback = await (await request.get("/signup/index.html")).text();
  expect(fallback).toContain("url=/waitlist");
});

test.describe("public claims match the 1.0 build (App Store audit F-14)", () => {
  const ROUTES = ["/", "/about", "/support", "/safety", "/deletion", "/contact", "/status"];

  test("no invite gate, no 'verified' adults, no availability feature", async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const text = (await page.locator("main").innerText()).toLowerCase();
      expect(text, route).not.toContain("by invite");
      // "invite-only" is allowed: it is a real Covey and plan join mode.
      expect(text, route).not.toMatch(/ios (launch|app is rolling out)/);
      expect(text, route).not.toContain("adults, verified");
      expect(text, route).not.toContain("everyone free");
    }
  });

  test("the App Store listing is named but not claimed live while appStoreUrl is null", async ({ page }) => {
    await page.goto("/support");
    const text = await page.locator("main").innerText();
    expect(text).toContain("Covey: Do It Together");
    expect(text).toContain("coming soon to the App Store");
  });

  test("/deletion names the in-app path and the photo window", async ({ page }) => {
    await page.goto("/deletion");
    const text = await page.locator("main").innerText();
    expect(text).toContain("Profile → Settings → Account → Delete account");
    expect(text).toContain("24 hours");
  });
});

test.describe("legal documents (App Store audit F-01)", () => {
  for (const route of ["/privacy", "/terms"]) {
    test(`${route} has no drafting notes and carries version 2026-10-15`, async ({ page }) => {
      await page.goto(route);
      const text = await page.locator("article.legal-doc").innerText();
      expect(text).not.toMatch(/TO BE (CONFIRMED|VERIFIED|COMPLETED)|OUTSTANDING|\[|\]/);
      expect(text).toContain("Version: 2026-10-15");
      expect(text).not.toContain("Netlify");
    });
  }
});

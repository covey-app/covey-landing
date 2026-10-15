import { test, expect } from "@playwright/test";
import { mockWeather, WEATHER } from "./fixtures/weather";

/**
 * /activities — the directory. The suite's build pins COVEY_TODAY=2026-10-14
 * (playwright.config.ts) over the real listings for Oct 17–18, ?today= pins
 * the browser's "today", and /api/weather is mocked (fixtures/weather.ts),
 * so none of this depends on the day it runs or the real forecast.
 */

test.beforeEach(async ({ page }) => {
  await mockWeather(page);
});

test("the band, the parade, and the guide by day", async ({ page }) => {
  await page.goto("/activities?today=2026-10-14");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("what's on.");
  await expect(page.locator(".parade img")).not.toHaveCount(0);
  await expect(page.locator(".list-picks")).toHaveAttribute("href", "/newsletter/2026-10-12");
  await expect(page.locator(".list-picks")).toContainText("Oct 17–18");
  const days = await page.locator("[data-day]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-day")));
  expect(days).toEqual(["2026-10-17", "2026-10-18"]);
  await expect(page.locator("#activities-guide").getByText("38th SF Old Car Picnic")).toBeVisible();
});

test("days before today hide themselves", async ({ page }) => {
  await page.goto("/activities?today=2026-10-18");
  const visibleDays = await page.locator("[data-day]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-day")));
  expect(visibleDays).toEqual(["2026-10-18"]);
  await expect(page.locator("[data-day='2026-10-17']")).toBeHidden();
});

test("category, quick toggle, and neighborhood filters combine, and clear", async ({ page }) => {
  await page.goto("/activities?today=2026-10-14");
  const guide = page.locator("#activities-guide");
  const all = await guide.locator("[data-row]:visible").count();
  await guide.locator("[data-filter-cat='outdoors']").click();
  await expect(guide.locator("[data-filter-cat='outdoors']")).toHaveAttribute("aria-pressed", "true");
  const outdoors = await guide.locator("[data-row]:visible").evaluateAll((els) => els.map((e) => e.getAttribute("data-category")));
  expect(outdoors.length).toBeGreaterThan(0);
  expect(outdoors.every((c) => c === "outdoors")).toBeTruthy();

  await guide.locator("[data-filter-hood]").selectOption("Chinatown");
  await expect(guide.locator("[data-nothing]")).toBeVisible();
  await guide.locator("[data-filter-reset]").click();
  await expect(guide.locator("[data-row]:visible")).toHaveCount(all);
});

test("listings are honest about coverage and link to organizers", async ({ page }) => {
  await page.goto("/activities?today=2026-10-14");
  await expect(page.getByText(/This isn't every event in San Francisco/)).toBeVisible();
  const links = await page.locator(".row-title a").evaluateAll((els) => els.map((a) => [a.getAttribute("target"), (a as HTMLAnchorElement).href]));
  expect(links.length).toBeGreaterThan(0);
  expect(links.every(([t, h]) => t === "_blank" && h!.startsWith("https://") && !h!.includes("google.com/url"))).toBeTruthy();
});

test("weather plans: a card per upcoming day, an idea to match, and a listing that suits it", async ({ page }) => {
  await page.goto("/activities?today=2026-10-14");
  const wx = page.locator("#act-weather");
  const cards = wx.locator("[data-wx-live] .wx-day");
  await expect(cards).toHaveCount(4);
  await expect(wx.locator("[data-wx-fallback]")).toBeHidden();
  expect(await cards.evaluateAll((els) => els.map((e) => [e.getAttribute("data-date"), e.getAttribute("data-mood")]))).toEqual([
    ["2026-10-14", "sunny"],
    ["2026-10-15", "warm"],
    ["2026-10-16", "hot"],
    ["2026-10-17", "grey"],
  ]);
  await expect(cards.first().locator(".wx-dname")).toHaveText("today");
  await expect(cards.first()).toContainText("71°");
  await expect(cards.first()).toContainText(/sunset \d{1,2}:\d{2}pm/);
  // Ideas never repeat across the run.
  const ideas = await cards.locator(".wx-idea-t").allTextContents();
  expect(new Set(ideas).size).toBe(ideas.length);
  // Saturday is foggy but dry: an outdoor listing that day is suggested.
  await expect(cards.nth(3).locator(".wx-pair a")).toHaveAttribute("target", "_blank");
  await expect(wx.locator("[data-wx-credit]")).toContainText("National Weather Service");
});

test("weather plans: rain suggests staying in — soup night included", async ({ page }) => {
  await page.goto("/activities?today=2026-10-18");
  const sunday = page.locator("#act-weather [data-wx-live] .wx-day").first();
  await expect(sunday).toHaveAttribute("data-mood", "wet");
  await expect(sunday).toContainText("70% chance of rain");
  await expect(sunday.locator(".wx-pair")).toContainText("Or stay in with the guide");
  const rainy = { ...WEATHER, days: WEATHER.days.map((d) => ({ ...d, rain: 80, sky: "Rain", high: 56 })) };
  await page.unroute("**/api/weather");
  await mockWeather(page, rainy);
  await page.reload();
  const titles = await page.locator("#act-weather .wx-idea-t").allTextContents();
  expect(titles).toContain("host a soup night");
});

test("weather plans: no forecast keeps the weather-proof ideas", async ({ page }) => {
  await page.unroute("**/api/weather");
  await mockWeather(page, { ok: false, error: "unavailable" }, 502);
  await page.goto("/activities?today=2026-10-14");
  const wx = page.locator("#act-weather");
  await expect(wx.locator("[data-wx-fallback] .wx-day")).toHaveCount(3);
  await expect(wx.locator("[data-wx-fallback]")).toContainText("host a soup night");
  await expect(wx.locator("[data-wx-fallback]")).toContainText("go to the park and read");
  await expect(wx.locator("[data-wx-live]")).toBeHidden();
});

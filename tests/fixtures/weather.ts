import type { Page } from "@playwright/test";

/**
 * A fixed /api/weather response for the week the suite pins (COVEY_TODAY /
 * ?today=2026-10-14), one day of each kind, so weather plans render the same
 * whatever the real forecast is — and the suite never calls the NWS.
 */
export const WEATHER = {
  ok: true,
  source: "National Weather Service",
  updated: "2026-10-14T19:00:00+00:00",
  days: [
    { date: "2026-10-14", high: 71, low: 53, rain: 0, wind: 9, sky: "Sunny" },
    { date: "2026-10-15", high: 82, low: 58, rain: 0, wind: 8, sky: "Sunny" },
    { date: "2026-10-16", high: 88, low: 60, rain: 0, wind: 6, sky: "Sunny" },
    { date: "2026-10-17", high: 63, low: 54, rain: 10, wind: 12, sky: "Patchy Fog then Mostly Cloudy" },
    { date: "2026-10-18", high: 58, low: 51, rain: 70, wind: 16, sky: "Rain Likely" },
    { date: "2026-10-19", high: 66, low: 52, rain: 0, wind: 25, sky: "Sunny and Breezy" },
    { date: "2026-10-20", high: 57, low: 48, rain: 0, wind: 10, sky: "Mostly Cloudy" },
  ],
};

export async function mockWeather(page: Page, body: unknown = WEATHER, status = 200) {
  await page.route("**/api/weather", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
}

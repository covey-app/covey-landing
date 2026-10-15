// Unit tests for the weather plans: folding NWS periods into days, the
// /api/weather handler (fake fetch, no network), choosing ideas, and sunset.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { foldPeriods, handleWeatherRequest, NWS_FORECAST_URL } from "../../src/lib/weather/forecast.ts";
import { ideasFor, moodOf, sunsetSF, IDEAS } from "../../src/lib/weather/ideas.ts";

const PERIODS = [
  { startTime: "2026-10-14T18:00:00-07:00", isDaytime: false, temperature: 53, probabilityOfPrecipitation: { value: 0 }, windSpeed: "1 to 8 mph", shortForecast: "Mostly Clear" },
  { startTime: "2026-10-15T06:00:00-07:00", isDaytime: true, temperature: 82, probabilityOfPrecipitation: { value: 10 }, windSpeed: "2 to 8 mph", shortForecast: "Sunny" },
  { startTime: "2026-10-15T18:00:00-07:00", isDaytime: false, temperature: 58, probabilityOfPrecipitation: { value: 40 }, windSpeed: "5 to 20 mph", shortForecast: "Chance Showers" },
  { startTime: "2026-10-16T06:00:00-07:00", isDaytime: true, temperature: 61, probabilityOfPrecipitation: null, windSpeed: "10 mph", shortForecast: "Patchy Fog" },
];

test("foldPeriods: one entry per SF date, day sky wins, max rain and wind across day and night", () => {
  assert.deepEqual(foldPeriods(PERIODS), [
    { date: "2026-10-14", high: null, low: 53, rain: 0, wind: 8, sky: "Mostly Clear" },
    { date: "2026-10-15", high: 82, low: 58, rain: 40, wind: 20, sky: "Sunny" },
    { date: "2026-10-16", high: 61, low: null, rain: 0, wind: 10, sky: "Patchy Fog" },
  ]);
});

test("handler: asks the NWS gridpoint with an identifying User-Agent, caches at the CDN", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ properties: { updateTime: "2026-10-14T19:00:00+00:00", periods: PERIODS } }), { status: 200 });
  }) as typeof globalThis.fetch;
  const res = await handleWeatherRequest({ fetch, userAgent: "coveyapp.co (hello@coveyapp.co)" });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("Cache-Control")!, /s-maxage=1800/);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.days.length, 3);
  assert.equal(calls[0].url, NWS_FORECAST_URL);
  assert.equal((calls[0].init!.headers as Record<string, string>)["User-Agent"], "coveyapp.co (hello@coveyapp.co)");
});

for (const [name, fetch] of [
  ["upstream 500", (async () => new Response("no", { status: 500 })) as unknown as typeof globalThis.fetch],
  ["network error", (async () => { throw new Error("offline"); }) as unknown as typeof globalThis.fetch],
  ["empty periods", (async () => new Response(JSON.stringify({ properties: { periods: [] } }), { status: 200 })) as unknown as typeof globalThis.fetch],
] as const) {
  test(`handler: ${name} → 502 unavailable with a short cache, never a made-up forecast`, async () => {
    const res = await handleWeatherRequest({ fetch, userAgent: "t" });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { ok: false, error: "unavailable" });
    assert.match(res.headers.get("Cache-Control")!, /max-age=60/);
  });
}

test("moodOf: rain beats temperature, then heat and cold, wind, warmth, sun vs fog", () => {
  const d = (o: object) => ({ high: 65, low: 52, rain: 0, wind: 8, sky: "Sunny", ...o });
  assert.equal(moodOf(d({ rain: 60, high: 90 })), "wet");
  assert.equal(moodOf(d({ sky: "Slight Chance Rain Showers", rain: 20 })), "wet");
  assert.equal(moodOf(d({ high: 88 })), "hot");
  assert.equal(moodOf(d({ high: 57, sky: "Mostly Cloudy" })), "cold");
  assert.equal(moodOf(d({ wind: 25 })), "windy");
  assert.equal(moodOf(d({ high: 76 })), "warm");
  assert.equal(moodOf(d({})), "sunny");
  assert.equal(moodOf(d({ sky: "Patchy Fog then Mostly Cloudy" })), "grey");
  assert.equal(moodOf(d({ high: null, low: 50, sky: "Mostly Clear" })), "cold");
});

test("ideasFor: cold or wet days include the soup night; a run never repeats an idea", () => {
  assert.ok(IDEAS.wet.some((i) => i.title === "host a soup night"));
  assert.ok(IDEAS.cold.some((i) => i.title === "host a soup night"));
  assert.ok(IDEAS.sunny.some((i) => i.title === "go to the park and read"));
  const run = ideasFor(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"].map((date) => ({ date, mood: "wet" as const })));
  assert.equal(new Set(run.map((i) => i.title)).size, 4);
});

test("sunsetSF: within a few minutes of the almanac, in Pacific time", () => {
  const mins = (s: string) => {
    const [, h, m] = s.match(/^(\d+):(\d+)pm$/)!;
    return (Number(h) % 12 + 12) * 60 + Number(m);
  };
  for (const [date, almanac] of [["2026-10-17", "6:27pm"], ["2026-06-21", "8:35pm"], ["2026-12-21", "4:54pm"]] as const) {
    assert.ok(Math.abs(mins(sunsetSF(date)) - mins(almanac)) <= 4, `${date}: ${sunsetSF(date)} vs ${almanac}`);
  }
});

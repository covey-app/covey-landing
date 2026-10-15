/*
 * GET /api/weather — San Francisco's 7-day forecast from the National Weather
 * Service, folded into one entry per day for the weather plans
 * (WeatherPlans.astro). Proxied rather than called from the browser so that
 * visitors' IPs never reach a third party, the NWS gets the identifying
 * User-Agent it asks for, and Vercel's CDN serves one cached copy to everyone.
 *
 * NWS data is public domain and free for commercial use; there's no key.
 */

/** NWS gridpoint for downtown San Francisco (api.weather.gov/points/37.7749,-122.4194). */
export const NWS_FORECAST_URL = "https://api.weather.gov/gridpoints/MTR/85,105/forecast";

export interface ForecastDay {
  /** YYYY-MM-DD in San Francisco. */
  date: string;
  /** Daytime high °F (null when only tonight is left in the forecast). */
  high: number | null;
  low: number | null;
  /** Highest chance of precipitation across the day and night, 0–100. */
  rain: number;
  /** Strongest forecast wind, mph. */
  wind: number;
  /** The NWS short forecast, e.g. "Patchy Fog then Mostly Sunny". */
  sky: string;
}

export interface ForecastResponse {
  ok: true;
  source: "National Weather Service";
  updated: string | null;
  days: ForecastDay[];
}

interface NwsPeriod {
  startTime: string;
  isDaytime: boolean;
  temperature: number;
  probabilityOfPrecipitation?: { value: number | null } | null;
  windSpeed?: string;
  shortForecast?: string;
}

const maxMph = (s = "") => Math.max(0, ...(s.match(/\d+/g) ?? []).map(Number));

/** NWS 12-hour periods → one entry per calendar day. */
export function foldPeriods(periods: NwsPeriod[]): ForecastDay[] {
  const byDate = new Map<string, ForecastDay>();
  for (const p of periods) {
    // startTime carries the local offset ("2026-10-17T06:00:00-07:00"), so its
    // first ten characters are the San Francisco date.
    const date = p.startTime.slice(0, 10);
    const day = byDate.get(date) ?? { date, high: null, low: null, rain: 0, wind: 0, sky: "" };
    if (p.isDaytime) {
      day.high = p.temperature;
      day.sky = p.shortForecast ?? day.sky;
    } else {
      day.low = p.temperature;
      if (!day.sky) day.sky = p.shortForecast ?? "";
    }
    day.rain = Math.max(day.rain, p.probabilityOfPrecipitation?.value ?? 0);
    day.wind = Math.max(day.wind, maxMph(p.windSpeed));
    byDate.set(date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeatherDeps {
  fetch: typeof fetch;
  userAgent: string;
}

const json = (body: unknown, status: number, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
  });

export async function handleWeatherRequest(deps: WeatherDeps): Promise<Response> {
  try {
    const res = await deps.fetch(NWS_FORECAST_URL, {
      headers: { "User-Agent": deps.userAgent, Accept: "application/geo+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`nws ${res.status}`);
    const data = (await res.json()) as { properties?: { periods?: NwsPeriod[]; updateTime?: string } };
    const periods = data.properties?.periods;
    if (!Array.isArray(periods) || periods.length === 0) throw new Error("nws empty");
    const body: ForecastResponse = {
      ok: true,
      source: "National Weather Service",
      updated: data.properties?.updateTime ?? null,
      days: foldPeriods(periods),
    };
    // NWS refreshes roughly hourly; the CDN keeps one copy for everyone.
    return json(body, 200, "public, max-age=600, s-maxage=1800, stale-while-revalidate=3600");
  } catch {
    // The page keeps its weather-proof ideas; a short cache stops a stampede.
    return json({ ok: false, error: "unavailable" }, 502, "public, max-age=60, s-maxage=60");
  }
}

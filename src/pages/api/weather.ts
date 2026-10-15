/*
 * GET /api/weather — SF forecast for the weather plans (a Vercel Function via
 * @astrojs/vercel). Logic lives in src/lib/weather/forecast.ts.
 */
import type { APIRoute } from "astro";
import { handleWeatherRequest } from "../../lib/weather/forecast";
import { SITE } from "../../config";

export const prerender = false;

export const GET: APIRoute = () => handleWeatherRequest({ fetch, userAgent: `${SITE.domain} (${SITE.emails.hello})` });

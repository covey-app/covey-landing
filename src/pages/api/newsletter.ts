/*
 * POST /api/newsletter — Covey Weekly double opt-in signup (a Vercel Function
 * via @astrojs/vercel). Logic lives in src/lib/newsletter/handler.ts.
 */
import type { APIRoute } from "astro";
import {
  NEWSLETTER_EMAIL_FROM,
  RESEND_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  WAITLIST_EMAIL_FROM,
} from "astro:env/server";
import { handleNewsletterRequest } from "../../lib/newsletter/handler";

export const prerender = false;

export const POST: APIRoute = ({ request, clientAddress }) =>
  handleNewsletterRequest(
    request,
    clientAddress,
    {
      supabaseUrl: SUPABASE_URL,
      supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY,
      resendKey: RESEND_API_KEY,
      emailFrom: NEWSLETTER_EMAIL_FROM || WAITLIST_EMAIL_FROM,
    },
    {
      fetch,
      now: Date.now,
      // One JSON line per event, no PII; readable in Vercel's function logs.
      log: (event, detail) => console.info(JSON.stringify({ event, ...detail })),
    },
  );

/*
 * The site's one on-demand route (a Vercel Function via @astrojs/vercel);
 * every page stays prerendered. Logic lives in src/lib/waitlist/handler.ts.
 */
import type { APIRoute } from "astro";
import { RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, WAITLIST_EMAIL_FROM } from "astro:env/server";
import { handleWaitlistRequest } from "../../lib/waitlist/handler";

export const prerender = false;

export const POST: APIRoute = ({ request, clientAddress }) =>
  handleWaitlistRequest(
    request,
    clientAddress,
    {
      supabaseUrl: SUPABASE_URL,
      supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY,
      resendKey: RESEND_API_KEY,
      emailFrom: WAITLIST_EMAIL_FROM,
    },
    {
      fetch,
      now: Date.now,
      // One JSON line per event, no PII; readable in Vercel's function logs.
      log: (event, detail) => console.info(JSON.stringify({ event, ...detail })),
    },
  );

/*
 * Server-only wiring for the newsletter pages (/newsletter/confirm,
 * /newsletter/unsubscribe): config from astro:env and PII-free logging,
 * matching src/pages/api/newsletter.ts.
 */
import { NEWSLETTER_EMAIL_FROM, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, WAITLIST_EMAIL_FROM } from "astro:env/server";
import type { NewsletterEnv } from "./handler";

export function newsletterEnv(): NewsletterEnv {
  return {
    supabaseUrl: SUPABASE_URL,
    supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY,
    resendKey: RESEND_API_KEY,
    emailFrom: NEWSLETTER_EMAIL_FROM || WAITLIST_EMAIL_FROM,
  };
}

export const serverDeps = {
  fetch,
  log: (event: string, detail?: Record<string, string | number | boolean>) => console.info(JSON.stringify({ event, ...detail })),
};

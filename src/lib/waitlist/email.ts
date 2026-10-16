/*
 * Optional confirmation email through Resend — the provider covey/supabase
 * already uses (report-notify). Off unless RESEND_API_KEY and
 * WAITLIST_EMAIL_FROM are both set; the on-page confirmation is complete on its
 * own.
 *
 * Sent once per address: only a "created" signup triggers it, so re-submitting
 * someone else's email can never be used to mail them twice.
 */
import { SITE } from "../../config.ts";

export interface EmailConfig {
  resendKey: string;
  from: string;
}

const TIMEOUT_MS = 3500;

export function confirmationEmail(): { subject: string; text: string; html: string } {
  const subject = "You're on the Covey waitlist";
  const text = [
    "You're on the list.",
    "",
    `Thanks for joining the Covey waitlist. We'll email you when Covey is ready for you in ${SITE.city.split(",")[0]} — that's what this address is for, and nothing else.`,
    "",
    "Covey is for meeting people through small, real-world plans: a few stops, a few seats, and an easy way to do it again.",
    "",
    `Didn't sign up? Ignore this email, or reply and we'll delete your address. Privacy policy: ${SITE.url}/privacy`,
    "",
    `— Covey · ${SITE.domain}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">
<p style="font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b70;margin:0 0 12px">Covey · Waitlist</p>
<h1 style="font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 16px">you're on the list.</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 14px">Thanks for joining the Covey waitlist. We'll email you when Covey is ready for you in ${SITE.city.split(",")[0]} — that's what this address is for, and nothing else.</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 20px;color:#4a4a4f">Covey is for meeting people through small, real-world plans: a few stops, a few seats, and an easy way to do it again.</p>
<p style="font-size:13px;line-height:1.5;color:#6b6b70;margin:0">Didn't sign up? Ignore this email, or reply and we'll delete your address. <a href="${SITE.url}/privacy" style="color:#6b4a2e">Privacy policy</a></p>
</div></body></html>`;
  return { subject, text, html };
}

/** Best effort: resolves false on any failure and never throws. */
export async function sendConfirmation(
  cfg: EmailConfig,
  to: string,
  idempotencyKey: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  const { subject, text, html } = confirmationEmail();
  try {
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.resendKey}`,
        "content-type": "application/json",
        // Resend de-duplicates a retried send with the same key for 24h.
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [to],
        subject,
        text,
        html,
        reply_to: SITE.emails.support,
        headers: { "List-Unsubscribe": `<mailto:${SITE.emails.support}?subject=unsubscribe>` },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/*
 * Covey Weekly email helpers, sent through Resend like the waitlist email.
 *
 *   sendNewsletterConfirmation  the double opt-in link. Best effort: never
 *                               throws; the pending row is stored either way.
 *   unsubscribeUrl              the per-subscriber link every edition carries.
 *   listUnsubscribeHeaders      RFC 2369 + RFC 8058 one-click headers for the
 *                               edition sender.
 */
import { SITE } from "../../config.ts";
import type { EmailConfig } from "../waitlist/email.ts";

export type { EmailConfig };

const TIMEOUT_MS = 3500;

export function confirmUrl(token: string): string {
  return `${SITE.url}/newsletter/confirm/?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(token: string): string {
  return `${SITE.url}/newsletter/unsubscribe/?token=${encodeURIComponent(token)}`;
}

/**
 * Headers for every edition. Gmail and Yahoo require one-click unsubscribe for
 * bulk senders: the mail client POSTs `List-Unsubscribe=One-Click` to the URL,
 * so the unsubscribe page must accept that POST and unsubscribe without any
 * further interaction.
 */
export function listUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(token)}>, <mailto:${SITE.emails.hello}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function newsletterConfirmationEmail(token: string): { subject: string; text: string; html: string } {
  const url = confirmUrl(token);
  const city = SITE.city.split(",")[0];
  const subject = "Confirm your subscription to Covey Weekly";
  const text = [
    "Confirm your subscription to Covey Weekly:",
    "",
    url,
    "",
    `Covey Weekly is one short email a week of things to do in ${city}. We won't send it until you confirm, and you can unsubscribe from any edition.`,
    "",
    `This link works for 7 days. Didn't ask for this? Ignore this email and you won't hear from us. Privacy policy: ${SITE.url}/privacy`,
    "",
    `— Covey · ${SITE.domain}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1c1e">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:28px">
<p style="font-family:ui-monospace,Menlo,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6b6b70;margin:0 0 12px">Covey · Weekly</p>
<h1 style="font-family:ui-monospace,Menlo,monospace;font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 16px">one tap to confirm.</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 20px">Covey Weekly is one short email a week of things to do in ${city}. We won't send it until you confirm, and you can unsubscribe from any edition.</p>
<p style="margin:0 0 20px"><a href="${url}" style="display:inline-block;background:#1c1c1e;color:#fff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:999px">Confirm subscription</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b6b70;margin:0 0 8px">Or paste this link into your browser: <span style="word-break:break-all">${url}</span></p>
<p style="font-size:13px;line-height:1.5;color:#6b6b70;margin:0">This link works for 7 days. Didn't ask for this? Ignore this email and you won't hear from us. <a href="${SITE.url}/privacy" style="color:#6b4a2e">Privacy policy</a></p>
</div></body></html>`;
  return { subject, text, html };
}

/** Best effort: resolves false on any failure and never throws. */
export async function sendNewsletterConfirmation(
  cfg: EmailConfig,
  to: string,
  token: string,
  idempotencyKey: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  try {
    const { subject, text, html } = newsletterConfirmationEmail(token);
    const res = await fetchFn("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.resendKey}`,
        "content-type": "application/json",
        // Resend de-duplicates a retried send with the same key for 24h.
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, text, html, reply_to: SITE.emails.hello }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

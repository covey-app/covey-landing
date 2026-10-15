// Send one Covey Weekly edition to every confirmed subscriber.
//
//   npm run build
//   node --env-file=.env scripts/newsletter/send-edition.mjs <YYYY-MM-DD>                 # dry run (default)
//   node --env-file=.env scripts/newsletter/send-edition.mjs <YYYY-MM-DD> --to you@x.co   # one test email
//   node --env-file=.env scripts/newsletter/send-edition.mjs <YYYY-MM-DD> --send --yes    # everyone
//
// Reads the email the build rendered from the same content as the web page
// (.vercel/output/static/newsletter/<slug>/email/index.html), pages through
// newsletter_recipients() (confirmed subscribers only), and sends through
// Resend's batch API, 100 per call, each with its own unsubscribe link and
// RFC 8058 one-click List-Unsubscribe headers.
//
// Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and
// NEWSLETTER_EMAIL_FROM (or WAITLIST_EMAIL_FROM). Never logs addresses.
import { readFile, writeFile } from "node:fs/promises";
import { unsubscribeUrl, listUnsubscribeHeaders } from "../../src/lib/newsletter/email.ts";
import { headers as supabaseHeaders } from "../../src/lib/waitlist/supabase.ts";

const args = process.argv.slice(2);
const slug = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const to = args.includes("--to") ? args[args.indexOf("--to") + 1] : null;
const sendAll = args.includes("--send");
if (!slug) {
  console.error("usage: send-edition.mjs <YYYY-MM-DD> [--to you@example.com | --send --yes]");
  process.exit(1);
}
if (sendAll && !args.includes("--yes")) {
  console.error("Refusing to send to every subscriber without --yes.");
  process.exit(1);
}

const html = await readFile(`.vercel/output/static/newsletter/${slug}/email/index.html`, "utf8").catch(() => null);
if (!html) {
  console.error(`No built email for ${slug}. Run \`npm run build\` first (and check the edition is published).`);
  process.exit(1);
}
if (!html.includes("%%UNSUBSCRIBE_URL%%")) {
  console.error("The built email has no %%UNSUBSCRIBE_URL%% placeholder; refusing to send without an unsubscribe link.");
  process.exit(1);
}
const subject = (html.match(/<title>([^<]+)<\/title>/)?.[1] ?? `Covey Weekly · ${slug}`).replace(/&amp;/g, "&").replace(/&#39;/g, "'");
const env = process.env;
const from = env.NEWSLETTER_EMAIL_FROM || env.WAITLIST_EMAIL_FROM;

async function recipients() {
  const cfg = { url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY };
  if (!cfg.url || !cfg.serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const out = [];
  // PostgREST caps responses (db-max-rows, 1000 by default); page explicitly.
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/rpc/newsletter_recipients?limit=500&offset=${offset}`, {
      method: "POST",
      headers: supabaseHeaders(cfg),
      body: "{}",
    });
    if (!res.ok) throw new Error(`newsletter_recipients failed: HTTP ${res.status}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 500) return out;
  }
}

function personalize(token) {
  return html.replaceAll("%%UNSUBSCRIBE_URL%%", unsubscribeUrl(token));
}

async function sendBatch(batch) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json", "idempotency-key": `covey-weekly/${slug}/${batch.key}` },
    body: JSON.stringify(
      batch.items.map((r) => ({
        from,
        to: [r.email],
        subject,
        html: personalize(r.unsubscribe_token),
        reply_to: "hello@coveyapp.co",
        headers: listUnsubscribeHeaders(r.unsubscribe_token),
      })),
    ),
  });
  if (!res.ok) throw new Error(`Resend batch ${batch.key} failed: HTTP ${res.status}`);
}

if (!sendAll && !to) {
  const list = env.SUPABASE_URL ? await recipients() : [];
  const preview = `.vercel/newsletter-preview-${slug}.html`;
  await writeFile(preview, personalize("00000000-0000-4000-8000-000000000000"));
  console.log(`Dry run · "${subject}" · ${env.SUPABASE_URL ? `${list.length} confirmed subscribers` : "no database configured"}`);
  console.log(`Preview written to ${preview}. Add --to you@example.com for a test, or --send --yes to send.`);
  process.exit(0);
}
if (!env.RESEND_API_KEY || !from) {
  console.error("RESEND_API_KEY and NEWSLETTER_EMAIL_FROM (or WAITLIST_EMAIL_FROM) are required to send.");
  process.exit(1);
}
if (to) {
  await sendBatch({ key: `test-${Date.now()}`, items: [{ email: to, unsubscribe_token: "00000000-0000-4000-8000-000000000000" }] });
  console.log(`Test sent: "${subject}" (its unsubscribe link is a placeholder).`);
  process.exit(0);
}
const list = await recipients();
for (let i = 0; i < list.length; i += 100) {
  await sendBatch({ key: `batch-${i / 100}`, items: list.slice(i, i + 100) });
  console.log(`Sent ${Math.min(i + 100, list.length)} / ${list.length}`);
}
console.log(`Done: "${subject}" to ${list.length} subscribers.`);

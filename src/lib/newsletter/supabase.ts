/*
 * The newsletter RPCs (db/migrations/20261014130000_newsletter_subscribers.sql)
 * over PostgREST with plain fetch. Server only: the key is the service-role
 * (or `sb_secret_…`) key. Auth headers are the waitlist's, shared.
 */
import { headers, type SupabaseConfig } from "../waitlist/supabase.ts";
import type { Attribution } from "../waitlist/validate.ts";

export type { SupabaseConfig };

export type SubscribeResult =
  /** `resend`: a new confirmation token was stored and should be emailed. */
  | { result: "created" | "pending" | "resubscribe"; id: string; resend: boolean }
  | { result: "subscribed" }
  | { result: "rate_limited" }
  | { result: "invalid_email" };

export type ConfirmResult = "confirmed" | "already" | "invalid";

export interface Recipient {
  email: string;
  unsubscribe_token: string;
}

/** Thrown for anything that isn't a well-formed answer from the database. */
export class NewsletterStoreError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "NewsletterStoreError";
    this.status = status;
  }
}

const TIMEOUT_MS = 8000;
const INVALID_EMAIL = Symbol("invalid_email");

async function rpc(cfg: SupabaseConfig, fn: string, body: unknown, fetchFn: typeof fetch): Promise<unknown> {
  const url = `${cfg.url.replace(/\/+$/, "")}/rest/v1/rpc/${fn}`;
  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new NewsletterStoreError(`network: ${(err as Error)?.name ?? "error"}`);
  }
  const text = await res.text();
  if (!res.ok) {
    // PostgREST maps RAISE … ERRCODE '22023' to 400 with the message in JSON.
    // Only the message token is inspected; the body is never logged.
    let message = "";
    try {
      message = String((JSON.parse(text) as { message?: unknown }).message ?? "");
    } catch {
      /* not JSON */
    }
    if (res.status === 400 && message === "invalid_email") return INVALID_EMAIL;
    throw new NewsletterStoreError(`rpc ${fn} failed`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new NewsletterStoreError(`rpc ${fn} returned non-JSON`, res.status);
  }
}

export async function subscribeNewsletter(
  cfg: SupabaseConfig,
  input: {
    email: string;
    clientKey: string;
    consentText: string;
    source: string;
    attribution: Attribution;
    confirmTokenHash: string;
  },
  fetchFn: typeof fetch,
): Promise<SubscribeResult> {
  const a = input.attribution;
  const data = await rpc(
    cfg,
    "newsletter_subscribe",
    {
      p_email: input.email,
      p_client_key: input.clientKey,
      p_consent_text: input.consentText,
      p_source: input.source,
      p_utm_source: a.utm_source ?? null,
      p_utm_medium: a.utm_medium ?? null,
      p_utm_campaign: a.utm_campaign ?? null,
      p_utm_content: a.utm_content ?? null,
      p_utm_term: a.utm_term ?? null,
      p_referrer: a.referrer ?? null,
      p_landing_path: a.landing_path ?? null,
      p_confirm_token_hash: input.confirmTokenHash,
    },
    fetchFn,
  );
  if (data === INVALID_EMAIL) return { result: "invalid_email" };
  const r = data as { result?: unknown; id?: unknown; resend?: unknown } | null;
  if ((r?.result === "created" || r?.result === "pending" || r?.result === "resubscribe") && typeof r.id === "string") {
    return { result: r.result, id: r.id, resend: r.resend === true };
  }
  if (r?.result === "subscribed") return { result: "subscribed" };
  if (r?.result === "rate_limited") return { result: "rate_limited" };
  throw new NewsletterStoreError("rpc newsletter_subscribe returned an unexpected shape");
}

export async function confirmNewsletterToken(
  cfg: SupabaseConfig,
  tokenHash: string,
  fetchFn: typeof fetch,
): Promise<ConfirmResult> {
  const data = (await rpc(cfg, "newsletter_confirm", { p_token_hash: tokenHash }, fetchFn)) as { result?: unknown } | null;
  const result = data?.result;
  if (result === "confirmed" || result === "already" || result === "invalid") return result;
  throw new NewsletterStoreError("rpc newsletter_confirm returned an unexpected shape");
}

export async function unsubscribeNewsletterToken(
  cfg: SupabaseConfig,
  token: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  const data = await rpc(cfg, "newsletter_unsubscribe", { p_token: token }, fetchFn);
  if (typeof data !== "boolean") throw new NewsletterStoreError("rpc newsletter_unsubscribe returned an unexpected shape");
  return data;
}

/**
 * Confirmed subscribers, for the edition send script. Note PostgREST's
 * db-max-rows (Supabase default 1000) caps a single response; page with
 * Range headers before the list outgrows it.
 */
export async function newsletterRecipients(cfg: SupabaseConfig, fetchFn: typeof fetch): Promise<Recipient[]> {
  const data = await rpc(cfg, "newsletter_recipients", {}, fetchFn);
  if (
    !Array.isArray(data) ||
    !data.every(
      (r) => r && typeof r === "object" && typeof r.email === "string" && typeof r.unsubscribe_token === "string",
    )
  ) {
    throw new NewsletterStoreError("rpc newsletter_recipients returned an unexpected shape");
  }
  return data.map((r) => ({ email: r.email as string, unsubscribe_token: r.unsubscribe_token as string }));
}

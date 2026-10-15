/*
 * The two waitlist RPCs, called over PostgREST with plain fetch. supabase-js
 * would add a dependency to a function that makes one request.
 *
 * Runs on the server only: the key is the project's service-role (or
 * `sb_secret_…`) key and must never reach the browser.
 */
import type { Attribution, City } from "./validate.ts";

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

export type JoinResult =
  | { result: "created"; id: string }
  | { result: "existing" }
  | { result: "rate_limited" }
  | { result: "invalid_email" };

/** Thrown for anything that isn't a well-formed answer from the database. */
export class WaitlistStoreError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "WaitlistStoreError";
    this.status = status;
  }
}

const TIMEOUT_MS = 8000;

/** PostgREST auth headers for a service-role key. Shared with the newsletter. */
export function headers(cfg: SupabaseConfig): Record<string, string> {
  const h: Record<string, string> = {
    apikey: cfg.serviceKey,
    "content-type": "application/json",
    accept: "application/json",
  };
  // Legacy service_role keys are JWTs and go in Authorization as well. The
  // newer sb_secret_ keys are not JWTs and are accepted in `apikey` alone.
  if (cfg.serviceKey.startsWith("eyJ")) h.authorization = `Bearer ${cfg.serviceKey}`;
  return h;
}

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
    throw new WaitlistStoreError(`network: ${(err as Error)?.name ?? "error"}`);
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
    if (res.status === 400 && message === "invalid_email") return { __invalid_email: true };
    throw new WaitlistStoreError(`rpc ${fn} failed`, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new WaitlistStoreError(`rpc ${fn} returned non-JSON`, res.status);
  }
}

export async function joinWaitlist(
  cfg: SupabaseConfig,
  input: { email: string; clientKey: string; source: string; attribution: Attribution; followupTokenHash: string },
  fetchFn: typeof fetch,
): Promise<JoinResult> {
  const a = input.attribution;
  const data = await rpc(
    cfg,
    "waitlist_join",
    {
      p_email: input.email,
      p_client_key: input.clientKey,
      p_source: input.source,
      p_utm_source: a.utm_source ?? null,
      p_utm_medium: a.utm_medium ?? null,
      p_utm_campaign: a.utm_campaign ?? null,
      p_utm_content: a.utm_content ?? null,
      p_utm_term: a.utm_term ?? null,
      p_referrer: a.referrer ?? null,
      p_landing_path: a.landing_path ?? null,
      p_followup_token_hash: input.followupTokenHash,
    },
    fetchFn,
  );
  if (data && typeof data === "object" && "__invalid_email" in data) return { result: "invalid_email" };
  const r = data as { result?: unknown; id?: unknown } | null;
  if (r?.result === "created" && typeof r.id === "string") return { result: "created", id: r.id };
  if (r?.result === "existing") return { result: "existing" };
  if (r?.result === "rate_limited") return { result: "rate_limited" };
  throw new WaitlistStoreError("rpc waitlist_join returned an unexpected shape");
}

export async function setWaitlistCity(
  cfg: SupabaseConfig,
  input: { followupTokenHash: string; city: City },
  fetchFn: typeof fetch,
): Promise<boolean> {
  const data = await rpc(
    cfg,
    "waitlist_set_city",
    { p_followup_token_hash: input.followupTokenHash, p_city: input.city },
    fetchFn,
  );
  if (typeof data !== "boolean") throw new WaitlistStoreError("rpc waitlist_set_city returned an unexpected shape");
  return data;
}

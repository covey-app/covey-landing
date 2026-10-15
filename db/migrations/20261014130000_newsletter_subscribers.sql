-- Covey Weekly: the double opt-in newsletter for coveyapp.co.
--
-- Separate from the waitlist on purpose: joining the waitlist is not consent
-- to a weekly email, and subscribing is not a waitlist signup. The two tables
-- share nothing but the rate-limit table (the endpoint HMACs the client with a
-- different prefix, so the keys never collide).
--
-- Access model (same as 20261014120000_waitlist_signups.sql):
--   * RLS on, no policies, every grant revoked from PUBLIC, anon, and
--     authenticated. The anon key cannot read, count, or write a single row.
--   * Every function is SECURITY DEFINER, runs with an empty search_path,
--     names every object schema-qualified, and is executable by service_role
--     only. Callers: /api/newsletter and the confirm/unsubscribe pages on the
--     landing site (server-side), and the edition send script.
--
-- Lifecycle:
--   pending      -> created by newsletter_subscribe; a confirmation link is
--                   emailed. Nothing is sent to a pending address but that.
--   subscribed   -> the link was opened (newsletter_confirm). Only these rows
--                   are returned by newsletter_recipients.
--   unsubscribed -> newsletter_unsubscribe, via the link in every edition.
--                   A new signup moves it back to pending (fresh consent,
--                   fresh confirmation); unsubscribed_at is kept as history.
--
-- Requires 20261014120000_waitlist_signups.sql (public.waitlist_rate_limits).
-- Apply: copy into covey/supabase/migrations (the canonical directory) and
-- push from there, or run once in the SQL editor.

BEGIN;

-- ===========================================================================
-- 1. Subscribers
-- ===========================================================================

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- Which surface collected the signup, e.g. 'landing:newsletter-page'.
  source text NOT NULL DEFAULT 'landing:newsletter-page',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  -- The exact sentence the person agreed to, as the server rendered it (never
  -- client-supplied), and when. Refreshed on every new signup for the address.
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  -- SHA-256 (hex) of the token in the confirmation link; the token itself is
  -- only ever in the email. Retired (cannot confirm again) once used, but kept
  -- until it expires so a second click reads "already confirmed", not
  -- "invalid". Cleared on unsubscribe and when expired.
  confirm_token_hash text,
  confirm_expires_at timestamptz,
  -- Opaque, stable per address; carried in every edition's unsubscribe link.
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT newsletter_subscribers_email_normalized
    CHECK (email = lower(btrim(email))),
  CONSTRAINT newsletter_subscribers_email_shape
    CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Stricter than the waitlist: every row is mailed, and `x<victim@y.co>` can
  -- be read by a mail API as a display name plus a different mailbox.
  CONSTRAINT newsletter_subscribers_email_charset
    CHECK (email !~ '[<>"(),;:\[\]\\]'),
  CONSTRAINT newsletter_subscribers_status
    CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
  CONSTRAINT newsletter_subscribers_source_len CHECK (char_length(source) BETWEEN 1 AND 64),
  CONSTRAINT newsletter_subscribers_utm_len CHECK (
    coalesce(char_length(utm_source), 0) <= 200
    AND coalesce(char_length(utm_medium), 0) <= 200
    AND coalesce(char_length(utm_campaign), 0) <= 200
    AND coalesce(char_length(utm_content), 0) <= 200
    AND coalesce(char_length(utm_term), 0) <= 200
  ),
  CONSTRAINT newsletter_subscribers_referrer_len CHECK (coalesce(char_length(referrer), 0) <= 500),
  CONSTRAINT newsletter_subscribers_landing_len CHECK (coalesce(char_length(landing_path), 0) <= 200),
  CONSTRAINT newsletter_subscribers_consent_len
    CHECK (char_length(btrim(consent_text)) BETWEEN 1 AND 500),
  CONSTRAINT newsletter_subscribers_token_shape
    CHECK (confirm_token_hash IS NULL OR confirm_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT newsletter_subscribers_token_pair
    CHECK ((confirm_token_hash IS NULL) = (confirm_expires_at IS NULL)),
  CONSTRAINT newsletter_subscribers_subscribed_confirmed
    CHECK (status <> 'subscribed' OR confirmed_at IS NOT NULL),
  CONSTRAINT newsletter_subscribers_unsubscribed_stamped
    CHECK (status <> 'unsubscribed' OR unsubscribed_at IS NOT NULL)
);

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers (email);
CREATE UNIQUE INDEX newsletter_subscribers_unsubscribe_token_key
  ON public.newsletter_subscribers (unsubscribe_token);
CREATE UNIQUE INDEX newsletter_subscribers_confirm_token_idx
  ON public.newsletter_subscribers (confirm_token_hash)
  WHERE confirm_token_hash IS NOT NULL;
CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers (status);
CREATE INDEX newsletter_subscribers_confirm_expiry_idx
  ON public.newsletter_subscribers (confirm_expires_at)
  WHERE confirm_expires_at IS NOT NULL;

COMMENT ON TABLE public.newsletter_subscribers IS
  'Covey Weekly double opt-in subscribers from coveyapp.co. Service-role/dashboard access only. Separate consent from waitlist_signups.';

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_subscribers FROM PUBLIC, anon, authenticated;

-- updated_at, plus status stamps so a hand-written UPDATE in the dashboard
-- (e.g. honouring an unsubscribe request by email) can't leave the row
-- inconsistent. Unsubscribing always kills any outstanding confirmation link,
-- so an old email can never re-subscribe someone who left.
CREATE OR REPLACE FUNCTION public.newsletter_subscribers_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  END IF;
  IF NEW.status = 'subscribed' AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := now();
  END IF;
  IF NEW.status = 'unsubscribed' THEN
    IF NEW.unsubscribed_at IS NULL THEN
      NEW.unsubscribed_at := now();
    END IF;
    NEW.confirm_token_hash := NULL;
    NEW.confirm_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_subscribers_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER newsletter_subscribers_touch
  BEFORE INSERT OR UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.newsletter_subscribers_touch();

-- ===========================================================================
-- 2. newsletter_subscribe — the only write path for signups
-- ===========================================================================
--
-- Returns {"result": ..., "id": uuid|null, "resend": bool}:
--   created      new pending row; token stored, expires in 7 days.
--   pending      existing pending row; token, expiry, and consent refreshed so
--                a lost email can be resent. Exception: if the current token
--                was issued under 2 minutes ago, nothing changes and resend is
--                false — a double-click must not invalidate the link that is
--                already in flight, and one address can't be mailed in a loop.
--   subscribed   already confirmed; nothing changes, id is null.
--   resubscribe  was unsubscribed; back to pending with a new token and fresh
--                consent. unsubscribed_at is kept as history.
--   rate_limited same window as waitlist_join: 8 per client key per 10 min.
-- `resend` is true exactly when a new token was stored and the caller should
-- email it. Attribution is first-touch: a later signup never overwrites it.

CREATE OR REPLACE FUNCTION public.newsletter_subscribe(
  p_email text,
  p_client_key text,
  p_consent_text text,
  p_source text DEFAULT 'landing:newsletter-page',
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_landing_path text DEFAULT NULL,
  p_confirm_token_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_consent text := btrim(coalesce(p_consent_text, ''));
  v_window timestamptz;
  v_count int;
  v_id uuid;
  v_row public.newsletter_subscribers%ROWTYPE;
  c_max int := 8;
  c_window_seconds int := 600;
  c_token_ttl interval := interval '7 days';
  c_resend_cooldown interval := interval '2 minutes';
BEGIN
  IF char_length(v_email) NOT BETWEEN 3 AND 254
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR v_email ~ '[<>"(),;:\[\]\\]' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF p_client_key IS NULL OR char_length(p_client_key) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'invalid_client_key' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_consent) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid_consent' USING ERRCODE = '22023';
  END IF;
  IF p_confirm_token_hash IS NULL OR p_confirm_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_confirm_token' USING ERRCODE = '22023';
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / c_window_seconds) * c_window_seconds
  );

  INSERT INTO public.waitlist_rate_limits (client_key, window_started_at)
  VALUES (p_client_key, v_window)
  ON CONFLICT (client_key, window_started_at)
  DO UPDATE SET request_count = public.waitlist_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Housekeeping: stale rate windows every call; expired confirmation tokens
  -- on ~2% of calls (both indexed).
  DELETE FROM public.waitlist_rate_limits
    WHERE window_started_at < now() - interval '1 day';
  IF random() < 0.02 THEN
    UPDATE public.newsletter_subscribers
      SET confirm_token_hash = NULL, confirm_expires_at = NULL
      WHERE confirm_expires_at < now();
  END IF;

  IF v_count > c_max THEN
    RETURN jsonb_build_object('result', 'rate_limited', 'id', NULL, 'resend', false);
  END IF;

  LOOP
    INSERT INTO public.newsletter_subscribers (
      email, source,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      referrer, landing_path,
      consent_text, consent_at,
      confirm_token_hash, confirm_expires_at
    )
    VALUES (
      v_email,
      coalesce(nullif(left(btrim(p_source), 64), ''), 'landing:newsletter-page'),
      nullif(left(btrim(p_utm_source), 200), ''),
      nullif(left(btrim(p_utm_medium), 200), ''),
      nullif(left(btrim(p_utm_campaign), 200), ''),
      nullif(left(btrim(p_utm_content), 200), ''),
      nullif(left(btrim(p_utm_term), 200), ''),
      nullif(left(btrim(p_referrer), 500), ''),
      nullif(left(btrim(p_landing_path), 200), ''),
      v_consent, now(),
      p_confirm_token_hash, now() + c_token_ttl
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
      RETURN jsonb_build_object('result', 'created', 'id', v_id, 'resend', true);
    END IF;

    SELECT * INTO v_row FROM public.newsletter_subscribers
      WHERE email = v_email
      FOR UPDATE;
    EXIT WHEN FOUND;
    -- The conflicting row was deleted between the two statements: try again.
  END LOOP;

  IF v_row.status = 'subscribed' THEN
    RETURN jsonb_build_object('result', 'subscribed', 'id', NULL, 'resend', false);
  END IF;

  IF v_row.status = 'pending'
     AND v_row.confirm_expires_at IS NOT NULL
     AND v_row.confirm_expires_at > now() + c_token_ttl - c_resend_cooldown THEN
    RETURN jsonb_build_object('result', 'pending', 'id', v_row.id, 'resend', false);
  END IF;

  UPDATE public.newsletter_subscribers
    SET status = 'pending',
        consent_text = v_consent,
        consent_at = now(),
        confirm_token_hash = p_confirm_token_hash,
        confirm_expires_at = now() + c_token_ttl
    WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'result', CASE WHEN v_row.status = 'unsubscribed' THEN 'resubscribe' ELSE 'pending' END,
    'id', v_row.id,
    'resend', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_subscribe(text, text, text, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_subscribe(text, text, text, text, text, text, text, text, text, text, text, text)
  TO service_role;

-- ===========================================================================
-- 3. newsletter_confirm — the link in the confirmation email
-- ===========================================================================
--
-- Returns {"result": "confirmed" | "already" | "invalid"}:
--   confirmed  the token matched an unexpired pending row; it is now
--              subscribed. The token is retired, not deleted (see below).
--   already    the token matched an unexpired row that is already subscribed:
--              the same link opened twice (or prefetched by a mail scanner
--              first). Possible because a used token is kept until its
--              original expiry instead of being cleared on use.
--   invalid    unknown, superseded (a newer email was requested), expired, or
--              belonging to an address that has since unsubscribed (the
--              trigger clears the token on unsubscribe).

CREATE OR REPLACE FUNCTION public.newsletter_confirm(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_status text;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_confirm_token' USING ERRCODE = '22023';
  END IF;

  SELECT id, status INTO v_id, v_status
    FROM public.newsletter_subscribers
    WHERE confirm_token_hash = p_token_hash
      AND confirm_expires_at > now()
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'invalid');
  END IF;
  IF v_status = 'subscribed' THEN
    RETURN jsonb_build_object('result', 'already');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('result', 'invalid');
  END IF;

  UPDATE public.newsletter_subscribers
    SET status = 'subscribed', confirmed_at = now()
    WHERE id = v_id;
  RETURN jsonb_build_object('result', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_confirm(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_confirm(text) TO service_role;

-- ===========================================================================
-- 4. newsletter_unsubscribe — the link in every edition
-- ===========================================================================
--
-- True when the token belongs to a row (whether or not it was already
-- unsubscribed — repeat clicks and one-click POSTs are idempotent and keep
-- the first unsubscribed_at); false for an unknown token.

CREATE OR REPLACE FUNCTION public.newsletter_unsubscribe(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_token IS NULL THEN
    RAISE EXCEPTION 'invalid_unsubscribe_token' USING ERRCODE = '22023';
  END IF;

  UPDATE public.newsletter_subscribers
    SET status = 'unsubscribed', unsubscribed_at = now()
    WHERE unsubscribe_token = p_token
      AND status <> 'unsubscribed';
  IF FOUND THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.newsletter_subscribers WHERE unsubscribe_token = p_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.newsletter_unsubscribe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_unsubscribe(uuid) TO service_role;

-- ===========================================================================
-- 5. newsletter_recipients — for the edition send script
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.newsletter_recipients()
RETURNS TABLE (email text, unsubscribe_token uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.email, s.unsubscribe_token
    FROM public.newsletter_subscribers AS s
    WHERE s.status = 'subscribed'
    ORDER BY s.confirmed_at, s.id;
$$;

REVOKE ALL ON FUNCTION public.newsletter_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.newsletter_recipients() TO service_role;

COMMIT;

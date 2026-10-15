-- Waitlist hardening: one signup per real mailbox, and a daily per-client cap.
--
-- Requires 20261014120000_waitlist_signups.sql. Apply after it (and after
-- 20261014130000_newsletter_subscribers.sql if that is applied; the two are
-- independent of each other, but the order keeps the history linear).
--
-- Safe whether or not the table already has rows, and safe to re-run:
--   * ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, CREATE ... IF NOT EXISTS,
--     DROP TRIGGER IF EXISTS before CREATE TRIGGER.
--   * The backfill never deletes or rewrites a signup. If two existing rows
--     fold to the same mailbox (say `ab@gmail.com` and later `a.b@gmail.com`),
--     the OLDEST row keeps the canonical key and the newer ones keep a NULL
--     key, so the UNIQUE index can be built. Those rows stay visible for a
--     human to merge or remove (docs/waitlist.md §4.5); the migration reports
--     how many there are with a NOTICE.
--
-- What changes:
--   1. waitlist_signups.email_canonical — the mailbox an address delivers to:
--      lower-cased, `+tag` stripped for every domain, and for Gmail dots
--      stripped and googlemail.com folded into gmail.com. UNIQUE. `email`
--      stays exactly as typed (trimmed, lower-cased): that's the address Covey
--      sends to. A BEFORE trigger keeps the key correct for rows written by
--      hand in the dashboard too.
--   2. waitlist_join — same signature and grants. Conflicts on any unique key
--      (email or email_canonical), so `a.b+x@gmail.com` after `ab@gmail.com`
--      is "existing". Adds a rolling-24h cap per client key on top of the
--      existing 8 per 10 minutes.

BEGIN;

-- ADD COLUMN takes an ACCESS EXCLUSIVE lock until COMMIT. If something (an
-- open dashboard transaction) holds the table, fail fast and retry rather
-- than queue every signup behind us until the endpoint's 8 s timeout.
SET LOCAL lock_timeout = '5s';

-- ===========================================================================
-- 1. Canonical mailbox
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.waitlist_canonical_email(p_email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v text := lower(btrim(p_email));
  v_local text;
  v_domain text;
  v_stripped text;
BEGIN
  IF v IS NULL OR v = '' OR strpos(v, '@') = 0 THEN
    RETURN v;
  END IF;
  -- The shape check in waitlist_join and the table CHECK allow exactly one
  -- '@'; split on the last one anyway so a hand-written oddity can't shift
  -- the domain.
  v_domain := rtrim(regexp_replace(v, '^.*@', ''), '.');
  v_local := left(v, char_length(v) - char_length(regexp_replace(v, '^.*@', '')) - 1);

  -- Sub-addressing: everything from the first '+' is a label on the same
  -- mailbox. A local part that is ONLY a tag ("+x@…") is left alone rather
  -- than collapsing to an empty mailbox.
  v_stripped := split_part(v_local, '+', 1);
  IF v_stripped <> '' THEN
    v_local := v_stripped;
  END IF;

  IF v_domain = 'googlemail.com' THEN
    v_domain := 'gmail.com';
  END IF;
  -- Gmail ignores dots in the local part.
  IF v_domain = 'gmail.com' THEN
    v_stripped := replace(v_local, '.', '');
    IF v_stripped <> '' THEN
      v_local := v_stripped;
    END IF;
  END IF;

  RETURN v_local || '@' || v_domain;
END;
$$;

COMMENT ON FUNCTION public.waitlist_canonical_email(text) IS
  'Mailbox key for waitlist dedupe: lower-case, strip +tag, Gmail dots, googlemail.com -> gmail.com. Never used as a send address.';

REVOKE ALL ON FUNCTION public.waitlist_canonical_email(text) FROM PUBLIC, anon, authenticated;
-- service_role keeps direct table grants on Supabase (default privileges), so
-- the trigger below must be callable when it inserts a row by hand.
GRANT EXECUTE ON FUNCTION public.waitlist_canonical_email(text) TO service_role;

ALTER TABLE public.waitlist_signups ADD COLUMN IF NOT EXISTS email_canonical text;

-- Backfill: oldest row per mailbox wins (created_at, then id as a tiebreak so
-- the choice is deterministic). Newer duplicates keep NULL. Only rows that
-- don't already have a key are touched, so a re-run changes nothing.
-- The touch trigger is off for the backfill so it doesn't rewrite updated_at
-- (or stamp invited_at/joined_at on a hand-written row) for every signup;
-- the ACCESS EXCLUSIVE lock from ADD COLUMN makes this invisible to others.
ALTER TABLE public.waitlist_signups DISABLE TRIGGER waitlist_signups_touch;

WITH ranked AS (
  SELECT id,
         public.waitlist_canonical_email(email) AS canonical,
         row_number() OVER (
           PARTITION BY public.waitlist_canonical_email(email)
           ORDER BY created_at, id
         ) AS rn
  FROM public.waitlist_signups
)
UPDATE public.waitlist_signups s
   SET email_canonical = r.canonical
  FROM ranked r
 WHERE s.id = r.id
   AND r.rn = 1
   AND s.email_canonical IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.waitlist_signups o
      WHERE o.email_canonical = r.canonical AND o.id <> s.id
   );

ALTER TABLE public.waitlist_signups ENABLE TRIGGER waitlist_signups_touch;

DO $$
DECLARE
  v_unresolved int;
BEGIN
  SELECT count(*) INTO v_unresolved FROM public.waitlist_signups WHERE email_canonical IS NULL;
  IF v_unresolved > 0 THEN
    RAISE NOTICE 'waitlist_hardening: % newer signup(s) share a mailbox with an older row and were left with email_canonical = NULL (see docs/waitlist.md §4.5)', v_unresolved;
  END IF;
END $$;

-- NULLs are distinct in a UNIQUE index, so unresolved legacy duplicates don't
-- block it; every row written from now on gets a key from the trigger.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_canonical_key
  ON public.waitlist_signups (email_canonical);

CREATE OR REPLACE FUNCTION public.waitlist_signups_canonicalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.email_canonical := public.waitlist_canonical_email(NEW.email);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_signups_canonicalize() FROM PUBLIC, anon, authenticated;

-- Fires on INSERT, and on UPDATE only when email or the key itself is
-- written, so an ordinary status/city update never re-keys a legacy
-- duplicate (which would collide). Setting the key by hand is overridden.
DROP TRIGGER IF EXISTS waitlist_signups_canonicalize ON public.waitlist_signups;
CREATE TRIGGER waitlist_signups_canonicalize
  BEFORE INSERT OR UPDATE OF email, email_canonical ON public.waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION public.waitlist_signups_canonicalize();

-- ===========================================================================
-- 2. waitlist_join — same signature, stricter
-- ===========================================================================
--
-- Returns {"result": "created" | "existing" | "rate_limited", "id": uuid|null}
-- plus, when rate limited, "limit": "window" | "daily".

CREATE OR REPLACE FUNCTION public.waitlist_join(
  p_email text,
  p_client_key text,
  p_source text DEFAULT 'landing',
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_utm_term text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_landing_path text DEFAULT NULL,
  p_followup_token_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_canonical text;
  v_window timestamptz;
  v_count int;
  v_daily int;
  v_id uuid;
  -- 8 attempts per client per 10 minutes covers a household or office
  -- sharing an IP; a script hits it on the ninth request.
  c_max int := 8;
  c_window_seconds int := 600;
  -- ...and at most 30 per rolling 24 hours. A single-IP script that paces
  -- itself under the window limit would otherwise get 8 x 144 = 1,152 rows a
  -- day; this holds it to 30. Each 10-minute window counts at most c_max, so
  -- hammering through a 429 doesn't also burn the next day's allowance for
  -- everyone behind a shared address (a campus or office NAT, or an IPv6 /64
  -- that a whole LAN shares).
  c_daily_max int := 30;
BEGIN
  IF char_length(v_email) NOT BETWEEN 3 AND 254
     OR v_email !~ '^[^@\s<>"(),;:\[\]\\]+@[^@\s<>"(),;:\[\]\\]+\.[^@\s<>"(),;:\[\]\\]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;
  IF p_client_key IS NULL OR char_length(p_client_key) NOT BETWEEN 16 AND 128 THEN
    RAISE EXCEPTION 'invalid_client_key' USING ERRCODE = '22023';
  END IF;
  IF p_followup_token_hash IS NOT NULL AND p_followup_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_followup_token' USING ERRCODE = '22023';
  END IF;

  v_canonical := public.waitlist_canonical_email(v_email);

  v_window := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / c_window_seconds) * c_window_seconds
  );

  INSERT INTO public.waitlist_rate_limits (client_key, window_started_at)
  VALUES (p_client_key, v_window)
  ON CONFLICT (client_key, window_started_at)
  DO UPDATE SET request_count = public.waitlist_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Housekeeping: stale rate windows on every call (indexed, cheap); expired
  -- follow-up tokens on ~2% of calls.
  DELETE FROM public.waitlist_rate_limits
    WHERE window_started_at < now() - interval '1 day';
  IF random() < 0.02 THEN
    UPDATE public.waitlist_signups
      SET followup_token_hash = NULL, followup_expires_at = NULL
      WHERE followup_expires_at < now();
  END IF;

  IF v_count > c_max THEN
    RETURN jsonb_build_object('result', 'rate_limited', 'id', NULL, 'limit', 'window');
  END IF;

  -- At most 145 rows per key (the primary key index serves this range scan).
  -- Keys are scoped per form by the server's HMAC, so newsletter attempts in
  -- the shared table never count against the waitlist.
  SELECT coalesce(sum(least(request_count, c_max)), 0) INTO v_daily
    FROM public.waitlist_rate_limits
   WHERE client_key = p_client_key
     AND window_started_at > now() - interval '1 day';
  IF v_daily > c_daily_max THEN
    RETURN jsonb_build_object('result', 'rate_limited', 'id', NULL, 'limit', 'daily');
  END IF;

  -- No conflict target: a clash on either email or email_canonical (or, in
  -- theory, a 256-bit follow-up hash) is "existing", never an error. The
  -- existing row is never modified.
  INSERT INTO public.waitlist_signups (
    email, email_canonical, source,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path,
    followup_token_hash, followup_expires_at
  )
  VALUES (
    v_email,
    v_canonical,
    coalesce(nullif(left(btrim(p_source), 64), ''), 'landing'),
    nullif(left(btrim(p_utm_source), 200), ''),
    nullif(left(btrim(p_utm_medium), 200), ''),
    nullif(left(btrim(p_utm_campaign), 200), ''),
    nullif(left(btrim(p_utm_content), 200), ''),
    nullif(left(btrim(p_utm_term), 200), ''),
    nullif(left(btrim(p_referrer), 500), ''),
    nullif(left(btrim(p_landing_path), 200), ''),
    p_followup_token_hash,
    CASE WHEN p_followup_token_hash IS NULL THEN NULL ELSE now() + interval '1 hour' END
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('result', 'existing', 'id', NULL);
  END IF;
  RETURN jsonb_build_object('result', 'created', 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)
  TO service_role;

-- Re-assert the table lockdown in case anything drifted since the first
-- migration (Supabase default privileges re-grant on new objects, not old
-- ones, but this is cheap and makes the file self-checking).
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.waitlist_signups FROM PUBLIC, anon, authenticated;

COMMIT;

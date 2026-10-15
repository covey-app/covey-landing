-- Pre-launch waitlist for coveyapp.co.
--
-- Lives beside the app schema in the shared Supabase project, but touches no
-- app table: nothing here references profiles, auth.users, or any client
-- contract, so the landing site can be decoupled later by moving two tables.
--
-- Access model (matches the "RPC-gated writes, INSERT denied at the table"
-- pattern used elsewhere in covey/supabase):
--   * Both tables have RLS on, no policies, and every grant revoked from
--     PUBLIC, anon, and authenticated. The anon key cannot read, count, or
--     write a single row, through PostgREST or GraphQL.
--   * The two SECURITY DEFINER functions are executable by service_role only,
--     run with an empty search_path, and name every object schema-qualified.
--     The landing site's server endpoint (/api/waitlist on Vercel) is their
--     only intended caller, and it holds the key server-side.
--   * Team members read and export through the Supabase dashboard / SQL
--     editor (postgres role). See docs/waitlist.md.
--
-- Apply: copy into covey/supabase/migrations (the canonical directory) and
-- push from there, or run once in the SQL editor. It is idempotent only in the
-- sense that a second run fails loudly on CREATE TABLE; it never drops data.

BEGIN;

-- ===========================================================================
-- 1. Signups
-- ===========================================================================

CREATE TABLE public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Normalized (trimmed, lower-cased) by waitlist_join; the CHECK makes a
  -- mixed-case duplicate impossible even for rows written by hand.
  email text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  -- Optional launch-market interest, asked after signup (one tap, skippable).
  city text,
  -- Which Covey surface collected the signup, e.g. 'landing:hero'.
  source text NOT NULL DEFAULT 'landing',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  -- Origin + path of the external page that sent the visitor; no query string.
  referrer text,
  -- First page of the visit on coveyapp.co, e.g. '/' or '/waitlist'.
  landing_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  invited_at timestamptz,
  joined_at timestamptz,
  -- SHA-256 (hex) of a one-time token returned only to the browser that
  -- created this row, so it — and nobody else — can add a city afterwards.
  -- Cleared once expired.
  followup_token_hash text,
  followup_expires_at timestamptz,

  CONSTRAINT waitlist_signups_email_normalized
    CHECK (email = lower(btrim(email))),
  CONSTRAINT waitlist_signups_email_shape
    CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@\s<>"(),;:\[\]\\]+@[^@\s<>"(),;:\[\]\\]+\.[^@\s<>"(),;:\[\]\\]+$'),
  CONSTRAINT waitlist_signups_status
    CHECK (status IN ('waiting', 'invited', 'joined', 'removed')),
  CONSTRAINT waitlist_signups_city
    CHECK (city IS NULL OR city IN ('san-francisco', 'davis', 'other')),
  CONSTRAINT waitlist_signups_source_len CHECK (char_length(source) BETWEEN 1 AND 64),
  CONSTRAINT waitlist_signups_utm_len CHECK (
    coalesce(char_length(utm_source), 0) <= 200
    AND coalesce(char_length(utm_medium), 0) <= 200
    AND coalesce(char_length(utm_campaign), 0) <= 200
    AND coalesce(char_length(utm_content), 0) <= 200
    AND coalesce(char_length(utm_term), 0) <= 200
  ),
  CONSTRAINT waitlist_signups_referrer_len CHECK (coalesce(char_length(referrer), 0) <= 500),
  CONSTRAINT waitlist_signups_landing_len CHECK (coalesce(char_length(landing_path), 0) <= 200),
  CONSTRAINT waitlist_signups_token_shape
    CHECK (followup_token_hash IS NULL OR followup_token_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX waitlist_signups_email_key ON public.waitlist_signups (email);
CREATE INDEX waitlist_signups_created_idx ON public.waitlist_signups (created_at);
CREATE INDEX waitlist_signups_status_idx ON public.waitlist_signups (status);
CREATE UNIQUE INDEX waitlist_signups_followup_idx
  ON public.waitlist_signups (followup_token_hash)
  WHERE followup_token_hash IS NOT NULL;

COMMENT ON TABLE public.waitlist_signups IS
  'Pre-launch waitlist from coveyapp.co. Service-role/dashboard access only. See covey-landing docs/waitlist.md.';

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.waitlist_signups FROM PUBLIC, anon, authenticated;

-- Keep updated_at honest, and stamp invited_at / joined_at the first time a
-- row moves into that status (a manual UPDATE ... SET status = 'invited' is
-- the whole invite workflow).
CREATE OR REPLACE FUNCTION public.waitlist_signups_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'invited' AND NEW.invited_at IS NULL THEN
    NEW.invited_at := now();
  END IF;
  IF NEW.status = 'joined' AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_signups_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER waitlist_signups_touch
  BEFORE UPDATE ON public.waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION public.waitlist_signups_touch();

-- ===========================================================================
-- 2. Rate-limit windows
-- ===========================================================================
--
-- client_key is an HMAC of the visitor's IP computed by the server endpoint;
-- the raw IP never reaches the database. Every waitlist_join call deletes rows
-- older than a day, so no key outlives the next signup by more than that.

CREATE TABLE public.waitlist_rate_limits (
  client_key text NOT NULL CHECK (char_length(client_key) BETWEEN 16 AND 128),
  window_started_at timestamptz NOT NULL,
  request_count int NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (client_key, window_started_at)
);

CREATE INDEX waitlist_rate_limits_window_idx ON public.waitlist_rate_limits (window_started_at);

ALTER TABLE public.waitlist_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.waitlist_rate_limits FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- 3. waitlist_join — the only write path
-- ===========================================================================
--
-- Returns {"result": "created" | "existing" | "rate_limited", "id": uuid|null}.
-- An existing row is never modified: a second signup cannot overwrite the
-- first one's attribution, city, or status.

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
  v_window timestamptz;
  v_count int;
  v_id uuid;
  -- 8 attempts per client per 10 minutes covers a household or office
  -- sharing an IP; a script hits it on the ninth request.
  c_max int := 8;
  c_window_seconds int := 600;
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
    RETURN jsonb_build_object('result', 'rate_limited', 'id', NULL);
  END IF;

  INSERT INTO public.waitlist_signups (
    email, source,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    referrer, landing_path,
    followup_token_hash, followup_expires_at
  )
  VALUES (
    v_email,
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
  ON CONFLICT (email) DO NOTHING
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

-- ===========================================================================
-- 4. waitlist_set_city — optional follow-up, proven by the one-time token
-- ===========================================================================
--
-- Returns true when a row was updated. The token only exists for an hour after
-- the browser that created the row received it; an existing-email signup never
-- gets one, so nobody can edit a row they did not create.

CREATE OR REPLACE FUNCTION public.waitlist_set_city(
  p_followup_token_hash text,
  p_city text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows int;
BEGIN
  IF p_followup_token_hash IS NULL OR p_followup_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_followup_token' USING ERRCODE = '22023';
  END IF;
  IF p_city IS NULL OR p_city NOT IN ('san-francisco', 'davis', 'other') THEN
    RAISE EXCEPTION 'invalid_city' USING ERRCODE = '22023';
  END IF;

  UPDATE public.waitlist_signups
    SET city = p_city
    WHERE followup_token_hash = p_followup_token_hash
      AND followup_expires_at > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_set_city(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waitlist_set_city(text, text) TO service_role;

COMMIT;

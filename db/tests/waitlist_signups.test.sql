-- Assertions for db/migrations/20261014120000_waitlist_signups.sql and
-- db/migrations/20261015120000_waitlist_hardening.sql, applied in order.
-- (Backfill of pre-existing rows: waitlist_hardening.test.sql.)
--
-- Runs against a throwaway Postgres with the Supabase roles stubbed in; see
-- docs/waitlist.md ("Testing the migration") for the one-line Docker command.
-- Every check RAISEs on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.

\set ON_ERROR_STOP 1

-- --- Supabase role stubs (no-ops on a real Supabase database) -------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Mirror Supabase's default privileges, which grant every new public table
-- to the API roles. The migration must revoke them; this proves it does.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

\i db/migrations/20261014120000_waitlist_signups.sql
\i db/migrations/20261015120000_waitlist_hardening.sql

-- --- Privilege checks ------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(r, 'public.waitlist_signups', 'SELECT')
       OR has_table_privilege(r, 'public.waitlist_signups', 'INSERT')
       OR has_table_privilege(r, 'public.waitlist_signups', 'UPDATE')
       OR has_table_privilege(r, 'public.waitlist_signups', 'DELETE') THEN
      RAISE EXCEPTION 'FAIL: % has a privilege on waitlist_signups', r;
    END IF;
    IF has_table_privilege(r, 'public.waitlist_rate_limits', 'SELECT')
       OR has_table_privilege(r, 'public.waitlist_rate_limits', 'INSERT') THEN
      RAISE EXCEPTION 'FAIL: % has a privilege on waitlist_rate_limits', r;
    END IF;
    IF has_function_privilege(r, 'public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute waitlist_join', r;
    END IF;
    IF has_function_privilege(r, 'public.waitlist_set_city(text, text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute waitlist_set_city', r;
    END IF;
    IF has_function_privilege(r, 'public.waitlist_canonical_email(text)', 'EXECUTE')
       OR has_function_privilege(r, 'public.waitlist_signups_canonicalize()', 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: % can execute a hardening helper', r;
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role cannot execute waitlist_join';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid = 'public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)'::regprocedure) IS NOT TRUE
     OR (SELECT proconfig FROM pg_proc WHERE oid = 'public.waitlist_join(text, text, text, text, text, text, text, text, text, text, text)'::regprocedure) IS DISTINCT FROM ARRAY['search_path=""'] THEN
    RAISE EXCEPTION 'FAIL: waitlist_join lost SECURITY DEFINER or its empty search_path';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.waitlist_signups'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS disabled on waitlist_signups';
  END IF;
  RAISE NOTICE 'ok: privileges';
END $$;

-- anon really is denied at runtime, not just on paper.
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.waitlist_signups;
    RAISE EXCEPTION 'FAIL: anon could read waitlist_signups';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.waitlist_join('a@b.co', 'kkkkkkkkkkkkkkkk');
    RAISE EXCEPTION 'FAIL: anon could call waitlist_join';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'ok: anon denied at runtime';
END $$;
RESET ROLE;

-- --- Behaviour, as service_role -------------------------------------------
SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
  v_row public.waitlist_signups%ROWTYPE;
  v_hash text := repeat('a', 64);
  i int;
BEGIN
  -- Created, normalized, attribution kept.
  v := public.waitlist_join('  Mixed.Case@Example.COM ', 'client-key-000001', 'landing:hero',
                            'instagram', 'social', 'launch', 'reel-1', NULL,
                            'https://l.instagram.com/', '/', v_hash);
  IF v->>'result' <> 'created' OR v->>'id' IS NULL THEN
    RAISE EXCEPTION 'FAIL: expected created, got %', v;
  END IF;
  SELECT * INTO v_row FROM public.waitlist_signups WHERE id = (v->>'id')::uuid;
  IF v_row.email <> 'mixed.case@example.com' OR v_row.status <> 'waiting'
     OR v_row.utm_source <> 'instagram' OR v_row.source <> 'landing:hero'
     OR v_row.followup_expires_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: row not stored as expected: %', row_to_json(v_row);
  END IF;

  -- Duplicate (case/whitespace variant) is "existing" and changes nothing.
  v := public.waitlist_join('mixed.case@example.com', 'client-key-000002', 'landing:closing',
                            'tiktok', NULL, NULL, NULL, NULL, NULL, NULL, repeat('b', 64));
  IF v->>'result' <> 'existing' OR v->>'id' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: expected existing, got %', v;
  END IF;
  IF (SELECT utm_source FROM public.waitlist_signups WHERE email = 'mixed.case@example.com') <> 'instagram' THEN
    RAISE EXCEPTION 'FAIL: duplicate signup overwrote attribution';
  END IF;
  IF (SELECT count(*) FROM public.waitlist_signups) <> 1 THEN
    RAISE EXCEPTION 'FAIL: duplicate created a second row';
  END IF;

  -- Invalid email rejected.
  BEGIN
    PERFORM public.waitlist_join('not-an-email', 'client-key-000003');
    RAISE EXCEPTION 'FAIL: invalid email accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- City follow-up: right token works, wrong token and bad city do not.
  IF NOT public.waitlist_set_city(v_hash, 'davis') THEN
    RAISE EXCEPTION 'FAIL: valid token could not set city';
  END IF;
  IF public.waitlist_set_city(repeat('c', 64), 'davis') THEN
    RAISE EXCEPTION 'FAIL: unknown token updated a row';
  END IF;
  BEGIN
    PERFORM public.waitlist_set_city(v_hash, 'atlantis');
    RAISE EXCEPTION 'FAIL: invalid city accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Expired token is refused.
  UPDATE public.waitlist_signups SET followup_expires_at = now() - interval '1 second'
    WHERE email = 'mixed.case@example.com';
  IF public.waitlist_set_city(v_hash, 'san-francisco') THEN
    RAISE EXCEPTION 'FAIL: expired token updated a row';
  END IF;

  -- Status timestamps stamp once.
  UPDATE public.waitlist_signups SET status = 'invited' WHERE email = 'mixed.case@example.com';
  IF (SELECT invited_at FROM public.waitlist_signups WHERE email = 'mixed.case@example.com') IS NULL THEN
    RAISE EXCEPTION 'FAIL: invited_at not stamped';
  END IF;

  -- Rate limit: the 9th attempt in a window from one client is refused.
  FOR i IN 1..8 LOOP
    v := public.waitlist_join(format('rl%s@example.com', i), 'client-key-ratelimit');
    IF v->>'result' <> 'created' THEN
      RAISE EXCEPTION 'FAIL: attempt % should pass, got %', i, v;
    END IF;
  END LOOP;
  v := public.waitlist_join('rl9@example.com', 'client-key-ratelimit');
  IF v->>'result' <> 'rate_limited' OR v->>'limit' <> 'window' THEN
    RAISE EXCEPTION 'FAIL: 9th attempt should be rate_limited (window), got %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.waitlist_signups WHERE email = 'rl9@example.com') THEN
    RAISE EXCEPTION 'FAIL: rate-limited attempt still inserted';
  END IF;

  RAISE NOTICE 'ok: behaviour';
END $$;
RESET ROLE;

-- --- One signup per mailbox (canonical email) -----------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('ab@gmail.com',                 'ab@gmail.com'),
    ('  A.B+Covey@GMail.com ',       'ab@gmail.com'),
    ('a.b@googlemail.com',           'ab@gmail.com'),
    ('a.b+x+y@googlemail.com',       'ab@gmail.com'),
    ('pat+news@fastmail.com',        'pat@fastmail.com'),
    ('p.a.t@fastmail.com',           'p.a.t@fastmail.com'),   -- dots only fold for Gmail
    ('+only-a-tag@example.com',      '+only-a-tag@example.com'),
    ('...@gmail.com',                '...@gmail.com'),
    ('pat@example.com.',             'pat@example.com')
  ) AS t(input, expected) LOOP
    IF public.waitlist_canonical_email(r.input) IS DISTINCT FROM r.expected THEN
      RAISE EXCEPTION 'FAIL: canonical(%) = %, expected %', r.input, public.waitlist_canonical_email(r.input), r.expected;
    END IF;
  END LOOP;
  RAISE NOTICE 'ok: canonical_email';
END $$;

SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
  v_row public.waitlist_signups%ROWTYPE;
  v_variant text;
  i int := 0;
BEGIN
  v := public.waitlist_join('Pat.Doe+Covey@Gmail.com', 'client-key-canon-000', 'landing:page', 'instagram');
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: first gmail signup should be created, got %', v;
  END IF;
  SELECT * INTO v_row FROM public.waitlist_signups WHERE id = (v->>'id')::uuid;
  IF v_row.email <> 'pat.doe+covey@gmail.com' OR v_row.email_canonical <> 'patdoe@gmail.com' THEN
    RAISE EXCEPTION 'FAIL: send address must be kept as typed, key folded: %', row_to_json(v_row);
  END IF;

  FOREACH v_variant IN ARRAY ARRAY['patdoe@gmail.com', 'p.a.t.d.o.e@gmail.com', 'pat.doe@googlemail.com',
                                   'PatDoe+other@gmail.com', 'pat.doe+covey@gmail.com'] LOOP
    i := i + 1;
    v := public.waitlist_join(v_variant, format('client-key-canon-%s', lpad(i::text, 3, '0')), 'landing:hero', 'tiktok');
    IF v->>'result' <> 'existing' OR v->>'id' IS NOT NULL THEN
      RAISE EXCEPTION 'FAIL: % should be existing, got %', v_variant, v;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.waitlist_signups WHERE email_canonical = 'patdoe@gmail.com') <> 1
     OR (SELECT utm_source FROM public.waitlist_signups WHERE email_canonical = 'patdoe@gmail.com') <> 'instagram' THEN
    RAISE EXCEPTION 'FAIL: a variant created a row or overwrote attribution';
  END IF;

  -- Plus tags fold for every domain; dots don't outside Gmail.
  v := public.waitlist_join('sam@fastmail.com', 'client-key-canon-100');
  IF v->>'result' <> 'created' THEN RAISE EXCEPTION 'FAIL: sam@fastmail.com %', v; END IF;
  v := public.waitlist_join('sam+waitlist@fastmail.com', 'client-key-canon-101');
  IF v->>'result' <> 'existing' THEN RAISE EXCEPTION 'FAIL: plus variant on fastmail should be existing, got %', v; END IF;
  v := public.waitlist_join('s.am@fastmail.com', 'client-key-canon-102');
  IF v->>'result' <> 'created' THEN RAISE EXCEPTION 'FAIL: dotted non-gmail is a different mailbox, got %', v; END IF;

  -- A direct insert by service_role (which keeps table grants on Supabase)
  -- is keyed by the trigger, so it can't sneak a duplicate past the index.
  BEGIN
    INSERT INTO public.waitlist_signups (email) VALUES ('pat.doe+direct@gmail.com');
    RAISE EXCEPTION 'FAIL: direct insert of a mailbox variant succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.waitlist_signups (email, email_canonical) VALUES ('direct+x@example.com', 'forged@example.com');
  IF (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'direct+x@example.com') <> 'direct@example.com' THEN
    RAISE EXCEPTION 'FAIL: trigger did not override a hand-set canonical key';
  END IF;
  UPDATE public.waitlist_signups SET email_canonical = NULL WHERE email = 'direct+x@example.com';
  IF (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'direct+x@example.com') IS NULL THEN
    RAISE EXCEPTION 'FAIL: canonical key could be cleared by hand';
  END IF;
  RAISE NOTICE 'ok: one signup per mailbox';
END $$;
RESET ROLE;

-- --- Daily cap: 30 attempts per client key per rolling 24h ----------------
-- Earlier windows today: 8 + 8 + 100 + 5. The 100-attempt window (someone
-- hammering through a 429) counts as 8, so the total is 29, not 121.
INSERT INTO public.waitlist_rate_limits (client_key, window_started_at, request_count) VALUES
  ('client-key-daily-0001', now() - interval '1 hour', 8),
  ('client-key-daily-0001', now() - interval '2 hours', 8),
  ('client-key-daily-0001', now() - interval '3 hours', 100),
  ('client-key-daily-0001', now() - interval '20 hours', 5);
SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.waitlist_join('daily30@example.com', 'client-key-daily-0001');
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: 30th attempt of the day should pass, got %', v;
  END IF;
  v := public.waitlist_join('daily31@example.com', 'client-key-daily-0001');
  IF v->>'result' <> 'rate_limited' OR v->>'limit' <> 'daily' THEN
    RAISE EXCEPTION 'FAIL: 31st attempt of the day should be rate_limited (daily), got %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.waitlist_signups WHERE email = 'daily31@example.com') THEN
    RAISE EXCEPTION 'FAIL: daily-limited attempt still inserted';
  END IF;
  v := public.waitlist_join('daily-other@example.com', 'client-key-daily-0002');
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: another client is unaffected by the daily cap, got %', v;
  END IF;
  RAISE NOTICE 'ok: daily cap';
END $$;
RESET ROLE;

-- Rate-limit keys older than a day are gone after the next signup.
INSERT INTO public.waitlist_rate_limits (client_key, window_started_at)
  VALUES ('client-key-stale-0001', now() - interval '25 hours');
SET ROLE service_role;
SELECT public.waitlist_join('prune@example.com', 'client-key-prune-001');
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.waitlist_rate_limits WHERE client_key = 'client-key-stale-0001') THEN
    RAISE EXCEPTION 'FAIL: stale rate-limit key survived a signup';
  END IF;
  RAISE NOTICE 'ok: pruning';
END $$;

-- Hand-written rows cannot bypass normalization or the status vocabulary.
DO $$
BEGIN
  BEGIN
    INSERT INTO public.waitlist_signups (email) VALUES ('Upper@Example.com');
    RAISE EXCEPTION 'FAIL: un-normalized email inserted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.waitlist_signups SET status = 'vip';
    RAISE EXCEPTION 'FAIL: unknown status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'ok: constraints';
END $$;

\echo 'waitlist_signups: all checks passed'

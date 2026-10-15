-- Assertions for db/migrations/20261014130000_newsletter_subscribers.sql.
--
-- Runs against a throwaway Postgres with the Supabase roles stubbed in
-- (npm run test:db). Every check RAISEs on failure, so psql -v ON_ERROR_STOP=1
-- exits non-zero.

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
-- Mirror Supabase's default privileges, which grant every new public table and
-- function to the API roles. The migration must revoke them; this proves it.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- The newsletter reuses waitlist_rate_limits, so the waitlist goes first.
\i db/migrations/20261014120000_waitlist_signups.sql
\i db/migrations/20261014130000_newsletter_subscribers.sql
\i db/migrations/20261015120000_waitlist_hardening.sql

-- --- Privilege checks (catalog) --------------------------------------------
DO $$
DECLARE
  r text;
  t text;
  f text;
  c_tables text[] := ARRAY['public.newsletter_subscribers', 'public.waitlist_rate_limits'];
  c_functions text[] := ARRAY[
    'public.newsletter_subscribe(text, text, text, text, text, text, text, text, text, text, text, text)',
    'public.newsletter_confirm(text)',
    'public.newsletter_unsubscribe(uuid)',
    'public.newsletter_recipients()',
    'public.newsletter_subscribers_touch()'
  ];
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'public'] LOOP
    FOREACH t IN ARRAY c_tables LOOP
      IF r <> 'public' AND (
           has_table_privilege(r, t, 'SELECT') OR has_table_privilege(r, t, 'INSERT')
        OR has_table_privilege(r, t, 'UPDATE') OR has_table_privilege(r, t, 'DELETE')
        OR has_table_privilege(r, t, 'TRUNCATE') OR has_table_privilege(r, t, 'REFERENCES')
        OR has_table_privilege(r, t, 'TRIGGER')) THEN
        RAISE EXCEPTION 'FAIL: % has a privilege on %', r, t;
      END IF;
    END LOOP;
    FOREACH f IN ARRAY c_functions LOOP
      IF r = 'public' THEN
        -- PUBLIC gets EXECUTE on new functions by default; it must be revoked.
        IF EXISTS (
          SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          WHERE p.oid = f::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) THEN
          RAISE EXCEPTION 'FAIL: PUBLIC can execute %', f;
        END IF;
      ELSIF has_function_privilege(r, f, 'EXECUTE') THEN
        RAISE EXCEPTION 'FAIL: % can execute %', r, f;
      END IF;
    END LOOP;
  END LOOP;

  FOREACH f IN ARRAY c_functions[1:4] LOOP
    IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: service_role cannot execute %', f;
    END IF;
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = f::regprocedure) THEN
      RAISE EXCEPTION 'FAIL: % is not SECURITY DEFINER', f;
    END IF;
    IF NOT (SELECT 'search_path=""' = ANY (proconfig) FROM pg_proc WHERE oid = f::regprocedure) THEN
      RAISE EXCEPTION 'FAIL: % does not pin an empty search_path', f;
    END IF;
  END LOOP;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.newsletter_subscribers'::regclass) THEN
    RAISE EXCEPTION 'FAIL: RLS disabled on newsletter_subscribers';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_subscribers') THEN
    RAISE EXCEPTION 'FAIL: newsletter_subscribers has a policy (expected none)';
  END IF;
  RAISE NOTICE 'ok: privileges';
END $$;

-- Seed one row as the owner so the runtime denials below have something to
-- (fail to) see.
INSERT INTO public.newsletter_subscribers (email, consent_text)
  VALUES ('seed@example.com', 'seed consent');

-- --- anon and authenticated really are denied at runtime --------------------
CREATE FUNCTION pg_temp.assert_denied(p_role text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_sql text;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  FOREACH v_sql IN ARRAY ARRAY[
    'SELECT count(*) FROM public.newsletter_subscribers',
    'INSERT INTO public.newsletter_subscribers (email, consent_text) VALUES (''x@y.co'', ''c'')',
    'UPDATE public.newsletter_subscribers SET status = ''unsubscribed''',
    'DELETE FROM public.newsletter_subscribers',
    'SELECT count(*) FROM public.waitlist_rate_limits',
    'SELECT public.newsletter_subscribe(''a@b.co'', ''kkkkkkkkkkkkkkkk'', ''c'', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, repeat(''a'', 64))',
    'SELECT public.newsletter_confirm(repeat(''a'', 64))',
    'SELECT public.newsletter_unsubscribe(gen_random_uuid())',
    'SELECT * FROM public.newsletter_recipients()'
  ] LOOP
    BEGIN
      EXECUTE v_sql;
      RAISE EXCEPTION 'FAIL: % could run: %', p_role, v_sql;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  RESET ROLE;
END $$;

DO $$ BEGIN PERFORM pg_temp.assert_denied('anon'); END $$;
DO $$ BEGIN PERFORM pg_temp.assert_denied('authenticated'); END $$;
\echo 'ok: anon and authenticated denied at runtime'
DELETE FROM public.newsletter_subscribers;

-- --- Behaviour, as service_role -------------------------------------------
SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
  v_row public.newsletter_subscribers%ROWTYPE;
  v_id uuid;
  v_unsub uuid;
  c_consent text := 'Send me Covey''s weekly email of things to do in San Francisco. I can unsubscribe anytime.';
  h1 text := repeat('1', 64);
  h2 text := repeat('2', 64);
  h3 text := repeat('3', 64);
  h4 text := repeat('4', 64);
BEGIN
  -- created: normalized, pending, token + 7-day expiry, consent, attribution.
  v := public.newsletter_subscribe('  Mixed.Case@Example.COM ', 'client-key-000001', c_consent,
                                   'landing:home', 'instagram', 'social', 'weekly', NULL, NULL,
                                   'https://l.instagram.com/', '/', h1);
  IF v->>'result' <> 'created' OR v->>'id' IS NULL OR (v->>'resend')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: expected created, got %', v;
  END IF;
  v_id := (v->>'id')::uuid;
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE id = v_id;
  IF v_row.email <> 'mixed.case@example.com' OR v_row.status <> 'pending'
     OR v_row.source <> 'landing:home' OR v_row.utm_source <> 'instagram'
     OR v_row.consent_text <> c_consent OR v_row.consent_at IS NULL
     OR v_row.confirm_token_hash <> h1
     OR v_row.confirm_expires_at NOT BETWEEN now() + interval '7 days' - interval '1 minute'
                                         AND now() + interval '7 days' + interval '1 minute'
     OR v_row.confirmed_at IS NOT NULL OR v_row.unsubscribe_token IS NULL THEN
    RAISE EXCEPTION 'FAIL: row not stored as expected: %', row_to_json(v_row);
  END IF;
  v_unsub := v_row.unsubscribe_token;

  -- Not a recipient while pending.
  IF EXISTS (SELECT 1 FROM public.newsletter_recipients() r WHERE r.email = 'mixed.case@example.com') THEN
    RAISE EXCEPTION 'FAIL: pending address returned as a recipient';
  END IF;

  -- pending within the 2-minute cooldown: nothing changes, no resend.
  v := public.newsletter_subscribe('mixed.case@example.com', 'client-key-000002', 'other consent',
                                   'landing:footer', 'tiktok', NULL, NULL, NULL, NULL, NULL, NULL, h2);
  IF v->>'result' <> 'pending' OR (v->>'id')::uuid <> v_id OR (v->>'resend')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: expected throttled pending, got %', v;
  END IF;
  IF (SELECT confirm_token_hash FROM public.newsletter_subscribers WHERE id = v_id) <> h1 THEN
    RAISE EXCEPTION 'FAIL: throttled pending rotated the token';
  END IF;

  -- pending after the cooldown: token, expiry, and consent refreshed;
  -- attribution untouched (first touch wins).
  UPDATE public.newsletter_subscribers
    SET confirm_expires_at = now() + interval '6 days', consent_at = now() - interval '1 day'
    WHERE id = v_id;
  v := public.newsletter_subscribe('MIXED.case@example.com', 'client-key-000002', c_consent || ' ',
                                   'landing:footer', 'tiktok', NULL, NULL, NULL, NULL, NULL, NULL, h2);
  IF v->>'result' <> 'pending' OR (v->>'id')::uuid <> v_id OR (v->>'resend')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: expected pending with resend, got %', v;
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE id = v_id;
  IF v_row.confirm_token_hash <> h2 OR v_row.confirm_expires_at < now() + interval '7 days' - interval '1 minute'
     OR v_row.consent_at < now() - interval '1 minute' OR v_row.consent_text <> c_consent
     OR v_row.utm_source <> 'instagram' OR v_row.source <> 'landing:home' THEN
    RAISE EXCEPTION 'FAIL: pending refresh wrong: %', row_to_json(v_row);
  END IF;
  IF (SELECT count(*) FROM public.newsletter_subscribers) <> 1 THEN
    RAISE EXCEPTION 'FAIL: repeat signup created a second row';
  END IF;

  -- The superseded token no longer confirms.
  IF public.newsletter_confirm(h1)->>'result' <> 'invalid' THEN
    RAISE EXCEPTION 'FAIL: superseded token still valid';
  END IF;
  -- Unknown token.
  IF public.newsletter_confirm(h3)->>'result' <> 'invalid' THEN
    RAISE EXCEPTION 'FAIL: unknown token not invalid';
  END IF;

  -- confirmed, then already on a second click.
  v := public.newsletter_confirm(h2);
  IF v->>'result' <> 'confirmed' THEN
    RAISE EXCEPTION 'FAIL: expected confirmed, got %', v;
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE id = v_id;
  IF v_row.status <> 'subscribed' OR v_row.confirmed_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: confirm did not subscribe: %', row_to_json(v_row);
  END IF;
  IF public.newsletter_confirm(h2)->>'result' <> 'already' THEN
    RAISE EXCEPTION 'FAIL: second click should be already';
  END IF;

  -- subscribed: a repeat signup changes nothing and returns no id.
  v := public.newsletter_subscribe('mixed.case@example.com', 'client-key-000003', 'changed consent',
                                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h3);
  IF v->>'result' <> 'subscribed' OR v->>'id' IS NOT NULL OR (v->>'resend')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FAIL: expected subscribed, got %', v;
  END IF;
  IF (SELECT consent_text FROM public.newsletter_subscribers WHERE id = v_id) <> c_consent
     OR (SELECT status FROM public.newsletter_subscribers WHERE id = v_id) <> 'subscribed' THEN
    RAISE EXCEPTION 'FAIL: subscribed row was modified';
  END IF;

  -- Now a recipient.
  IF NOT EXISTS (SELECT 1 FROM public.newsletter_recipients() r
                 WHERE r.email = 'mixed.case@example.com' AND r.unsubscribe_token = v_unsub) THEN
    RAISE EXCEPTION 'FAIL: subscribed address missing from recipients';
  END IF;

  -- Unsubscribe: true, idempotent, keeps the first timestamp; unknown is false.
  IF NOT public.newsletter_unsubscribe(v_unsub) THEN
    RAISE EXCEPTION 'FAIL: unsubscribe returned false for a real token';
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE id = v_id;
  IF v_row.status <> 'unsubscribed' OR v_row.unsubscribed_at IS NULL OR v_row.confirm_token_hash IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: unsubscribe wrong: %', row_to_json(v_row);
  END IF;
  UPDATE public.newsletter_subscribers SET unsubscribed_at = now() - interval '1 hour' WHERE id = v_id;
  IF NOT public.newsletter_unsubscribe(v_unsub) THEN
    RAISE EXCEPTION 'FAIL: repeat unsubscribe returned false';
  END IF;
  IF (SELECT unsubscribed_at FROM public.newsletter_subscribers WHERE id = v_id) > now() - interval '59 minutes' THEN
    RAISE EXCEPTION 'FAIL: repeat unsubscribe overwrote unsubscribed_at';
  END IF;
  IF public.newsletter_unsubscribe(gen_random_uuid()) THEN
    RAISE EXCEPTION 'FAIL: unknown unsubscribe token returned true';
  END IF;
  IF EXISTS (SELECT 1 FROM public.newsletter_recipients() r WHERE r.email = 'mixed.case@example.com') THEN
    RAISE EXCEPTION 'FAIL: unsubscribed address returned as a recipient';
  END IF;
  -- The old confirmation link cannot re-subscribe someone who left.
  IF public.newsletter_confirm(h2)->>'result' <> 'invalid' THEN
    RAISE EXCEPTION 'FAIL: old confirm link worked after unsubscribe';
  END IF;

  -- resubscribe: back to pending, new token, fresh consent, history kept.
  v := public.newsletter_subscribe('mixed.case@example.com', 'client-key-000004', c_consent,
                                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h4);
  IF v->>'result' <> 'resubscribe' OR (v->>'id')::uuid <> v_id OR (v->>'resend')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: expected resubscribe, got %', v;
  END IF;
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE id = v_id;
  IF v_row.status <> 'pending' OR v_row.confirm_token_hash <> h4 OR v_row.unsubscribed_at IS NULL
     OR v_row.consent_at < now() - interval '1 minute' OR v_row.unsubscribe_token <> v_unsub THEN
    RAISE EXCEPTION 'FAIL: resubscribe wrong: %', row_to_json(v_row);
  END IF;
  IF EXISTS (SELECT 1 FROM public.newsletter_recipients() r WHERE r.email = 'mixed.case@example.com') THEN
    RAISE EXCEPTION 'FAIL: resubscribed-but-unconfirmed address returned as a recipient';
  END IF;

  -- Expired token is invalid and leaves the row pending.
  UPDATE public.newsletter_subscribers SET confirm_expires_at = now() - interval '1 second' WHERE id = v_id;
  IF public.newsletter_confirm(h4)->>'result' <> 'invalid' THEN
    RAISE EXCEPTION 'FAIL: expired token confirmed';
  END IF;
  IF (SELECT status FROM public.newsletter_subscribers WHERE id = v_id) <> 'pending' THEN
    RAISE EXCEPTION 'FAIL: expired token changed status';
  END IF;

  -- Bad input is 22023 (invalid_parameter_value), never a silent insert.
  BEGIN
    PERFORM public.newsletter_subscribe('not-an-email', 'client-key-000005', c_consent,
                                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h3);
    RAISE EXCEPTION 'FAIL: invalid email accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_subscribe('prize<victim@example.com>', 'client-key-000005', c_consent,
                                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h3);
    RAISE EXCEPTION 'FAIL: display-name style address accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_subscribe('ok@example.com', 'client-key-000005', '   ',
                                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h3);
    RAISE EXCEPTION 'FAIL: blank consent accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_subscribe('ok@example.com', 'client-key-000005', repeat('x', 501),
                                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h3);
    RAISE EXCEPTION 'FAIL: 501-char consent accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_subscribe('ok@example.com', 'client-key-000005', c_consent,
                                        NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'not-a-hash');
    RAISE EXCEPTION 'FAIL: malformed token hash accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_subscribe('ok@example.com', 'client-key-000005', c_consent);
    RAISE EXCEPTION 'FAIL: missing token hash accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_confirm('ZZZ');
    RAISE EXCEPTION 'FAIL: malformed confirm hash accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.newsletter_unsubscribe(NULL);
    RAISE EXCEPTION 'FAIL: null unsubscribe token accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.newsletter_subscribers WHERE email = 'ok@example.com') THEN
    RAISE EXCEPTION 'FAIL: a rejected call inserted a row';
  END IF;

  RAISE NOTICE 'ok: behaviour';
END $$;

-- Rate limit: the 9th attempt in a window from one client is refused.
DO $$
DECLARE
  v jsonb;
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    v := public.newsletter_subscribe(format('rl%s@example.com', i), 'client-key-ratelimit', 'consent',
                                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, md5(i::text) || md5(i::text));
    IF v->>'result' <> 'created' THEN
      RAISE EXCEPTION 'FAIL: attempt % should pass, got %', i, v;
    END IF;
  END LOOP;
  v := public.newsletter_subscribe('rl9@example.com', 'client-key-ratelimit', 'consent',
                                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, repeat('9', 64));
  IF v->>'result' <> 'rate_limited' THEN
    RAISE EXCEPTION 'FAIL: 9th attempt should be rate_limited, got %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.newsletter_subscribers WHERE email = 'rl9@example.com') THEN
    RAISE EXCEPTION 'FAIL: rate-limited attempt still inserted';
  END IF;
  -- A different client key is unaffected.
  v := public.newsletter_subscribe('rl9@example.com', 'client-key-other-01', 'consent',
                                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, repeat('9', 64));
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: other client should pass, got %', v;
  END IF;
  RAISE NOTICE 'ok: rate limit';
END $$;

-- Waitlist and newsletter are independent: same address in both, neither
-- call touches the other's table.
DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.waitlist_join('both@example.com', 'client-key-both-0001');
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: waitlist join failed: %', v;
  END IF;
  IF EXISTS (SELECT 1 FROM public.newsletter_subscribers WHERE email = 'both@example.com') THEN
    RAISE EXCEPTION 'FAIL: joining the waitlist created a newsletter row';
  END IF;
  v := public.newsletter_subscribe('both@example.com', 'client-key-both-0001', 'consent',
                                   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, repeat('b', 64));
  IF v->>'result' <> 'created' THEN
    RAISE EXCEPTION 'FAIL: newsletter subscribe for a waitlisted address should be created, got %', v;
  END IF;
  IF (SELECT count(*) FROM public.waitlist_signups WHERE email = 'both@example.com') <> 1 THEN
    RAISE EXCEPTION 'FAIL: subscribing touched waitlist_signups';
  END IF;
  PERFORM public.newsletter_unsubscribe(
    (SELECT unsubscribe_token FROM public.newsletter_subscribers WHERE email = 'both@example.com'));
  IF (SELECT status FROM public.waitlist_signups WHERE email = 'both@example.com') <> 'waiting' THEN
    RAISE EXCEPTION 'FAIL: unsubscribing changed the waitlist row';
  END IF;
  RAISE NOTICE 'ok: independent of waitlist';
END $$;
RESET ROLE;

-- Stale rate-limit keys are pruned by a newsletter signup too.
INSERT INTO public.waitlist_rate_limits (client_key, window_started_at)
  VALUES ('client-key-stale-0001', now() - interval '25 hours');
SET ROLE service_role;
DO $$ BEGIN
  PERFORM public.newsletter_subscribe('prune@example.com', 'client-key-prune-001', 'consent',
                                      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, repeat('e', 64));
END $$;
RESET ROLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.waitlist_rate_limits WHERE client_key = 'client-key-stale-0001') THEN
    RAISE EXCEPTION 'FAIL: stale rate-limit key survived a newsletter signup';
  END IF;
  RAISE NOTICE 'ok: pruning';
END $$;

-- Hand-written rows cannot bypass normalization, the vocabulary, or the
-- status invariants; the trigger stamps what a manual UPDATE forgets.
DO $$
DECLARE
  v_row public.newsletter_subscribers%ROWTYPE;
BEGIN
  BEGIN
    INSERT INTO public.newsletter_subscribers (email, consent_text) VALUES ('Upper@Example.com', 'c');
    RAISE EXCEPTION 'FAIL: un-normalized email inserted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.newsletter_subscribers (email) VALUES ('noconsent@example.com');
    RAISE EXCEPTION 'FAIL: row without consent_text inserted';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.newsletter_subscribers (email, consent_text) VALUES ('"x"<v@example.com>', 'c');
    RAISE EXCEPTION 'FAIL: unsafe-character email inserted by hand';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.newsletter_subscribers SET status = 'vip';
    RAISE EXCEPTION 'FAIL: unknown status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.newsletter_subscribers SET confirm_token_hash = 'nope', confirm_expires_at = now();
    RAISE EXCEPTION 'FAIL: malformed token hash accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.newsletter_subscribers SET status = 'unsubscribed' WHERE email = 'prune@example.com';
  SELECT * INTO v_row FROM public.newsletter_subscribers WHERE email = 'prune@example.com';
  IF v_row.unsubscribed_at IS NULL OR v_row.confirm_token_hash IS NOT NULL OR v_row.updated_at < v_row.created_at THEN
    RAISE EXCEPTION 'FAIL: trigger did not stamp a manual unsubscribe: %', row_to_json(v_row);
  END IF;
  RAISE NOTICE 'ok: constraints';
END $$;

\echo 'newsletter_subscribers: all checks passed'

-- Backfill behaviour of db/migrations/20261015120000_waitlist_hardening.sql
-- against a table that already has signups, including two that fold to the
-- same mailbox. Proves: no row is deleted or rewritten, the oldest row keeps
-- the canonical key, the newer one is left with NULL (reported, reviewable),
-- the unique index builds, and the migration can be re-run.

\set ON_ERROR_STOP 1

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
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

\i db/migrations/20261014120000_waitlist_signups.sql

-- Production-shaped history written under the first migration only.
INSERT INTO public.waitlist_signups (email, source, utm_source, city, created_at) VALUES
  ('a.b@gmail.com',          'landing:page', 'instagram', 'davis', now() - interval '3 days'),  -- oldest: keeps the key
  ('ab+later@googlemail.com', 'landing:page', 'tiktok',    NULL,    now() - interval '2 days'),  -- same mailbox, newer
  ('ab@gmail.com',           'landing:nojs', NULL,        NULL,    now() - interval '1 day'),   -- same mailbox, newest
  ('solo+tag@example.com',   'landing:page', NULL,        NULL,    now() - interval '1 day'),
  ('other@example.com',      'landing:page', NULL,        NULL,    now() - interval '1 hour');
-- A hand-written row already 'invited' with no stamp, and history timestamps.
INSERT INTO public.waitlist_signups (email, status, created_at, updated_at) VALUES
  ('handmade@example.com', 'invited', now() - interval '5 days', now() - interval '5 days');
ALTER TABLE public.waitlist_signups DISABLE TRIGGER waitlist_signups_touch;
UPDATE public.waitlist_signups SET updated_at = created_at;
ALTER TABLE public.waitlist_signups ENABLE TRIGGER waitlist_signups_touch;

\i db/migrations/20261015120000_waitlist_hardening.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM public.waitlist_signups) <> 6 THEN
    RAISE EXCEPTION 'FAIL: backfill deleted a row';
  END IF;
  IF EXISTS (SELECT 1 FROM public.waitlist_signups WHERE updated_at <> created_at) THEN
    RAISE EXCEPTION 'FAIL: backfill rewrote updated_at';
  END IF;
  IF (SELECT invited_at FROM public.waitlist_signups WHERE email = 'handmade@example.com') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: backfill stamped invited_at on a hand-written row';
  END IF;
  IF NOT (SELECT tgenabled = 'O' FROM pg_trigger WHERE tgname = 'waitlist_signups_touch') THEN
    RAISE EXCEPTION 'FAIL: touch trigger left disabled';
  END IF;
  IF (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'a.b@gmail.com') IS DISTINCT FROM 'ab@gmail.com' THEN
    RAISE EXCEPTION 'FAIL: oldest row did not keep the canonical key';
  END IF;
  IF (SELECT count(*) FROM public.waitlist_signups
       WHERE email IN ('ab+later@googlemail.com', 'ab@gmail.com') AND email_canonical IS NULL) <> 2 THEN
    RAISE EXCEPTION 'FAIL: newer duplicates should be left with a NULL key';
  END IF;
  IF (SELECT utm_source FROM public.waitlist_signups WHERE email = 'ab+later@googlemail.com') <> 'tiktok' THEN
    RAISE EXCEPTION 'FAIL: backfill rewrote a duplicate''s data';
  END IF;
  IF (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'solo+tag@example.com') IS DISTINCT FROM 'solo@example.com'
     OR (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'other@example.com') IS DISTINCT FROM 'other@example.com' THEN
    RAISE EXCEPTION 'FAIL: unique rows were not backfilled';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'waitlist_signups_email_canonical_key'
                 AND indexdef LIKE 'CREATE UNIQUE INDEX%') THEN
    RAISE EXCEPTION 'FAIL: unique canonical index missing';
  END IF;
  RAISE NOTICE 'ok: backfill keeps the oldest, deletes nothing';
END $$;

-- An ordinary status update on a legacy duplicate still works (the trigger
-- only re-keys when email or the key is written).
UPDATE public.waitlist_signups SET status = 'invited' WHERE email = 'ab@gmail.com';

-- Re-running the whole migration is a no-op.
\i db/migrations/20261015120000_waitlist_hardening.sql

DO $$
BEGIN
  IF (SELECT count(*) FROM public.waitlist_signups) <> 6
     OR (SELECT count(*) FROM public.waitlist_signups WHERE email_canonical IS NULL) <> 2
     OR (SELECT email_canonical FROM public.waitlist_signups WHERE email = 'a.b@gmail.com') <> 'ab@gmail.com' THEN
    RAISE EXCEPTION 'FAIL: re-run changed the backfill';
  END IF;
  RAISE NOTICE 'ok: re-run is a no-op';
END $$;

-- After the migration, every variant of that mailbox is "existing", and the
-- oldest row's attribution and city are untouched.
SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.waitlist_join('A.B+again@gmail.com', 'client-key-backfill-01');
  IF v->>'result' <> 'existing' THEN
    RAISE EXCEPTION 'FAIL: variant of a backfilled mailbox should be existing, got %', v;
  END IF;
  -- Exact match on a legacy NULL-key row is still caught (by the email index).
  v := public.waitlist_join('ab+later@googlemail.com', 'client-key-backfill-02');
  IF v->>'result' <> 'existing' THEN
    RAISE EXCEPTION 'FAIL: exact legacy duplicate should be existing, got %', v;
  END IF;
  v := public.waitlist_join('solo@example.com', 'client-key-backfill-03');
  IF v->>'result' <> 'existing' THEN
    RAISE EXCEPTION 'FAIL: untagged form of a backfilled plus address should be existing, got %', v;
  END IF;
  IF (SELECT city FROM public.waitlist_signups WHERE email = 'a.b@gmail.com') <> 'davis' THEN
    RAISE EXCEPTION 'FAIL: oldest row was modified';
  END IF;
  RAISE NOTICE 'ok: post-backfill dedupe';
END $$;
RESET ROLE;

-- If the keyed (oldest) row is deleted, a legacy exact duplicate still
-- answers "existing" instead of erroring, even though its key is free.
DELETE FROM public.waitlist_signups WHERE email = 'a.b@gmail.com';
SET ROLE service_role;
DO $$
DECLARE
  v jsonb;
BEGIN
  v := public.waitlist_join('ab@gmail.com', 'client-key-backfill-04');
  IF v->>'result' <> 'existing' THEN
    RAISE EXCEPTION 'FAIL: exact legacy duplicate with a free key should be existing, got %', v;
  END IF;
  RAISE NOTICE 'ok: no unique_violation leaks';
END $$;
RESET ROLE;

\echo 'waitlist_hardening: all checks passed'

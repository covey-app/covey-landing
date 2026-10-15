#!/bin/sh
# Apply the landing-site migrations to a throwaway Postgres (Docker) and run
# every db/tests/*.test.sql file, each against its own fresh database. Nothing
# touches a real Supabase project.
set -eu
cd "$(dirname "$0")/.."
NAME=covey-waitlist-db-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -v "$PWD/db:/work/db:ro" -w /work postgres:17-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
i=0
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -gt 30 ] && { echo "postgres did not start" >&2; exit 1; }
  sleep 1
done
sleep 1

failed=""
for file in db/tests/*.test.sql; do
  db="test_$(basename "$file" .test.sql)"
  echo "== $file (database $db)"
  docker exec "$NAME" createdb -U postgres "$db"
  if ! docker exec -w /work "$NAME" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q -f "$file"; then
    failed="$failed $file"
  fi
done

if [ -n "$failed" ]; then
  echo "FAILED:$failed" >&2
  exit 1
fi
echo "all database tests passed"

#!/usr/bin/env bash
# Prova la migració en una base de dades temporal.
# Necessita PGHOST, PGPORT i PGUSER d'un Postgres local.
set -euo pipefail

cd "$(dirname "$0")/../.."
db="family_test_$$"

createdb "$db"
# La neteja no ha d'amagar si alguna comprovació ha fallat.
cleanup() {
  local status=$?
  dropdb --if-exists "$db"
  psql -q -d postgres -c "drop role if exists anon, authenticated, service_role"
  exit "$status"
}
trap cleanup EXIT

psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop role if exists anon, authenticated, service_role"
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/rls/setup.sql
for migration in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$migration"
done
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/rls/checks.sql

#!/usr/bin/env bash
# Prova la migració en una base de dades temporal.
# Necessita PGHOST, PGPORT i PGUSER d'un Postgres local.
set -euo pipefail

cd "$(dirname "$0")/../.."
db="family_test_$$"

createdb "$db"
trap 'dropdb --if-exists "$db"; psql -q -d postgres -c "drop role if exists anon, authenticated, service_role"' EXIT

psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop role if exists anon, authenticated, service_role"
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/rls/setup.sql
psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/migrations/001_family_schema.sql
psql -q -v ON_ERROR_STOP=1 -d "$db" -f tests/rls/checks.sql

#!/usr/bin/env bash
# Runs the SQL test suite against a throwaway local Postgres.
# Usage: PGHOST=/tmp/kidsmarket-pg PGPORT=54329 tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -U ${PGUSER:-postgres} -v ON_ERROR_STOP=1 -q"
$P -c 'drop database if exists kidsmarket_test' -c 'create database kidsmarket_test'
$P -d kidsmarket_test -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do $P -d kidsmarket_test -f "$f"; done
$P -d kidsmarket_test -f tests/01_flow_test.sql

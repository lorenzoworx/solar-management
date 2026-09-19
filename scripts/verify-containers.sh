#!/usr/bin/env bash
set -euo pipefail
env_file="${1:-.env.production}"
project="${2:-solar-management}"
compose() { docker compose --env-file "$env_file" -p "$project" "$@"; }
ready_url="http://$(compose port app 3001)/api/ready"
wait_for_app() {
  for attempt in $(seq 1 30); do
    if curl --silent --fail "$ready_url" > /dev/null; then return; fi
    sleep 2
  done
  echo 'Application did not become ready.' >&2
  exit 1
}
count_readings() { compose exec -T db psql -U solar_app -d "$1" -Atc 'SELECT count(*) FROM readings'; }

wait_for_app
before="$(count_readings solar_management)"
test "$before" -gt 0
compose restart db app
wait_for_app
test "$(count_readings solar_management)" = "$before"
echo 'Application and database restart preserved readings.'

dump_file="$(mktemp)"
restore_database="sm_restore_check_$(date +%s)"
restore_created=0
cleanup() {
  if [[ "$restore_created" = '1' ]]; then compose exec -T db dropdb -U solar_app "$restore_database"; fi
  rm -f "$dump_file"
}
trap cleanup EXIT
compose exec -T db pg_dump -U solar_app -d solar_management -Fc > "$dump_file"
compose exec -T db createdb -U solar_app "$restore_database"
restore_created=1
compose exec -T db pg_restore -U solar_app -d "$restore_database" --exit-on-error --no-owner < "$dump_file"
test "$(count_readings "$restore_database")" = "$before"
echo 'Backup restored successfully into a separate verification database.'

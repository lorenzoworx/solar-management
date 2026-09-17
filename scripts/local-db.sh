#!/usr/bin/env bash
set -euo pipefail

# A project-owned cluster, independent of any system PostgreSQL service.
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
data_dir="$project_dir/.local/postgres"
socket_dir="$project_dir/.local/socket"
pg_bin="${PG_BIN:-$(pg_config --bindir)}"
if [[ "$("$pg_bin/postgres" --version)" != *' 18.'* ]]; then
  echo 'PostgreSQL 18 is required. Set PG_BIN to its bin directory.' >&2
  exit 1
fi

case "${1:-start}" in
  start)
    mkdir -p "$socket_dir"
    if [[ ! -f "$data_dir/PG_VERSION" ]]; then
      "$pg_bin/initdb" -D "$data_dir" -U solar_dev -A trust --no-locale --encoding=UTF8 > "$project_dir/.local/initdb.log"
    fi
    if ! "$pg_bin/pg_ctl" -D "$data_dir" status > /dev/null 2>&1; then
      "$pg_bin/pg_ctl" -D "$data_dir" -l "$project_dir/.local/postgres.log" \
        -o "-h 127.0.0.1 -p 55432 -k '$socket_dir'" -w start
    fi
    for database in solar_management_dev solar_management_test; do
      exists="$("$pg_bin/psql" -h 127.0.0.1 -p 55432 -U solar_dev -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$database'")"
      if [[ "$exists" != '1' ]]; then
        "$pg_bin/createdb" -h 127.0.0.1 -p 55432 -U solar_dev "$database"
      fi
    done
    echo 'Local development and test databases ready on 127.0.0.1:55432.'
    ;;
  stop) "$pg_bin/pg_ctl" -D "$data_dir" -m fast -w stop ;;
  status) "$pg_bin/pg_ctl" -D "$data_dir" status ;;
  *) echo 'Usage: bash scripts/local-db.sh [start|stop|status]' >&2; exit 1 ;;
esac

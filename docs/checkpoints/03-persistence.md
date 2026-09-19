# Checkpoint 3: stored installations

Three fictional installations now come from PostgreSQL. The browser receives only sites marked `is_demo = true`; this checkpoint exposes no write endpoints. Accounts, ownership foreign keys, and readings come later.

## Follow one request

`DemoSites.tsx` → `GET /api/demo/sites` → `demoSitesRouter` → shared connection pool → `sites` table → JSON → runtime validation → React cards.

The SQL in `server/src/features/sites/sites.ts` uses `$1` with `[true]`. PostgreSQL receives the SQL and parameter separately. That keeps values out of the SQL syntax. The server chooses the demo filter; changing a browser query parameter cannot bypass it. See [parameterized queries](https://node-postgres.com/features/queries).

The pool reuses database connections across requests. `pool.query` borrows and returns a connection for a single statement. The seed explicitly borrows one connection for `BEGIN`, inserts, and `COMMIT`, releasing it in `finally`. All statements in a transaction must use that same connection. See [pooling](https://node-postgres.com/features/pooling) and [transactions](https://node-postgres.com/features/transactions).

## What the database owns

| Item | Purpose |
| --- | --- |
| `sites.id` | UUID primary key: stable identity even after a rename |
| `name`, `location` | Required text with length constraints |
| `capacity_kw` | Positive rated capacity; SQL converts its decimal value to a JSON number |
| `is_demo` | Explicitly marks fictional public samples; defaults to false |
| `created_at` | A timestamp with time zone, stored as an instant |
| `pgmigrations` | Records which schema migrations have already run |

The versioned migration creates the table. The seed inserts reproducible sample rows, using fixed IDs and `ON CONFLICT` so rerunning it does not add duplicates. It restores sample names/capacities and leaves non-demo records alone. Migrations use [node-pg-migrate](https://salsita.github.io/node-pg-migrate/api); future schema changes get new files rather than edits to an applied migration.

TanStack Query tracks loading, cached data, errors, and retries for the installation list. The original health check stays separate: a reachable API can still have a failed database connection. A failed database read returns HTTP 503, never a successful empty list or raw SQL error.

## Learning tasks

The SQL exercise and questions have moved to the local, Git-ignored `questions.md` file. Review can happen after implementation.

## Verification and limits

The automated checks cover real PostgreSQL migrations and queries, repeated seeds, non-demo exclusion, rejected demo writes, invalid capacities, unavailable databases, response validation, loading/empty/error/retry states, and browser reloads at desktop/mobile widths. Tests clear only the explicitly named `solar_management_test` database; they never default to the development URL. This checkpoint passed 39 unit/API/UI tests and four browser tests. The compiled application also rendered all three sites after stopping and restarting the local PostgreSQL cluster.

This is installation metadata only. No monitoring measurements or energy estimates are claimed. Learning review for this checkpoint remains pending.

# Deployment and recovery

The application is prepared for PostgreSQL 18 and a Node 24 container on the Mac mini. **The public deployment is not complete:** its SSH connection, hostname, and existing Cloudflare Tunnel configuration are still needed in [questions.md](../questions.md). Docker is not installed on the current development MacBook; container verification runs in GitHub Actions.

## First deployment

On the Mac mini, with Docker Compose available, clone this repository and create `.env.production` from `.env.production.example`. Set:

- `DATABASE_PASSWORD`: a new 64-character hexadecimal password from `openssl rand -hex 32`.
- `APP_ORIGIN`: the exact public HTTPS origin, such as `https://solar.your-domain.example`, without a trailing slash.
- `APP_IMAGE`: a unique local image tag for the checked-out commit, such as `solar-management:<commit-sha>`.
- `APP_PORT`: an unused loopback port, default 3001.
- `TRUST_PROXY`: the known count of private proxy hops, usually 1 for a direct tunnel connector. Confirm the actual topology before setting it.

Keep that file private and out of Git. Then run from the repository:

```sh
docker compose --env-file .env.production -p solar-management build app
docker compose --env-file .env.production -p solar-management up -d --wait app
docker compose --env-file .env.production -p solar-management run --rm migrate node server/dist/db/command.js seed
```

Startup waits for PostgreSQL to become healthy and for the migration job to exit successfully. The app runs as the unprivileged `node` OS user. PostgreSQL publishes no host port. Its data persists in the project's `postgres_data` volume, mounted at `/var/lib/postgresql` for the PostgreSQL 18 image. See [Compose startup ordering](https://docs.docker.com/compose/how-tos/startup-order/) and the [PostgreSQL image documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md).

The database role currently owns the schema for both migrations and application queries. Splitting migration and runtime privileges is a future hardening step. Authentication rate limits currently assume one application instance.

## Cloudflare Tunnel

For a tunnel connector running directly on the Mac mini, route the selected hostname to `http://127.0.0.1:3001` (or `APP_PORT`). If the existing connector runs in Docker, attach it to the application's web network and use `http://app:3001`; its actual network name depends on the Compose project, normally `solar-management_web`. Do not attach it to the private database network. Preserve the tunnel's other routes.

The public request must reach the app with the trusted `X-Forwarded-Proto: https` header. `APP_ORIGIN` must match the hostname visitors use. Production requires HTTPS and sets Secure, HTTP-only, host-only session cookies. See [Cloudflare application routing](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/).

The existing connector's persistent network configuration must be updated in its own deployment configuration; an ad-hoc `docker network connect` alone would not survive connector recreation. That change remains pending until the actual tunnel topology is known.

## Health and logs

```sh
docker compose --env-file .env.production -p solar-management ps
docker compose --env-file .env.production -p solar-management logs --tail=100 app migrate db
curl --fail http://127.0.0.1:3001/api/ready
```

`/api/health` tests the HTTP process. `/api/ready` also verifies database connectivity and required schema tables/columns. Containers use readiness for their health check. A migration failure prevents app startup; a later database failure produces safe 503 responses and failed readiness while the HTTP process remains reachable.

## Back up and verify recovery

Create a private backup before deploying a new image:

```sh
umask 077
mkdir -p backups
docker compose --env-file .env.production -p solar-management exec -T db \
  pg_dump -U solar_app -d solar_management -Fc > "backups/solar-$(date +%Y%m%d-%H%M%S).dump"
```

Keep a separate copy off the Mac mini. Database dumps contain account hashes and session records; they are ignored by Git.

During a maintenance window with simulators stopped, run:

```sh
bash scripts/verify-containers.sh .env.production solar-management
```

This checks that readings survive application/database restarts, takes a fresh dump, restores it into a newly created verification database, compares the reading count, and removes only that temporary database and dump. It does not overwrite the application's database. Run it after seeding so there are readings to verify.

For an actual recovery, restore the chosen backup into a new database using `createdb` and `pg_restore --exit-on-error --no-owner`, inspect it, stop the app, and update its connection to that database. Do not restore over an active application's database. Review sessions after a disaster restore: deleting restored session rows forces users to sign in again and avoids reactivating sessions revoked after the backup was taken.

## Update and rollback

Record the running image tag and take a backup. Build the new commit under a new `APP_IMAGE` tag. Run its migration job explicitly, then replace the application:

```sh
docker compose --env-file .env.production -p solar-management build app
docker compose --env-file .env.production -p solar-management run --rm migrate
docker compose --env-file .env.production -p solar-management up -d --no-deps --wait app
```

For a compatible application rollback, restore the previous `APP_IMAGE` value in `.env.production`, then run `up -d --no-deps --wait app` without rebuilding. Keep previous images until the new release is verified. Never automatically reverse a schema migration or delete the PostgreSQL volume to roll back application code. An incompatible schema change needs a planned data restore or forward fix.

Public HTTPS, persistent login after restart, backup recovery on the Mac mini, and rollback to an actual preceding release remain release-gate checks in `questions.md`. No verified-release tag is created before those checks pass.

## CI deployment checks

Verified for commit `efa2cc4ec36b45ca6f2f48d16d8bca6229ef5c85` in [GitHub Actions run 35424571307](https://github.com/lorenzoworx/solar-management/actions/runs/35424571307): lint, type checking, production builds, 77 unit/API/UI tests, eight development browser scenarios, and nine production HTTPS/recovery scenarios passed. Container startup, restart persistence, backup restoration, safe database-outage responses, and authenticated rollback to the preceding compatible revision all passed.

GitHub Actions builds the production image, starts Compose with its real migration dependency, seeds data, checks restart persistence, and restores a backup into a separate database. It then runs the browser scenarios through a local HTTPS proxy using an ephemeral self-signed certificate. Certificate validation is bypassed only for that local CI proxy; the public deployment must use normal trusted HTTPS. These checks do not prove that the Mac mini's tunnel and public DNS are configured correctly.

The `container-recovery` browser project runs after the ordinary browser scenarios, so restarting containers cannot interrupt another test. It registers an account, saves an owned installation and reading, and triggers an alert. It then stops PostgreSQL to check safe 503 responses and readiness failure, restarts PostgreSQL and the application, and checks the same session, site, reading, and alert. Finally, it deploys the preceding verified revision `3e3798097bffe54d89bed18343f1730fe7f524d3`, verifies the saved state, returns to the current image, and checks deletion and logout. It inspects the running container's image tag to confirm each replacement happened. See [Playwright project dependencies](https://playwright.dev/docs/test-projects#dependencies).

These disruptive tests are restricted to the disposable `sm-ci` Compose project and CI image names. They are not a command to run against the Mac mini. The pinned baseline shares the current database schema; when migrations change, review compatibility and update the baseline deliberately. This rehearsal does not establish that an arbitrary old application is compatible with a newer schema, or replace the first public deployment's recovery checks.

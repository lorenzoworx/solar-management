# Deployment and recovery

The public demo is available at [boywithabot.com/projects/solar-management/](https://boywithabot.com/projects/solar-management/). The application uses PostgreSQL 18 and a Node 24 container. **Release verification is incomplete:** public registration currently fails its HTTPS check; server access and the actual proxy configuration are still needed in the local, Git-ignored `questions.md` file. Docker is not installed on the current development MacBook; container verification runs in GitHub Actions.

## Public verification

On September 19, 2026, seven public browser scenarios passed with normal HTTPS certificate validation: API connectivity, retry states, demo access, desktop/mobile layouts, monitoring, direct page reloads, and date filtering. `/projects/solar-management/api/ready` returned 200. The session cookie has Secure, HTTP-only, SameSite=Lax, and Path=/ settings. Readings remain clearly labeled as simulated and historical.

The registration scenario failed with HTTP 403 and **“HTTPS is required.”** No verification account was created. This is a release blocker for account writes. Cloudflare and Caddy appear in the response headers; the exact private proxy chain has not been inspected. A lost `X-Forwarded-Proto: https` header or an incorrect Express trust setting is the working diagnosis, not a confirmed configuration finding. The browser's HTTPS URL alone does not establish what protocol Express sees after proxies.

Inspect the connector-to-Caddy-to-app path and the deployed `TRUST_PROXY`. Caddy ignores incoming forwarded headers by default; when an authenticated/private tunnel connector precedes it, configure Caddy's `servers > trusted_proxies` for that connector's actual IP/CIDR so the original HTTPS scheme is preserved. Review the real path before choosing Express's hop count. Validate and reload the existing Caddy configuration while preserving the portfolio's other routes. Keep the application's HTTPS check enabled. See [Caddy forwarded-header behavior](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults) and [Express proxy settings](https://expressjs.com/en/guide/behind-proxies/).

After the proxy correction, run `npm run test:live`. It reuses the eight application browser scenarios, creates one test account, deletes that account's test installation, and logs out. Account deletion is not implemented, so a successful run leaves an empty verification account with a random password. It performs no database reset, restart, or rollback. Rehearse recovery on the actual host separately before tagging a verified release.

## Hosting beneath a URL path

For the portfolio deployment, use these non-secret settings:

```dotenv
APP_ORIGIN=https://boywithabot.com
APP_BASE_PATH=/projects/solar-management/
```

`APP_ORIGIN` is an origin, without the path. `APP_BASE_PATH` includes the leading and trailing slash and is compiled into the frontend. Rebuild the image after changing it. Vite assets, the React Router basename, and frontend API requests all use that prefix; the API inside the container still serves `/api`.

The reverse proxy must strip `/projects/solar-management` before forwarding to this application's container, including API, assets, and direct page loads. In an existing Caddy site block, the route shape is `handle_path /projects/solar-management/* { reverse_proxy <actual-private-app-address> }`; add a redirect from the slashless path to its trailing-slash form. Substitute the real upstream and merge this route into the existing configuration. This path rule does not replace the trusted-proxy configuration above. See [Vite public base paths](https://vite.dev/guide/build.html#public-base-path).

The live site already had subpath adjustments when inspected, while commit `8cd73ac` in GitHub still assumed `/`. The repository now makes that build setting explicit. The deployed checkout/revision must be identified before updating it; a source push alone does not establish that the live build changed.

## First deployment

On the Mac mini, with Docker Compose available, clone this repository and create `.env.production` from `.env.production.example`. Set:

- `DATABASE_PASSWORD`: a new 64-character hexadecimal password from `openssl rand -hex 32`.
- `APP_ORIGIN`: the exact public HTTPS origin, such as `https://solar.your-domain.example`, without a trailing slash.
- `APP_BASE_PATH`: `/` for a dedicated hostname, or `/projects/solar-management/` for the portfolio route. This is a build setting.
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

Public demo HTTPS is verified. Public account writes, persistent login after restart, backup recovery on the Mac mini, and rollback to an actual preceding release remain release-gate checks in `questions.md`. No verified-release tag is created before those checks pass.

## CI deployment checks

Verified for commit `dd464e9694c403910c407ccb6c4590a5f5c009b5` in [GitHub Actions run 35453359736](https://github.com/lorenzoworx/solar-management/actions/runs/35453359736): lint, type checking, production builds, 77 unit/API/UI tests, eight development browser scenarios, nine production HTTPS/recovery scenarios at `/`, and eight production browser scenarios at `/projects/solar-management/` passed. Container startup, restart persistence, backup restoration, safe database-outage responses, and authenticated rollback to the preceding compatible revision all passed. Public registration remains a separate proxy configuration failure as recorded above.

GitHub Actions builds the production image, starts Compose with its real migration dependency, seeds data, checks restart persistence, and restores a backup into a separate database. It then runs the browser scenarios through a local HTTPS proxy using an ephemeral self-signed certificate. Certificate validation is bypassed only for that local CI proxy; the public deployment must use normal trusted HTTPS. These checks do not prove that the Mac mini's tunnel and public DNS are configured correctly.

The `container-recovery` browser project runs after the ordinary browser scenarios, so restarting containers cannot interrupt another test. It registers an account, saves an owned installation and reading, and triggers an alert. It then stops PostgreSQL to check safe 503 responses and readiness failure, restarts PostgreSQL and the application, and checks the same session, site, reading, and alert. Finally, it deploys the preceding verified revision `3e3798097bffe54d89bed18343f1730fe7f524d3`, verifies the saved state, returns to the current image, and checks deletion and logout. It inspects the running container's image tag to confirm each replacement happened. See [Playwright project dependencies](https://playwright.dev/docs/test-projects#dependencies).

These disruptive tests are restricted to the disposable `sm-ci` Compose project and CI image names. They are not a command to run against the Mac mini. The pinned baseline shares the current database schema; when migrations change, review compatibility and update the baseline deliberately. This rehearsal does not establish that an arbitrary old application is compatible with a newer schema, or replace the first public deployment's recovery checks.

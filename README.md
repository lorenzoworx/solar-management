# Solar Management

A solar monitoring project being rebuilt in small, tested stages to develop and demonstrate full-stack engineering skills.

The starting point is an AI-assisted JavaScript prototype called Solar Dashboard. This repository records a new implementation and the reasoning behind it, beginning with an examination of the prototype.

## Current status

**Checkpoint 3: PostgreSQL persistence implemented; learning review pending.**

The React page displays three fictional installations stored in PostgreSQL through a read-only demo API. It validates responses and handles loading, empty lists, failures, and retries. One Node process serves the frontend and API in production. Accounts, readings, and public deployment are still planned.

## Run locally

Use Node 24, npm 11 or newer, and PostgreSQL 18. If you use nvm, run `nvm use` first. On macOS, PostgreSQL is available through `brew install postgresql@18`; make its binaries available in your PATH.

```sh
npm ci
cp .env.example .env
npm run db:local:start
npm run db:migrate
npm run db:seed
npm run dev
```

Open [the development app](http://127.0.0.1:5175). The API listens on port 3001; Vite forwards the browser's `/api` requests to it. Port 5175 avoids the other local project already using 5173. Both servers bind to loopback by default.

`npm run dev` starts two servers and a shared-code compiler watcher. Stop them together with Ctrl+C. To run them in separate terminals for debugging, use `npm run dev:api` and `npm run dev:web`; rebuild shared code with `npm run build:shared` if you edit it in that mode.

If API port 3001 is occupied, run `API_PORT=3002 npm run dev`; both the API and proxy will use that value. Keep API port overrides in the shell so both processes receive them.

The local database script uses `pg_config --bindir` (or your `PG_BIN` override). It creates a project-owned cluster in ignored `.local/postgres` on loopback port 55432, with separate `solar_management_dev` and `solar_management_test` databases. It does not start or modify a system PostgreSQL service. The local cluster uses passwordless trust authentication for local development only. Deployment will use private container networking and credentials.

`npm run db:local:stop` stops this cluster; starting it again preserves data. Ctrl+C on the app does not stop PostgreSQL. Logs are in `.local/postgres.log`. Rerun the seed to restore sample values without duplicating their IDs. Existing `.env` files should be edited rather than overwritten. On another PostgreSQL installation, create separate development/test databases and set their URLs in `.env` instead of using the local cluster script.

To try the production build locally:

```sh
npm run build
npm start
```

Open [the built app](http://127.0.0.1:3001). Stop the development API first because both use port 3001. The local production command uses macOS/Linux environment-variable syntax, matching the planned development and hosting environments.

## Verify changes

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs ESLint, TypeScript checks, unit/API/UI tests, and production builds. PostgreSQL must be running. API tests migrate and clear only `solar_management_test`, so reserve that database for tests. Browser tests use the seeded development database and start their own app servers; stop an existing `npm run dev` session first. GitHub Actions runs the checks against PostgreSQL 18 on pushes to main and pull requests.

## Learn the project

1. [Understand the original system](docs/checkpoints/01-understand-original.md): architecture, data model, and a request traced through the code to the database.
2. [Feature review](docs/feature-review.md): what exists, what the evidence supports, and what to retain, redesign, or defer.
3. [Checkpoint 1 exercises](docs/checkpoints/01-exercises.md): explain the request, investigate a measurement, and reason about energy.
4. [Checkpoint 2 walkthrough and exercise](docs/checkpoints/02-foundation.md): follow the new request, run the tests, and debug a connection failure.
5. [Checkpoint 3 walkthrough and exercise](docs/checkpoints/03-persistence.md): follow a database query and edit a stored installation.
6. [Rebuild roadmap](docs/roadmap.md): the agreed design and remaining checkpoints.

## Source layout

| Directory | Responsibility |
| --- | --- |
| `client/` | React interface, TanStack Query, and browser API requests |
| `server/` | Express features, shared database pool, migrations, seed, and API tests |
| `shared/` | TypeScript API contracts and runtime validators |
| `e2e/` | Browser tests against the running frontend and API |
| `docs/` | Walkthroughs, exercises, design review, and roadmap |

One root lockfile records dependencies for all three npm workspaces. Build output and dependencies are ignored by Git.

## Planned first release

Users will manage solar installations, view stored readings and energy estimates, and resolve rule-based alerts. Visitors will be able to explore a shared, read-only demo or register to manage their own sites. All first-release telemetry will be clearly labeled as simulated.

The planned stack is React and TypeScript, an Express API, and PostgreSQL accessed through parameterized SQL. The production application will run in containers on a Mac mini behind an existing Cloudflare Tunnel.

Forecasting, PDF reports, real hardware integration, and battery monitoring are deferred until the monitoring core is understood and tested.

## How the rebuild works

Each checkpoint has a concrete result, an explanation, relevant verification, and a hands-on exercise. Learning review happens before the next checkpoint. Commits record completed changes as they happen; notes distinguish implemented behavior from future plans.

The original application remains a separate reference. Source paths in the walkthrough refer to that original project, not files in this repository. Important excerpts are included so the walkthrough can also be read on GitHub.

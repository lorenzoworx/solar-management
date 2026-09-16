# Solar Management

A solar monitoring project being rebuilt in small, tested stages to develop and demonstrate full-stack engineering skills.

The starting point is an AI-assisted JavaScript prototype called Solar Dashboard. This repository records a new implementation and the reasoning behind it, beginning with an examination of the prototype.

## Current status

**Checkpoint 2: browser/API foundation implemented; learning review pending.**

The React page calls a real Express health endpoint, validates the response, and displays connection, loading, and retry states. The production build serves the frontend and API from one Node process. PostgreSQL, accounts, solar readings, and public deployment are still planned.

## Run locally

Use Node 24 and npm 11 or newer. If you use nvm, run `nvm use` in this directory first.

```sh
npm ci
npm run dev
```

Open [the development app](http://127.0.0.1:5175). The API listens on port 3001; Vite forwards the browser's `/api` requests to it. Port 5175 avoids the other local project already using 5173. Both servers bind to loopback by default.

`npm run dev` starts two servers and a shared-code compiler watcher. Stop them together with Ctrl+C. To run them in separate terminals for debugging, use `npm run dev:api` and `npm run dev:web`; rebuild shared code with `npm run build:shared` if you edit it in that mode.

If API port 3001 is occupied, run `API_PORT=3002 npm run dev`; both the API and proxy will use that value. No environment file or database is required yet.

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

`check` runs ESLint, TypeScript checks, unit/API/UI tests, and production builds. Browser tests start their own development servers; stop an existing `npm run dev` session first. GitHub Actions is configured to run both sets of checks on pushes to main and pull requests.

## Learn the project

1. [Understand the original system](docs/checkpoints/01-understand-original.md): architecture, data model, and a request traced through the code to the database.
2. [Feature review](docs/feature-review.md): what exists, what the evidence supports, and what to retain, redesign, or defer.
3. [Checkpoint 1 exercises](docs/checkpoints/01-exercises.md): explain the request, investigate a measurement, and reason about energy.
4. [Checkpoint 2 walkthrough and exercise](docs/checkpoints/02-foundation.md): follow the new request, run the tests, and debug a connection failure.
5. [Rebuild roadmap](docs/roadmap.md): the agreed design and remaining checkpoints.

## Source layout

| Directory | Responsibility |
| --- | --- |
| `client/` | React interface and browser API request |
| `server/` | Express application, HTTP listener, and API tests |
| `shared/` | Health-response type and runtime validator used across the boundary |
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

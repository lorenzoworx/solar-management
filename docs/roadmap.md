# Rebuild roadmap

## Objective

Build an explainable full-stack solar monitoring project, publish its source to [solar-management](https://github.com/lorenzoworx/solar-management), and deploy a working demo on the owner's Mac mini. The learning process is part of the deliverable.

Build in tested checkpoints with honest commits. As requested on September 18, 2026, all learning questions and tasks go in `questions.md`; reviews no longer pause implementation.

## Checkpoints

| Checkpoint | Deliverable | Status |
| --- | --- | --- |
| 1. Understand the original | Architecture map, request trace, feature review, exercises | Discussed with guided examples; independent recall to revisit |
| 2. Establish the foundation | npm workspaces, TypeScript, development scripts, linting, React calling an API health endpoint | Implemented; learner observed the response-editing exercise |
| 3. Persist one useful feature | Versioned SQL migrations, reproducible seed, stored installations displayed through the API | Implemented; learning review pending |
| 4. Add accounts and ownership | Registration, sessions, logout, site CRUD, validation and authorization | Implemented; learning tasks deferred |
| 5. Build monitoring | Ingestion, latest readings, history charts, energy summaries, local simulator submitting to the API | Implemented and tested |
| 6. Finish alerts and demo | Rule-based alerts and resolution, read-only demo, responsive UI and failure states | Implemented and tested |
| 7. Deploy and present | Container deployment, public URL, screenshots, operating instructions, interview practice | Mac mini deployment confirmed by owner; eight public browser scenarios pass. Tour, screenshots, exercises, and v0.1.0 release notes prepared. Final release awaits host recovery confirmation; learning review remains deferred |

Repository initialization accompanies the first documentation commit so checkpoint 1 can be published. Application scaffolding and build tooling still belong to checkpoint 2.

## Agreed implementation choices

| Area | Decision |
| --- | --- |
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Recharts, ordinary CSS |
| Backend | Node 24 and Express, organized by feature; serve the compiled frontend from the same application in production |
| Database | PostgreSQL 18, `pg`, one shared pool, parameterized SQL, versioned migrations through `node-pg-migrate` |
| API boundary | Account/session actions, owned-site CRUD, reading ingestion/history/latest, summaries, alert resolution under `/api`; shared TypeScript contracts plus runtime validation |
| Authentication | Hashed passwords; PostgreSQL-backed sessions; HTTP-only cookies, HTTPS settings, CSRF protection and authentication rate limits |
| Authorization | Ownership checked server-side; shared demo account cannot mutate application data |
| Demo | Instant read-only access to multiple sample installations; registration for users managing their own sites |
| Tests | Vitest, PostgreSQL API integration tests, React Testing Library, Playwright |
| Hosting | Existing Mac mini container runtime and Cloudflare Tunnel; PostgreSQL stays private |

The first release covers accounts, sites, readings, charts, energy estimates, and explainable alerts. Predictions, PDF reports, physical device adapters, battery monitoring, and equipment control are deferred.

## Data rules

- Define solar power in kW, inverter AC voltage in V, and inverter temperature in degrees Celsius. Remove the original ambiguous efficiency field.
- Store timestamps in UTC and label the time zone used in the interface.
- Seed reproducible simulated readings spanning seven days. Display their actual dates, source, and freshness.
- Estimate energy by trapezoidal integration between adjacent power samples. Skip gaps greater than 30 minutes, do not extrapolate outside observed coverage, and display incomplete coverage. A zero reading remains valid data.
- Make ingestion retry-safe using uniqueness on site and timestamp. Insert a reading and its resulting alerts transactionally.
- Allow at most one unresolved alert of each type per site. Demo rules start at inverter temperature >= 50 degrees Celsius and AC voltage outside 207–253 V. These are demo rules, not validated equipment-protection settings.

## Verification and release

Introduce tests with the behavior they protect. Cover cross-user access, attempted demo mutations, malformed inputs, duplicate readings, irregular sampling, missing data, concurrent alert creation, expired sessions, and database failures.

GitHub Actions runs linting, type checking, tests, production builds, and container recovery checks. Push completed checkpoints and tag the first verified release after the remaining public deployment checks pass.

Deploy the application, migration job, and PostgreSQL with Docker Compose. Use persistent database storage; wait for database readiness and successful migrations before application startup. Reuse the existing Cloudflare Tunnel for public application access. The server connection, public hostname, and existing tunnel network configuration are deployment inputs to inspect at checkpoint 7.

Verify HTTPS sessions, persistence after restarts, logs, health checks, a database backup/restore, and application rollback. Record operating commands and deployment configuration without committing credentials.

## Completion criteria

The release is complete when the public demo works, registered users can manage their own installations, automated checks pass, and recovery has been demonstrated. The learner must also be able to explain a complete request, a SQL query, an energy calculation, an authorization check, and a design tradeoff independently.

Checkpoint 1's ownership question was answered independently. Measurement semantics and the energy calculation were discussed through worked examples; those explanations are not evidence of independent mastery. Revisit these concepts as the corresponding features are implemented.

Checkpoint 2 introduced native fetch and a small React effect so the first request was visible end to end. The learner changed the server response and observed the result, then requested continuation.

Checkpoint 3 adds PostgreSQL 18, direct SQL, versioned migrations, a repeatable three-site seed, and TanStack Query for installation state. `/api/demo/sites` returns only explicitly marked demo records and has no mutation handlers. Ownership relationships arrive with accounts in checkpoint 4; seven days of simulated readings arrive in checkpoint 5. React Router and Recharts remain planned. Keep pairing concise at the learner's request.

Checkpoint 4 adds React Router, registration/login/logout, PostgreSQL sessions, scrypt password hashes, CSRF protection, authentication rate limits, and full owned-site CRUD. Shared Zod schemas validate new contracts. Browser tests now use the dedicated test database.

Checkpoints 5–6 include the seven-day reproducible seed, UTC charts, trapezoidal energy with coverage, retry-safe ingestion, transactional alerts, resolution, and the authenticated HTTP simulator. Seventy-seven unit/API/UI checks and eight browser scenarios pass locally.

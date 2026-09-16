# Solar Management

A solar monitoring project being rebuilt in small, tested stages to develop and demonstrate full-stack engineering skills.

The starting point is an AI-assisted JavaScript prototype called Solar Dashboard. This repository records a new implementation and the reasoning behind it, beginning with an examination of the prototype.

## Current status

**Checkpoint 1: original-system walkthrough prepared; learning review pending.**

This repository currently contains documentation. The application, automated test suite, and public deployment will be added in subsequent checkpoints. There is no application install or start command yet.

Start here:

1. [Understand the original system](docs/checkpoints/01-understand-original.md): architecture, data model, and a request traced through the code to the database.
2. [Feature review](docs/feature-review.md): what exists, what the evidence supports, and what to retain, redesign, or defer.
3. [Checkpoint 1 exercises](docs/checkpoints/01-exercises.md): explain the request, investigate a measurement, and reason about energy.
4. [Rebuild roadmap](docs/roadmap.md): the agreed design and remaining checkpoints.

## Planned first release

Users will manage solar installations, view stored readings and energy estimates, and resolve rule-based alerts. Visitors will be able to explore a shared, read-only demo or register to manage their own sites. All first-release telemetry will be clearly labeled as simulated.

The planned stack is React and TypeScript, an Express API, and PostgreSQL accessed through parameterized SQL. The production application will run in containers on a Mac mini behind an existing Cloudflare Tunnel.

Forecasting, PDF reports, real hardware integration, and battery monitoring are deferred until the monitoring core is understood and tested.

## How the rebuild works

Each checkpoint has a concrete result, an explanation, relevant verification, and a hands-on exercise. Learning review happens before the next checkpoint. Commits record completed changes as they happen; notes distinguish implemented behavior from future plans.

The original application remains a separate reference. Source paths in the walkthrough refer to that original project, not files in this repository. Important excerpts are included so the walkthrough can also be read on GitHub.

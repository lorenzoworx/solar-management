# Feature review: retain, redesign, defer

This review concerns the original Solar Dashboard source. “Implemented” below means an identifiable implementation exists in the inspected source; it does not claim an end-to-end test passed. The new repository's runtime remains planned.

## Inventory and decisions

| Feature | Evidence in the original | Rebuild decision |
| --- | --- | --- |
| Accounts | Registration/login hash and compare passwords; JWTs are returned and stored in local storage. See `server/services/authService.js` and `client/src/context/AuthContext.jsx`. | **Redesign:** retain accounts and ownership; introduce database-backed cookie sessions and explicit server logout. |
| Site management | API implements list/create/read/update/delete in `server/routes/sites.js`. The Sites page exposes listing and creation, but no editing or deletion controls. | **Retain and complete:** build full CRUD with ownership and form feedback. |
| Site details and charts | SiteDetail loads site metadata, metric history, and anomalies; Recharts renders returned readings. | **Retain:** rebuild typed requests and independent loading/error states. |
| Dashboard summaries | `Dashboard.jsx` derives “Weekly Energy” from capacity rather than measured history and fetches sites twice in its loading routine. | **Redesign:** compute summaries from readings with coverage and freshness. |
| Time-series storage | Prisma declares Metric records and their site relationship. No declared compound history index or site/timestamp uniqueness. | **Redesign:** explicit SQL schema, query index, and retry-safe ingestion. |
| Telemetry ingestion | `metricService.createMetric` persists a reading and then creates rule-based alerts. | **Retain and strengthen:** runtime validation, defined units, transactions, duplicate handling. |
| Alerts | Rules include voltage, temperature, efficiency, and daytime power thresholds. Resolution stores a timestamp. | **Redesign:** start with documented voltage/temperature demo rules and database-enforced open-alert uniqueness. |
| Simulator and seed | Randomized generators exist. The seed clears all four application tables before inserting demo data. | **Redesign:** reproducible, clearly scoped sample-data setup plus a local simulator using the API. |
| HTTP JSON collector | Fetches a configured URL and maps values; normalizer compresses them into Metric fields. | **Defer hardware integration:** retain the ingestion boundary and simulator in v1. |
| Modbus and serial | Both adapters throw errors describing unimplemented scaffolds. | **Defer:** no hardware-support claim until a specific integration is implemented and verified. |
| Predictions | Flask trains a power model on synthetic data; forecast shape also uses a solar-cycle formula and noise. Failure/maintenance outputs use heuristics. | **Defer:** a later forecasting milestone needs evaluation and a baseline. |
| Prediction fallback | Node repeats time-of-day averages with noise when Flask is unavailable. It is not linear regression despite its opening comment. | **Defer:** do not preserve unsupported model claims. |
| PDF reports | PDFKit streams reports in `server/controllers/reportController.js`. Report history is stored in browser local storage. | **Defer:** first establish correct summaries and data semantics. |
| Theme and layout | Custom CSS, reusable cards, a theme toggle, and chart components exist. | **Retain as reference:** rebuild a responsive, accessible interface incrementally. |
| Preview server | Separate API backed by in-memory arrays in `preview-server.js`. | **Redesign:** one application with a read-only seeded database demo. |
| Tests and deployment | No application test suite, CI workflow, or migration history was found in the inspected source. ML has a Dockerfile; the full app has no Compose deployment. | **Add:** staged tests, CI, containers, and operating documentation. |

## Redesign example 1: energy needs elapsed time

The original dashboard includes:

```js
totalEnergy += site.capacity * 24 * 7 * 0.25;
```

A 12 kW installation therefore contributes 504 kWh every time, regardless of its recorded output. The final `0.25` acts as a fixed assumed utilization factor in this expression. This is a capacity-based estimate, not measured weekly generation.

The site-detail page and report use a different assumption:

```js
const totalEnergy = avgPower * metrics.length * 0.25;
```

Here `0.25` is treated as hours per reading. The formula assumes each reading represents an entire 15-minute interval. The ingestion endpoint accepts timestamps without enforcing that interpretation or cadence.

For two instantaneous samples, 2 kW at 12:00 and 4 kW at 12:15, trapezoidal integration estimates `(2 + 4) / 2 * 0.25 = 0.75 kWh` over the observed interval. Counting both samples as separate 15-minute intervals instead gives 1.5 kWh. A sample count and a count of intervals between samples are different things.

The rebuild's calculation will use timestamps, skip gaps greater than 30 minutes, and report observed coverage. A gap is unknown generation, not automatically zero generation.

## Redesign example 2: a percentage needs a definition

In `collector-service/src/normalizer.js`, missing efficiency can be replaced with `batterySoc`, or with a constant 90. Missing temperature can become 25; missing power can become zero. Voltage may come from AC, battery, or PV telemetry.

The battery-only input below actually normalizes to a metric with `powerOutput: 0`, `temperature: 25`, `voltage: 52`, and `efficiency: 40`:

```js
{ batteryVoltage: 52, batterySoc: 40 }
```

Those are not four observed measurements. Some are defaults and one has changed meaning. The original API's rules would treat 52 V as a voltage sag and 40% as an efficiency drop, although the supplied values describe a battery.

The rebuild will name the measurement explicitly and omit unsupported fields. Battery charge, conversion efficiency, and utilization will not share one label.

## Redesign example 3: checking first does not enforce uniqueness

`_createAnomalyIfNew` looks up an unresolved alert, then inserts one if none was found. Two concurrent requests can both perform the lookup before either inserts. Both may conclude that they should create an alert.

Also, `createMetric` writes the reading before attempting alert creation, without wrapping the operation in a transaction. A later failure can leave a persisted reading even though the overall HTTP request fails. A retry can insert that reading again.

The rebuild will make the database enforce site/timestamp uniqueness and one unresolved alert of each type per site. A transaction will group the reading and resulting alert changes.

## What the prototype does not establish

- A static chart backed by stored samples does not establish continuous real-time updates. SiteDetail fetches on navigation/site changes; its code does not subscribe to a live stream or poll periodically.
- Hardware profile documentation does not establish a working connection to that equipment.
- Training a neural network on synthetic data does not establish forecast accuracy on installations. `predict_power` also constructs timestamps with a hard-coded May 2026 date.
- The fallback expression `avgBySlot[slot] || capacity * 0.3` replaces a valid zero-power bucket with nonzero power. Preserving zero is a concrete requirement for the rebuild.
- Rendering the in-memory preview does not establish database persistence, migration correctness, or behavior of the separate API implementation.

These observations define the work ahead. They are also useful interview material: explain the original behavior, give a concrete counterexample, and show how the rebuilt version addresses it.

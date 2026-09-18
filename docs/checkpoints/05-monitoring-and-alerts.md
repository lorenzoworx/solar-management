# Checkpoints 5 and 6: monitoring and alerts

The demo now has seven days of simulated readings, charts, energy estimates, coverage indicators, and sample alerts. Registered users can add simulated readings to their own sites, run a local HTTP simulator, and resolve alerts. Learning tasks remain in [questions.md](../../questions.md).

## Data and API

Readings contain `recordedAt` (an ISO timestamp normalized to UTC at millisecond precision), `solarPowerKw`, `acVoltageV`, and `inverterTempC`. Power is required. Unknown voltage or temperature must explicitly be `null`; zero is valid data. Every first-release reading is labeled `simulated`.

| Method and path | Behavior |
| --- | --- |
| `GET /api/sites/:id/monitoring` | Owned site, latest reading, selected history, energy summary, and alerts |
| `GET /api/demo/sites/:id/monitoring` | Same read-only view, restricted to sample sites |
| `POST /api/sites/:id/readings` | Insert a validated simulated reading and its resulting alerts |
| `POST /api/sites/:id/alerts/:alertId/resolve` | Resolve an alert belonging to the current user's site |

The monitoring endpoints accept `from` and `to` as ISO timestamps. Both must be provided together; the window must increase and cannot exceed 31 days. The default is seven days ending at the latest stored sample, or now for an empty site. A range containing more than 10,000 readings is rejected rather than silently truncated. Alerts cover all dates and are limited to the latest 50, with unresolved alerts first. The interface refreshes every 15 seconds while visible.

`readings` has a composite primary key `(site_id, recorded_at)`. It both prevents duplicate timestamps and supports per-site time-range/latest queries. Repeating an identical reading returns 200 with `created: false`. Different values at an existing timestamp return 409. New readings return 201. Data more than five minutes in the future is rejected.

## Power versus energy

For each adjacent pair within the selected range:

```text
energy_kWh = (previous_power_kW + current_power_kW) / 2 × elapsed_hours
```

Pairs more than 30 minutes apart are skipped. No values are invented before the first sample, after the last sample, or across missing intervals. The chart breaks its line at those gaps. Zero readings remain in the calculation.

Coverage is the sum of accepted intervals divided by the full selected time window. It measures time coverage, not accuracy. For example, 2 kW at 12:00 and 4 kW at 12:15 contribute 0.75 kWh; a next sample at 13:15 contributes no additional energy because that gap is too long. The 75-minute window has 20% coverage. Even complete coverage still represents an estimate between discrete samples.

## Transactions and alerts

Ingestion locks the authorized site row and writes the reading and resulting alerts in one transaction. A failed alert insert rolls back the reading too. The demo rules are temperature at least 50°C and AC voltage below 207 V or above 253 V; null measurements do not trigger rules. These are demonstration thresholds, not equipment-protection settings.

A partial unique index allows at most one unresolved alert of each type per site. Concurrent ingestion cannot create duplicate open alerts. Resolution uses the same site lock. A subsequent new anomalous reading may open another alert; a retried reading cannot reopen one. Normal readings do not automatically resolve earlier alerts. Historical out-of-order readings can trigger alerts at their recorded timestamps.

The summary uses a repeatable-read transaction so the selected history, latest sample, and alerts come from one database snapshot. See PostgreSQL's [conflict-handling documentation](https://www.postgresql.org/docs/18/sql-insert.html).

## Reproducible samples and simulator

`npm run db:seed` creates samples from **September 11, 2026, 00:00 UTC through September 18, 2026, 00:00 UTC**, including both endpoints at 15-minute intervals. Cedar House and Mesa Workshop each have 673 readings. Willow Farm has a deliberate missing interval. Samples include two example alert conditions. Seeds reuse existing timestamps and do not change private-site data. The screen displays actual sample dates and marks data older than 30 minutes as historical.

To exercise ingestion through HTTP, configure these in the ignored `.env` file after creating your account and site:

```dotenv
SIMULATOR_EMAIL=your-account-email
SIMULATOR_PASSWORD=your-account-password
SIMULATOR_SITE_ID=your-site-uuid
SIMULATOR_API_URL=http://127.0.0.1:3001
SIMULATOR_COUNT=12
SIMULATOR_INTERVAL_SECONDS=5
```

Then run `npm run simulate`. The script signs in, submits readings, retries network/server failures up to two times with the original payload, and logs out when it finishes. It only sends credentials to HTTPS or localhost. It cannot write demo sites or another user's sites.

Tests verify integration math, irregular sampling, missing coverage, zero/null values, validation, retry conflicts, concurrent alert creation, transaction rollback, ownership, demo restrictions, date limits, reproducible seeds, and a real simulator run through HTTP.

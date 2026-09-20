# Solar Management: a short project tour

Solar Management is an AI-assisted full-stack rebuild for exploring simulated solar installations. It combines a public, read-only dataset with private accounts whose installations are protected by database ownership checks. The [live application](https://boywithabot.com/projects/solar-management/) demonstrates the features below; learning exercises remain in the local, Git-ignored `questions.md` file.

## A three-minute tour

| Stop | Visible behavior | Engineering point |
| --- | --- | --- |
| **Try demo → Cedar House → View monitoring** | Seven days of power readings, energy estimate, coverage, and an example temperature alert | Stored data has explicit units, source, dates, and freshness. “Historical” describes the sample age, not a failed API. |
| **Apply dates** | The URL and selected history change; a window before September 11, 2026 has no samples | The server computes a summary for the selected window. The latest-reading cards and alerts cover their own documented scope. |
| **Willow Farm** | A break in the chart and incomplete coverage | Missing samples are visible. The system does not invent energy across long gaps. |
| **Create account → Add installation** | A private workspace starts empty; saved installations survive reloads | Authentication identifies the caller; SQL ownership predicates restrict the records they can access. |
| An owned site's **Add reading → Resolve** | A simulated temperature of 50°C opens an alert; resolving it updates its state | Reading and alert creation are transactional. Public demo sites have no mutation controls or writable API handlers. |
| **Log out** | Private routes return to login | Logout removes the server-side session and clears the browser cookie. |

The account portion changes only the presenter's own data. Demonstrating the public dataset requires no account. [Desktop screenshot](images/demo-monitoring.png) · [Mobile screenshot](images/demo-monitoring-mobile.png).

## Follow one real request

Opening an owned monitoring page triggers this path:

```text
React SiteMonitor → apiRequest → public /projects/solar-management/api/sites/:id/monitoring
→ proxy strips the public prefix → Express /api/sites/:id/monitoring
→ unexpired PostgreSQL session → authorized site query
→ reading/alert queries and energy calculation → JSON → validated React data → chart
```

The session cookie holds an opaque token. The database lookup uses its digest and expiry to recover the user ID; the browser does not choose that ID. The monitoring handler validates the site UUID and date range, verifies access, and reads one consistent database snapshot. TanStack Query tracks request state and caches the result; the shared runtime schema checks the returned JSON before the UI uses it.

The private site-detail endpoint makes the ownership rule especially easy to see:

```sql
SELECT id, name, location, capacity_kw::double precision AS "capacityKw"
FROM sites
WHERE id = $1 AND owner_id = $2 AND NOT is_demo;
```

`$1` is the validated site UUID and `$2` comes from the authenticated session. Parameters keep values separate from SQL syntax; the ownership predicate prevents reading another user's site. These solve different problems. A missing or inaccessible site returns 404.

Read the implementation in [SiteMonitor](../client/src/features/monitoring/SiteMonitor.tsx), [API requests](../client/src/api/request.ts), [session lookup](../server/src/features/auth/sessions.ts), [monitoring queries](../server/src/features/monitoring/monitoring.ts), and [site-detail SQL](../server/src/features/sites/owned-sites.ts).

## Explain the estimate and its limits

Power is an instantaneous rate in kW. Energy is power accumulated over time, in kWh. For 2 kW at 12:00 and 4 kW at 12:15, the trapezoidal estimate is `(2 + 4) / 2 × 0.25 = 0.75 kWh`. A following reading at 13:15 adds no estimate because the gap exceeds 30 minutes. Only 15 of the 75 minutes are covered: 20%.

Complete time coverage still means an estimate between samples. It does not validate the sensor or measure accuracy. Zero is retained as an observation; unknown optional voltage/temperature readings are `null`. See the [calculation and alert rules](../shared/src/monitoring.ts).

## Choices and tradeoffs

| Choice | Benefit | Cost or limit |
| --- | --- | --- |
| One Express application serves the API and frontend | One production application to deploy | In-memory authentication rate limits currently assume one instance |
| Parameterized SQL with `pg` | Queries, ownership, and transactions remain visible | Query/result mappings and schema changes must be maintained explicitly |
| PostgreSQL sessions | Sessions can be revoked and survive app restarts | Authentication depends on database availability |
| A site lock plus a partial unique alert index | Predictable concurrent ingestion with at most one open alert per type/site | Writes for the same site are serialized |
| Fixed alert thresholds | Rules are reproducible and explainable | They are demo rules, not validated equipment-protection settings |

Hardware adapters, forecasts, PDF reports, battery monitoring, password reset, and email verification are outside this release's implementation. [Deployment verification](deployment.md) distinguishes passing public/CI checks from the remaining Mac mini recovery work. The README records the project's AI-assisted origin; independent understanding remains a separate learning outcome.

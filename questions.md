# Questions and tasks for later

Implementation continues without waiting for these answers. Unchecked items are deferred learning or user tasks, not implementation blockers unless explicitly marked.

## Understand the foundation

These apply to the original project in `/Users/lorenzoworx/Downloads/solar-dashboard`.

### Exercise 1: follow a request

In five to eight sentences, explain what happens when a logged-in user opens a site-detail page. Include:

- The difference between `/sites/<id>` and `/api/sites/<id>`.
- Where the request obtains the caller's user ID.
- Where ownership is checked.
- Why the page requests both site details and metric history.
- What causes the returned data to appear in React.

Then answer: **If I replace the site's UUID in the URL with another user's valid site UUID, what should happen, and which predicate makes that happen?**

Optional source reading order in the original project:

1. `client/src/pages/SiteDetail.jsx`: `loadData`.
2. `client/src/context/SiteContext.jsx`: `fetchSite`.
3. `client/src/services/api.js`: `getSite` and the request interceptor.
4. `server/middleware/auth.js`: `authenticate`.
5. `server/controllers/siteController.js`: `getSite`.
6. `server/services/siteService.js`: `getSite`.

### Exercise 2: investigate a measurement

Run the following from the **original solar-dashboard directory**, not this documentation repository. It only calls the original pure normalizer; it starts no server and writes no data.

Before running it, predict the output and note which fields actually appeared in the input.

```sh
node <<'NODE'
const { normalizeReading } = require('./collector-service/src/normalizer');

const reading = {
  timestamp: '2026-09-16T12:00:00.000Z',
  batteryVoltage: 52,
  batterySoc: 40,
};

console.log(normalizeReading(reading));
NODE
```

Explain:

1. Which output fields were measured, defaulted, or relabeled?
2. Why could the current API create misleading voltage and efficiency alerts from this result?
3. What would you want the new API to do when an inverter-temperature measurement is absent?

There is a design tradeoff in the last question: accepting incomplete measurements can be useful, but making up a plausible number loses the distinction between missing and observed data. Defend your choice; we will use the discussion when defining the new input contract.

### Exercise 3: estimate energy and identify missing coverage

Treat these as instantaneous power samples, all on the same day in UTC:

| Time | Power |
| --- | --- |
| 12:00 | 2 kW |
| 12:15 | 4 kW |
| 13:15 | 4 kW |

Using the agreed rule—trapezoidal integration with gaps greater than 30 minutes skipped—answer:

1. What energy can we estimate over the accepted interval?
2. How many minutes of the 75-minute window are covered?
3. Can we describe the estimate as the total energy for the whole window? Why?
4. What would the original `avgPower * metrics.length * 0.25` calculation return?

Formula for an accepted interval:

```text
energy_kWh = (start_power_kW + end_power_kW) / 2 * elapsed_hours
```

### Optional extension: read the query

In the walkthrough's site query, explain why `WHERE id = $1` alone is insufficient for this application's permission model. Then describe an index that would help find a site's newest reading, including the order of its columns.

### Review checklist

These remain unchecked until your answers have been reviewed:

- [ ] Explain the browser-to-database-to-browser request in your own words.
- [ ] Distinguish authentication, input validation, and authorization.
- [ ] Identify which data is simulated, observed, defaulted, or calculated.
- [ ] Explain why elapsed time and missing coverage matter for energy.
- [ ] Explain one feature to retain, one to redesign, and one to defer.

## Foundation and SQL practice

- [ ] Explain why login alone does not prevent access to another user's installations. (Previously answered correctly; revisit using the new implementation.)
- [ ] Explain why battery state of charge is different from efficiency.
- [ ] Calculate the energy produced by 3 kW sustained for 30 minutes and explain the units.
- [ ] Explain why the page can remain visible when the API stops, where the health timestamp originates, and why incoming JSON needs runtime validation.
- [ ] In SMD, run the SQL below, reload the browser, and explain why the displayed name changes without editing React. Restore the sample with `npm run db:seed`.

```sh
psql postgres://solar_dev@127.0.0.1:55432/solar_management_dev \
  -c "UPDATE sites SET name = 'My first stored site' WHERE id = '10000000-0000-4000-8000-000000000001';"
```

- [ ] Run `npm run dev:api` and `npm run dev:web` in separate terminals. Stop only the API, click **Check again**, inspect the failed request in the Network panel, then restart the API and retry.
- [x] Change the health response service name and observe the result. The learner confirmed the displayed response changed.
- [ ] Explain why the browser test's expected service name would also need updating for a permanent rename.

## Accounts and ownership

- [ ] Register two accounts. Create an installation in each and check that they remain separate.
- [ ] Trace the ownership condition in one SQL query. What happens if it is removed?
- [ ] Explain password hashing versus encryption, and why each password has its own salt.
- [ ] Explain what the session cookie contains, where session data lives, and what logout removes.
- [ ] Explain why HTTP-only cookies, CSRF protection, HTTPS, and authentication rate limits solve different problems.
- [ ] Edit and delete a site, reload the browser, and check that the saved result persists.

## Deployment inputs (needed at deployment)

- [ ] Provide or identify the Mac mini SSH connection and application directory.
- [ ] Choose the public hostname and identify the existing Cloudflare Tunnel route/network.
- [ ] Confirm whether the existing tunnel connector runs on the host or in Docker, and identify its persistent network configuration. No SSH configuration or Docker CLI was available on this development MacBook.
- [ ] After deployment, verify the public HTTPS URL, Secure session cookies, and login persistence after container restarts.
- [ ] Run the documented backup/restore check on the Mac mini and keep a private off-host backup.
- [ ] Demonstrate rollback to the preceding application image, checking schema compatibility first.
- [ ] Tag the first verified release only after public access and recovery checks pass.

## Monitoring and alerts

- [ ] Compare Cedar House with Willow Farm in the demo. Explain why missing samples lower coverage and break the chart line.
- [ ] Reproduce the 0.75 kWh example above using trapezoidal integration. Explain why a fully covered window is still an estimate.
- [ ] Explain why missing voltage is `null`, while zero volts is a valid value that triggers the voltage rule.
- [ ] Add the same reading twice through the API. Explain the 201/200 distinction, and why changing its values gives 409.
- [ ] Run `npm run simulate` using the configuration in [the monitoring notes](docs/checkpoints/05-monitoring-and-alerts.md). Follow its request through authentication, SQL, and the chart.
- [ ] Explain how the composite primary key, transaction, site lock, and partial unique alert index each protect a different invariant.
- [ ] Trigger a 50°C alert, resolve it, and submit a new high-temperature reading. Explain why a new alert may appear but a retry cannot reopen it.
- [ ] Explain what the 30-minute gap limit and fixed demo thresholds cannot tell us about real equipment.

## Final interview practice

- [ ] Independently explain a complete request, a parameterized SQL query, an authorization check, an energy calculation, and one design tradeoff.

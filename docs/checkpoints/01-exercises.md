# Checkpoint 1 exercises

Read the [system walkthrough](01-understand-original.md) and [feature review](../feature-review.md) first. The goal is to explain the behavior in your own words and support your explanation with a specific part of the code.

You can send your answers in the conversation. Do not worry about polished prose. We will review the reasoning before moving to application scaffolding.

## Exercise 1: follow a request

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

## Exercise 2: investigate a measurement

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

## Exercise 3: estimate energy and identify missing coverage

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

## Optional extension: read the query

In the walkthrough's site query, explain why `WHERE id = $1` alone is insufficient for this application's permission model. Then describe an index that would help find a site's newest reading, including the order of its columns.

## Review checklist

These remain unchecked until your answers have been reviewed:

- [ ] Explain the browser-to-database-to-browser request in your own words.
- [ ] Distinguish authentication, input validation, and authorization.
- [ ] Identify which data is simulated, observed, defaulted, or calculated.
- [ ] Explain why elapsed time and missing coverage matter for energy.
- [ ] Explain one feature to retain, one to redesign, and one to defer.

After review, record what you learned and any remaining questions. The next checkpoint will create a React page that calls an Express health endpoint.

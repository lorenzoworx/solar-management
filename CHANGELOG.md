# Changelog

## Unreleased

- Add a CI-gated production job for the portfolio deployment.
- Build each exact commit for the portfolio subpath, back up PostgreSQL before
  migration, test the candidate against the production schema, verify the public
  readiness endpoint, and retain the previous compatible image for rollback.

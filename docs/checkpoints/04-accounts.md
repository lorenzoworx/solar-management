# Checkpoint 4: accounts and ownership

Visitors can explore `/demo`. Registration signs a user in; `/sites` lets that user create, list, view through the API, edit, and delete their own installations. Logout returns to the login page. All questions and exercises are in the local, Git-ignored `questions.md` file.

## Request flow

1. React fetches `/api/auth/session` to read the current account and a CSRF token. An anonymous visitor receives a temporary session too, so login and registration are protected.
2. Registration validates the shared Zod schema, hashes the password, and inserts a user and replacement session in one transaction. Login verifies the hash and replaces the session. The previous session is deleted.
3. The browser stores an opaque random session token in an HTTP-only cookie. PostgreSQL stores its SHA-256 digest, account reference, CSRF token, and expiry. JavaScript receives user details and the CSRF token, never the session token or password hash.
4. Every owned-site request loads the unexpired session. SQL combines the requested site ID with `owner_id = $userId` and `NOT is_demo`. The user ID comes from the session, never the request body.

## API

| Method and path | Result |
| --- | --- |
| `GET /api/auth/session` | Current user or null, plus CSRF token |
| `POST /api/auth/register` | Create an account and sign in |
| `POST /api/auth/login` | Verify credentials and sign in |
| `POST /api/auth/logout` | Delete session and clear cookie |
| `GET /api/sites` | List the current user's sites |
| `POST /api/sites` | Create an owned installation |
| `GET /api/sites/:id` | Read an owned installation |
| `PUT /api/sites/:id` | Replace editable site fields |
| `DELETE /api/sites/:id` | Delete an owned installation |

Mutations require `X-CSRF-Token`; bodies use JSON. Validation failures return 400, missing login 401, CSRF failures 403, missing/inaccessible sites 404, duplicate email 409, and rate limits 429. Database failures return a safe 503 response.

## Security decisions

- Passwords use Node's scrypt with independent random salts: N=131072, r=8, p=1. Unknown-email logins still run a dummy password calculation. Passwords accept 12–128 characters without trimming. See [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Sessions expire after an absolute 24 hours. Every query enforces expiry; a 15-minute maintenance interval removes old records. Restarting the application does not discard sessions because PostgreSQL owns them.
- Production cookies use `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`, with no domain attribute. Production requires an HTTPS `APP_ORIGIN`. `TRUST_PROXY` must match the known private proxy path; it defaults to zero locally.
- Writes check the session's CSRF token, reject mismatched Origin/cross-site headers, and require HTTPS in production. CSRF tokens rotate with sessions. See [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- Registration/login share a per-IP limit of 20 attempts per 15 minutes. Session requests have a separate limit. Counters are in memory for the planned single application instance; multiple instances would require a shared limit store.
- The database enforces that a demo site has no owner and a private site has one. Public demo queries select only explicit samples. Ownership cannot be set by an API caller.
- React clears private query data on logout/account changes. Query keys include the current user ID. An expired session refreshes account state before redirecting to login.

## Verification and remaining scope

Tests cover account creation, duplicate emails, bad credentials, hashed passwords, rotated/revoked/expired sessions, persisted login across app instances, CSRF and origin failures, production cookie flags, complete CRUD, cross-user access, demo mutation attempts, malformed input, SQL-like strings, rate limiting, and unavailable databases. Browser tests exercise the real registration → create → edit → reload → logout → login → delete flow on mobile.

API and browser tests use the dedicated test database; run them sequentially. No email verification, password reset, MFA, telemetry, or public deployment is claimed at this stage.

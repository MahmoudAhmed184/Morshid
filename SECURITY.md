# Security

Do not open public GitHub issues for vulnerabilities, exposed secrets, or course-boundary bypasses.

For this graduation project scaffold, report security concerns privately to the repository owner or team lead. Include:

- Affected area or endpoint.
- Reproduction steps.
- Expected and actual behavior.
- Any logs or screenshots that do not expose secrets or student data.

Never commit real credentials, API keys, production database URLs, private course material, or student data. Local `.env` files are ignored; use the checked-in `.env.example` files as templates.

## Client auth token storage

The SPA does not persist access or refresh tokens in `localStorage` or
`sessionStorage`. Access/session data is held in memory, and legacy stored auth
entries are removed during startup.

The server also issues the rotating refresh token as an `HttpOnly`, `SameSite`
cookie scoped to `/api/v1/auth`; production cookies additionally use `Secure`.
Browser API requests include credentials so a page refresh can restore the
in-memory access session without reading the HttpOnly cookie from JavaScript.
For backward compatibility with non-browser API clients, auth responses still
include the rotated refresh token; the SPA keeps that response value in memory
only. Server endpoints remain the authorization boundary for roles and course
ownership.

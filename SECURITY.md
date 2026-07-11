# Security

Do not open public GitHub issues for vulnerabilities, exposed secrets, or course-boundary bypasses.

For this graduation project scaffold, report security concerns privately to the repository owner or team lead. Include:

- Affected area or endpoint.
- Reproduction steps.
- Expected and actual behavior.
- Any logs or screenshots that do not expose secrets or student data.

Never commit real credentials, API keys, production database URLs, private course material, or student data. Local `.env` files are ignored; use the checked-in `.env.example` files as templates.

## Client auth token storage

The current SPA stores a versioned, minimal auth session in `localStorage` so it
can restore a page refresh and rotate JSON refresh tokens. The client clears
malformed, legacy, or refresh-expired stored sessions before treating a user as
authenticated.

This remains exposed to XSS like any browser-readable token storage. The target
hardening path is to move refresh-token transport to `Secure`, `HttpOnly`,
`SameSite` cookies on the server and keep access tokens short lived.

# F09: API abuse protection

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Protect public and authenticated HTTP traffic independently from educational
allowances.

## Contract

- Enforce these fixed, read-only defaults:
  - five new tutoring submissions per minute per account;
  - 120 general authenticated requests per minute per account;
  - ten failed sign-in attempts per 15 minutes per normalized email and client
    IP combination.
- Use Redis-backed distributed windows. Define trusted proxies explicitly
  before accepting forwarded client addresses.
- A tutoring idempotency replay consumes no educational allowance, but remains
  subject to the general HTTP throttle.
- Return HTTP 429, a stable error body, integer-seconds `Retry-After`, and an
  exact retry timestamp. Do not return milliseconds in the header.
- Fail closed for sign-in protection when shared throttle state is unavailable.
  Authenticated read traffic may use a documented bounded fallback only if it
  cannot weaken authorization or tutoring limits.
- Show active values and storage health read-only to Admins.

## Acceptance criteria

- [ ] Accounts and sign-in identities cannot consume each other's buckets.
- [ ] Multi-replica tests share limits through Redis.
- [ ] Proxy tests distinguish trusted forwarding from spoofed headers.
- [ ] `Retry-After`, error codes, and retry timestamps are correct at window
      boundaries.
- [ ] The system distinguishes abuse throttles, Tutoring Allowance, Review
      Allowance, and upstream provider limits.
- [ ] Tests use a controlled clock and do not rely on sleeping.

## Out of scope

Admin-editable security limits, CAPTCHA, WAF configuration, IP reputation, and
provider quota management.


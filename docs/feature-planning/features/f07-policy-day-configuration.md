# F07: Policy Day configuration

**Difficulty:** Hard  
**Dependencies:** F01

## Outcome

Provide one authoritative calendar window for all daily Tutoring and Review
Allowances.

## Contract

- Store one deployment IANA time zone, default `Africa/Cairo`.
- Expose a small `PolicyDay` interface that returns the window containing an
  instant and its exact start, end, and display time zone. Callers do not
  calculate midnight themselves.
- Admins can validate and schedule a new time zone from Usage settings. A time
  zone change becomes effective at the next boundary under the old time zone so
  it cannot grant a second partial-day allowance.
- Show current and pending values, effective time, and a preview of the next two
  reset instants. Audit scheduling and activation.
- Handle daylight-saving gaps and overlaps with real instant boundaries. Use a
  controllable clock in tests.

## Acceptance criteria

- [ ] Tutoring and Reviews receive identical windows for the same instant.
- [ ] Invalid or unsupported IANA values are rejected without changing state.
- [ ] A scheduled change activates once and never creates overlapping windows.
- [ ] Reset timestamps returned to clients remain exact across DST transitions.
- [ ] Concurrent Admin updates use an explicit version and report conflicts.
- [ ] Unit and E2E tests cover Cairo DST, a non-DST zone, scheduling, activation,
      concurrency, and server restart.

## Out of scope

Per-user or per-Course time zones, locale selection, arbitrary recurring
schedules, and a generic settings registry.


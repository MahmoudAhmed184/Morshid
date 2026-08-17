# F10: Review Allowance

**Difficulty:** Hard  
**Dependencies:** F07

## Outcome

Replace the hardcoded global three-per-UTC-day rule with configurable,
Course-scoped manual review allowances and visible Student status.

## Contract

- Default to three manual requests per Student and Course per Policy Day, with
  an Admin range of 1 through 20.
- Apply `Course override → deployment default`. Removing an override restores
  inheritance. Policy mutations require version, reason, and Audit Event.
- Reserve consumption atomically when a new `STUDENT_REQUEST` trigger is
  created. Automatic triggers never consume it. Replays and another request by
  the same Student for the same target message do not consume twice.
- A manual request added to an automatically created Review Case consumes once
  because it creates new Student demand.
- Replace count-by-UTC-query enforcement with authoritative Policy Day usage
  that supports resets without deleting Review Triggers. Reconcile current-day
  triggers when introducing the new counter.
- Student Usage & reviews and the request dialog show effective limit,
  remaining requests, reset time, and an actionable exhausted state.
- Return a stable 429 error and integer-seconds `Retry-After`.

## Acceptance criteria

- [ ] Concurrent requests cannot exceed the effective allowance.
- [ ] Course isolation applies to defaults, overrides, consumption, and status.
- [ ] Existing manual triggers remain intact and current-day use is not lost
      during migration.
- [ ] Lowering a limit blocks later requests without changing existing Review
      Cases; increasing it allows the next request immediately.
- [ ] Automatic and idempotent paths consume nothing.
- [ ] Repository E2E and Student acceptance tests cover boundaries, existing
      automatic cases, replay, concurrency, and Policy Day reset.

## Out of scope

Per-Student policy overrides, unlimited requests, automatic-trigger limits, and
deleting Review Cases to restore allowance.


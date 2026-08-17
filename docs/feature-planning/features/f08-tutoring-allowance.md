# F08: Tutoring Allowance

**Difficulty:** Hard  
**Dependencies:** F07

## Outcome

Bound AI-backed tutoring usage with editable defaults, Course Policy Overrides,
atomic enforcement, and clear Student feedback.

## Contract

- Default to 40 unique AI-backed Tutoring Attempts per Student and Course per
  Policy Day, with a 1 through 500 range.
- Enforce a deployment cap of 1,000 attempts per Policy Day, configurable from
  1 through 100,000. Students never see deployment consumption counts.
- Reserve both scopes atomically immediately before the AI pipeline. Key the
  Student reservation by Tutoring Attempt so retries cannot consume twice.
- Apply `Course override → deployment default`. Numeric changes affect the next
  reservation and never alter completed attempts.
- Admin policy mutations require version, reason, and Audit Event. Removing an
  override restores inheritance.
- Student Usage & reviews shows effective limit, used, remaining, and exact
  reset. The composer shows a quiet warning at 20% remaining or below.
- Return distinct stable 429 errors and `Retry-After` for Student/Course and
  deployment exhaustion. Do not describe provider throttling as allowance use.

## Acceptance criteria

- [ ] Concurrent reservations cannot exceed either limit.
- [ ] Invalid, unauthorized, idempotent, and course-not-ready requests consume
      nothing; provider failures after reservation do consume once.
- [ ] Course isolation applies to policies, counters, status, and Admin writes.
- [ ] Policy edits and removal show the correct effective value immediately.
- [ ] Student UI handles normal, warning, exhausted, and global-cap states.
- [ ] Unit, repository E2E, API E2E, and Student acceptance tests cover boundary
      instants, concurrency, failures, and replay.

## Out of scope

Token-based billing, per-Student policy overrides, unlimited values, provider
quota configuration, and HTTP abuse throttling.


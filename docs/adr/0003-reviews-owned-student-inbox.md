# ADR 0003: Reviews owns the student inbox

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The only current producer of student-facing notification-like records is the
review workflow. A generic notifications module would create a second owner
for review visibility and force an event or forwarding layer for an invariant
that belongs to one local transaction.

## Decision

Reviews owns review case intake, triggers, resolution, history, and the
student review inbox. Review intake accepts all required trigger inputs in one
atomic call and creates the corresponding audit participation in the same
database transaction when required. There is no generic notifications
capability.

## Rejected alternatives

- Retaining a generic notifications module for one producer.
- Publishing review events and finalizing inbox rows asynchronously.
- Keeping a compatibility notification API after the direct cutover.

## Consequences

Review callers use named Reviews interfaces and can rely on one transaction
for intake and visibility. Student UI and tests move to the Reviews feature.
Generic notification persistence, routes, and exports are deleted.

## References

- [docs/developer-guide/13-reviews-and-human-in-the-loop.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/13-reviews-and-human-in-the-loop.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)

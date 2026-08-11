# ADR 0003: Reviews owns the Student inbox

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The only current producer of student-facing notification-like records is the
review workflow. A generic Notifications module would create a second owner
for review visibility and force an event or forwarding layer for an invariant
that belongs to one local transaction.

## Decision

Reviews owns Review Case intake, triggers, resolution, history, and the
Student Review Inbox. Review intake accepts all required trigger inputs in one
atomic call and creates the corresponding Audit participation in the same
database transaction when required. There is no generic Notifications
capability.

## Rejected alternatives

- Retaining a generic Notifications module for one producer.
- Publishing review events and finalizing inbox rows asynchronously.
- Keeping a compatibility notification API after the direct cutover.

## Consequences

Review callers use named Reviews interfaces and can rely on one transaction
for intake and visibility. Student UI and tests move to the Reviews feature;
generic notification persistence, routes, and exports are deleted.

## References

- `docs/architecture-refactor-plan-2026-08-11.md`, sections 7, 10, and 17
- `docs/research/nestjs-prisma-backend-organization-2026-08-11.md`
- `docs/morshid-decisions.md`, review and notification scope

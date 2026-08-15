# F11: Allowance Reset operations

**Difficulty:** Hard  
**Dependencies:** F08, F10

## Outcome

Let an Admin restore one Student's current Tutoring or Review Allowance after a
verified support incident without rewriting history.

## Contract

- Admin chooses Student, Course, current Policy Day, and Tutoring, Review, or
  both allowances.
- Preview the effective limit, current consumption, reset time, and resulting
  remaining count before confirmation.
- Require a trimmed reason between 10 and 500 characters and an explicit
  confirmation. Use an idempotency key for the command.
- Lock the relevant usage records, set current consumption to zero, and create
  an Audit Event containing the previous count, resulting count, scope, actor,
  reason, and operation ID in the same transaction.
- Concurrent reservations serialize with the reset. Domain records and global
  deployment consumption remain unchanged.
- Return `not found` for inaccessible Student/Course pairs without revealing
  hidden membership information.

## Acceptance criteria

- [ ] Preview performs no mutation and never exposes another Course.
- [ ] Confirming twice with the same key resets once and replays the result.
- [ ] A failed Audit Event rolls back the reset.
- [ ] In-flight consumption cannot be silently lost or counted against the
      wrong side of the reset.
- [ ] Student status reflects the reset on the next query.
- [ ] E2E tests cover each allowance, both together, no usage, race conditions,
      idempotency conflicts, and authorization.

## Out of scope

Resetting the deployment cap, deleting attempts or Review Cases, scheduling
future resets, and permanent per-Student exceptions.


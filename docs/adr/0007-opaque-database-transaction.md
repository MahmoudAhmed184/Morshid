# ADR 0007: opaque database transaction participation

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

Cross-capability invariants such as tutoring turn finalization and review
intake must be atomic. Exposing Prisma's generated transaction/client types
through product interfaces would make every capability depend on one ORM
implementation and would leak persistence details across seams.

## Decision

Platform Database exposes an opaque `DatabaseTransaction` participation
contract. A product interface accepts that contract only where the local
transaction is part of its invariant, such as Conversations, Tutoring,
Reviews, and Audit. Concrete Prisma adapters unwrap it inside platform or
owning persistence code. Product interfaces never expose Prisma transaction
types, and remote I/O never occurs inside a database transaction.

## Rejected alternatives

- Passing `Prisma.TransactionClient` through module interfaces.
- Committing each aggregate independently and repairing state with events.
- Introducing `forwardRef` or a bidirectional module dependency for transaction
  access.

## Consequences

Transactions remain locally owned and testable at the seam. The platform
adapter must validate transaction participation and repositories must share
the supplied transaction for all atomic writes. Callers cannot use ORM-specific
helpers through the interface, which keeps the dependency direction stable.

## References

- [docs/developer-guide/07-database-and-persistence.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/07-database-and-persistence.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)
- [CONTEXT.md](file:///home/mahmoud-ahmed/Projects/Morshid/CONTEXT.md)

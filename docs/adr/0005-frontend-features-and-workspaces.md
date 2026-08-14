# ADR 0005: frontend domain features and role workspaces

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The current client groups substantial product behavior under role buckets and
shared layout areas. That structure couples domain contracts to presentation
and makes route files carry too much product logic. TanStack Start already
provides the route composition boundary needed for thin adapters.

## Decision

Keep client routes thin and organize reusable behavior under domain features:
auth, account settings, courses, materials, chat, reviews, user management,
audit, system status, and landing. Role workspaces under `workspaces/student`,
`workspaces/instructor`, and `workspaces/admin` own role-specific composition
and presentation. Shared UI/design-system components remain intentional
shared ownership. Use `@/*` for client source imports and pass router/query
context through the established TanStack patterns.

## Rejected alternatives

- Keeping `features/student`, `features/instructor`, and `features/admin` as
  the domain owners.
- A TanStack Start BFF/server-function layer that duplicates the Nest API.
- Broad shared component or hook barrels that hide feature ownership.

## Consequences

Feature contracts can be tested beside behavior and used by multiple role
workspaces. Route changes are direct and do not add compatibility redirects.
Presentation moves may change internal client imports, but API ownership stays
with the corresponding domain capability.

## References

- `docs/architecture-refactor-plan-2026-08-11.md`, sections 5.2, 11, and 17
- `docs/research/frontend-file-architecture-2026-08-11.md`

# ADR 0006: Enforce an acyclic dependency graph with named interfaces

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The refactor changes ownership across a large npm workspace. Directory names
alone cannot prevent cycles, unresolved imports, production code importing
tests, or platform code reaching product modules. The architecture needs a
fast, reviewable gate that can become stricter as each capability is migrated.

## Decision

Use dependency-cruiser as the repository architecture gate. Start with green
rules for no cycles, unresolved imports, and production-to-test imports, then
enable ownership and layer restrictions only in the slice that removes all
violations. Run separate client and server cruises from explicit workspace
scripts. Generated Prisma and TanStack route files are not followed as
authored dependency graphs. Cross-capability callers use named capability
interfaces or module files; broad barrels are prohibited.

## Rejected alternatives

- A legacy baseline or temporary exception list for existing violations.
- Relying only on ESLint's import-cycle rule or human review.
- A custom dependency-analysis script that duplicates a maintained tool.

## Consequences

Every milestone must keep the initial architecture gate green. Later gates may
fail during a migration only while the corresponding source is being directly
cut over; the completed slice must have no exceptions. The configuration and
scripts become part of the repository's review contract.

## References

- [docs/developer-guide/03-architecture-and-boundaries.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/03-architecture-and-boundaries.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)
- [dependency-cruiser.config.mjs](file:///home/mahmoud-ahmed/Projects/Morshid/dependency-cruiser.config.mjs)

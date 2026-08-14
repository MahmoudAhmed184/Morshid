# ADR 0004: multi-file Prisma schema and one clean-slate migration

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The current Prisma history has eighteen migration directories and a schema
that spans multiple capabilities. Morshid is pre-deployment, so preserving
upgrade history or existing disposable data would retain obsolete shapes and
make the final ownership model harder to audit.

## Decision

Split the authored Prisma schema into cohesive domain files with a generator
and datasource entry. Replace the migration chain with one rolling clean-slate
initial migration. Every schema-changing slice regenerates that same initial
SQL from an empty database, reconciles the handwritten SQL inventory, resets a
disposable database, runs explicit seed, and checks the catalog and drift.
Retain `migration_lock.toml`; keep the removed HNSW index absent. Generated
Prisma output remains generated and ignored.

## Rejected alternatives

- Appending compatibility migrations to the existing eighteen-directory chain.
- Keeping one large schema file as the domain model grows.
- Preserving HNSW or other obsolete indexes merely because they exist today.

## Consequences

Database data may be discarded and reseeded during this refactor. Migration
review focuses on the final catalog, constraints, triggers, indexes,
extensions, and deterministic seed rather than upgrade compatibility. The
single initial migration is frozen and audited in Milestone 9.

## References

- `docs/architecture-refactor-plan-2026-08-11.md`, sections 3.3, 6, 13, and 17
- `docs/research/predeployment-contract-and-prisma-clean-slate-2026-08-11.md`

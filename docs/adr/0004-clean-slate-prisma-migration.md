# ADR 0004: Multi-file Prisma schema and one clean-slate migration

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The current Prisma history has eighteen migration directories and a schema
that spans multiple capabilities. Morshid is pre-deployment, so preserving
upgrade history or existing disposable data would retain obsolete shapes and
make the final ownership model harder to audit.

## Decision

Split the authored Prisma schema into domain files with a generator and
datasource entry. Replace the migration chain with one rolling clean-slate
initial migration. Every schema-changing slice regenerates that same initial
SQL from an empty database, reconciles the handwritten SQL inventory, resets a
disposable database, runs explicit seed scripts, and checks the catalog and drift.
Retain `migration_lock.toml`. Keep the removed HNSW index absent. Generated
Prisma output remains generated and ignored.

## Rejected alternatives

- Appending compatibility migrations to the existing eighteen-directory chain.
- Keeping one large schema file as the domain model grows.
- Preserving HNSW or other obsolete indexes just because they currently exist.

## Consequences

Database data may be discarded and reseeded during this refactor. Migration
review focuses on the final catalog, constraints, triggers, indexes,
extensions, and deterministic seed scripts rather than upgrade compatibility. The
single initial migration is frozen and audited in Milestone 9.

## References

- [docs/developer-guide/07-database-and-persistence.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/07-database-and-persistence.md)
- [server/prisma/README.md](file:///home/mahmoud-ahmed/Projects/Morshid/server/prisma/README.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)

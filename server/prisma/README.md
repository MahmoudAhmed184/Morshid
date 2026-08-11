# Prisma migration notes

## Course-scoped vector retrieval

`MaterialChunk.embedding` uses Prisma's `Unsupported("vector(1536)")` type.
Course retrieval intentionally uses a materialized, course-scoped exact cosine
scan. This keeps the course boundary and similarity ordering authoritative for
the V1 corpus size, so no vector access-method index is part of the supported
schema contract.

Before accepting a generated migration that touches `material_chunks`, inspect
its SQL. Do not add a plain B-tree index for `embedding`; a future ANN path
requires an explicit migration and a retrieval query that preserves the same
course-scoping guarantees.

## Rollback convention

Prisma migrations in this repository are forward-only. To roll back a migration
after it has been applied outside disposable development data, create and review
a new forward migration that reverses the intended schema change instead of
editing or deleting an existing migration directory.

# Prisma schema and migration notes

The authored schema is grouped by capability across the `.prisma` files in
this directory. `schema.prisma` is only the Prisma generator and datasource
entry point. Prisma is configured to load this directory as one schema.

The repository uses one rolling clean-slate initial migration. Every
schema-changing slice regenerates that same initial SQL from an empty schema,
reconciles the handwritten database contracts, resets a disposable database,
applies the initial migration, runs the explicit seed command, checks the
catalog, and proves there is no schema drift. `migration_lock.toml` is part of
the committed history.

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

## Migration contract

This is a clean-slate pre-deployment history. Do not append compatibility
migrations or preserve upgrade-only backfills and duplicate-data guards in the
blank initial migration. The final history contains exactly one migration
directory and the lock file.

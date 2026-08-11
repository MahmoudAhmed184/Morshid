# Pre-deployment contracts and a clean Prisma history

**Research date:** 11 August 2026  
**Scope:** Morshid before its first deployment, with no database or external API consumer whose state or compatibility must be preserved.

## Executive decision

Morshid may make coordinated breaking changes across its client, HTTP API, authentication, and database during this architecture redesign. It may also discard the current development data and replace the current 18-migration history with one reviewed initial migration. That freedom should be used to arrive at one coherent first-release design, not treated as a reason to change otherwise-good product contracts incidentally.

Recommended target:

1. Remove the speculative `/v1` segment and expose the first-release server under `/api/...`, unless Morshid deliberately commits now to supporting multiple independently-lived HTTP representations after release.
2. Change any HTTP, URL, auth, or schema contract that is demonstrably improved by the target domain model or user experience; update every in-repository caller and test in the same cutover. Do not add compatibility routes, DTO aliases, dual auth paths, or transitional columns.
3. Split the Prisma schema by business domain, using Prisma's generally available multi-file support.
4. Once the target data model is settled, replace all pre-release migrations with one clean `init` migration, restore all required hand-written PostgreSQL features, reset the disposable database, seed it explicitly, and prove that a blank database can be reproduced.

## 1. API versioning before the first release

Nest's versioning feature exists to run different controller or route versions in the same application when a breaking change must coexist with an older version. Nest supports URI, header, media-type, and custom versioning; URI versioning adds the version after a global prefix and before controller paths. The documentation describes a coexistence mechanism, not a requirement that every initial API carry a version identifier. [NestJS: Versioning](https://docs.nestjs.com/techniques/versioning)

Morshid does not currently use Nest's versioning mechanism. It hard-codes `api/v1` as a global prefix in `server/src/app.setup.ts`. Therefore `/v1` currently communicates a lifecycle promise without providing per-controller versions or parallel-version routing.

Google/Apigee's first-person API guidance argues that a versioning strategy need not be embedded before the first release: a version header or new URLs can be introduced when a real incompatible representation or entity generation exists. It also warns that a speculative `/v1` makes URLs longer and introduces a concept clients may never need. Its core rule is to try compatible evolution first and version only when that fails. [Google Cloud: Which version of versioning is right for you?](https://cloud.google.com/blog/products/api-management/api-design-which-version-of-versioning-is-right-for-you)

### Implication for Morshid

Remove `/v1` during the coordinated pre-release cutover and retain the meaningful `/api` namespace. This follows the project's stated rules: choose the simplest current solution and avoid speculative configuration and indirection. If the API is later published to independently released clients and an incompatible contract must coexist, adopt one explicit, documented versioning policy then; Nest already provides the mechanism.

Keeping `/v1` would also be defensible if Morshid consciously treats the initial HTTP surface as a long-lived public platform contract from day one. It should not be kept merely because version-looking URLs are common.

## 2. Breaking changes are allowed, but change must still have a reason

“No backward compatibility” means Morshid can perform a direct cutover: remove obsolete routes and fields, change all known callers, and delete the old implementation. Martin Fowler notes that changing an interface can still be a refactoring when every caller is available and changed with it; published interfaces require more care because the interface itself becomes observable behavior. In this pre-release repository, the client and test callers are available, so coordinated interface changes are feasible. [Martin Fowler: Is Changing Interfaces Refactoring?](https://martinfowler.com/bliki/IsChangingInterfacesRefactoring.html)

It does **not** follow that every contract should change. Fowler's canonical definition keeps observable behavior stable while improving internal structure, and his “two hats” guidance separates behavior-preserving restructuring from functionality changes so failures and intent stay attributable. [Refactoring.com: Definition](https://refactoring.com/), [Martin Fowler: Preparatory Refactoring and the Two Hats](https://martinfowler.com/articles/preparatory-refactoring-example.html)

### Decision rule

Every external behavior change in this initiative must name its reason in the architecture charter or an ADR:

- a clearer domain model or ownership boundary;
- a simpler or safer user/authentication flow;
- removal of an obsolete product concept;
- correction of inconsistent HTTP semantics; or
- a data invariant that should be enforced at the database boundary.

Folder movement, naming uniformity, or the mere absence of deployed consumers is not by itself a reason to redesign an HTTP response or user journey. Keep refactoring commits and intentional product-contract commits distinguishable even if they land in one final branch/PR.

## 3. Prisma: reset, squash, and baseline are different tools

Prisma distinguishes these workflows:

- `prisma migrate reset` is development-only. It drops the PostgreSQL schema when possible, recreates it, and reapplies the migration history. In Prisma ORM v7, seeding is no longer automatic; run `prisma db seed` explicitly afterward. [Prisma: Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production), [Prisma CLI: migrate reset](https://www.prisma.io/docs/cli/migrate/reset), [Prisma: Seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- Squashing is explicitly supported. Prisma documents both replacing unreleased feature-branch migrations with one migration and reducing a complete history to a single migration generated with `migrate diff`. It warns that generated squashes do not retain manually added SQL. [Prisma: Squashing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/squashing-migrations)
- Baselining is for an existing database containing important data that cannot be reset. It generates an initial migration, then marks it applied with `migrate resolve` so Prisma will not recreate existing objects. [Prisma: Baselining a database](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)

### Is deleting all migration history and creating one initial migration supported here?

Yes. Prisma's squashing and baseline documentation explicitly includes deleting/replacing the migrations directory and producing one migration from an empty schema to the current schema. Because Morshid has no database state to preserve, this is a clean **pre-release re-initialization**, not a production baseline. There is no existing database on which the new migration should be marked as already applied; a disposable local/test database should instead be reset and the new `init` applied normally.

Prisma's general warning not to edit or delete applied migrations protects shared or production histories from divergence. It does not prohibit the documented squash workflow when all affected databases are disposable and reset together. The migrations directory remains the source of truth after the cutover. [Prisma: Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)

## 4. Morshid-specific migration hazard: generated SQL is insufficient by itself

The repository uses Prisma ORM `7.8.0`, has 18 migration directories, and contains important SQL that is not fully represented by `schema.prisma`, including:

- `vector`, `pgcrypto`, and `citext` extensions;
- an `Unsupported("vector(1536)")` embedding column and an HNSW vector index;
- partial/conditional indexes;
- explicit check constraints;
- `enforce_review_case_target()` and its deferred constraint trigger; and
- hand-named indexes and constraints with operational meaning.

Prisma says that `migrate diff` squashing loses manually added SQL and that an initial migration must be edited (or replaced by an appropriate database dump) to restore unsupported database features such as triggers. [Prisma: Squashing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/squashing-migrations), [Prisma: Getting started with Prisma Migrate — unsupported features](https://www.prisma.io/docs/orm/prisma-migrate/getting-started)

Consequently, the implementation agent must not simply delete the old migrations and accept generated SQL. The clean initial migration is complete only when every still-required extension, database constraint, trigger, partial index, and vector facility has been intentionally preserved or deliberately removed by a recorded domain decision.

### Safe clean-history procedure

This is an implementation plan, not an action performed by this research task:

1. Finalize and validate the target Prisma data model first.
2. Inventory all non-schema SQL in the 18 existing migrations and classify each item as retain or intentionally delete.
3. Move/delete the old migration history only on the dedicated refactor branch.
4. Generate one migration from empty to the target schema (`migrate diff --from-empty --to-schema ... --script`, or `migrate dev --name init` against a clean development database).
5. Review and edit that migration to restore every retained unsupported PostgreSQL feature in dependency-safe order (extensions before dependent types/tables/indexes).
6. Apply it to a truly blank PostgreSQL schema. Do **not** use `migrate resolve --applied` for that blank database.
7. Run `prisma migrate reset`, then explicitly run `prisma db seed` because this repository uses Prisma v7.
8. Run schema validation, client generation, server E2E tests, and acceptance tests; also inspect the resulting PostgreSQL catalog for extensions, constraints, triggers, partial indexes, and the HNSW index.
9. Commit the single initial migration, `migration_lock.toml`, all schema files, Prisma configuration, and deterministic seed code together.

## 5. Multi-file Prisma schema and seed organization

Multi-file Prisma schemas have been generally available since Prisma ORM 6.7. Prisma requires the schema directory to be configured explicitly, requires the main `schema.prisma` and `migrations/` directory at the same level, and recommends grouping related models by domain with clear filenames. Relations work across files without imports. [Prisma: Schema location and multi-file schemas](https://www.prisma.io/docs/orm/prisma-schema/overview/location), [Prisma: Organize your Prisma schema into multiple files](https://www.prisma.io/blog/organize-your-prisma-schema-with-multi-file-support)

Recommended shape:

```text
server/prisma/
├── schema.prisma          # generator and datasource only
├── models/
│   ├── identity.prisma
│   ├── courses.prisma
│   ├── materials.prisma
│   ├── conversations.prisma
│   ├── tutoring.prisma
│   └── reviews.prisma
├── migrations/
│   ├── migration_lock.toml
│   └── <timestamp>_init/
│       └── migration.sql
└── seed/
    ├── seed.ts            # one explicit composition entry point
    └── ... domain-oriented deterministic seed helpers
```

Use domain files, not one Prisma file per model and not technical buckets. Cross-domain relations do not need import plumbing, and splitting should improve navigation rather than maximize file count.

Prisma v7 expects a `migrations.seed` command in `prisma.config.ts` and runs it only through an explicit `prisma db seed`. The seed should consistently recreate data required to start and validate the application. [Prisma: Seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)

For Morshid, keep a single configured seed entry point and split helpers only where domain datasets are cohesive. Make the result deterministic and repeatable for development and acceptance tests. Avoid environment-specific hidden behavior; if distinct seed profiles are genuinely required, expose them as explicit arguments supported by `prisma db seed`.

## 6. Architecture-charter constraints produced by this research

1. **Pre-release direct cutover:** compatibility routes, DTO aliases, fallback auth flows, dual schema fields, and legacy adapters are forbidden unless they serve a current non-compatibility requirement.
2. **Contract-change ledger:** every intentional HTTP, URL, auth, or user-visible behavior change gets an explicit rationale and updated end-to-end/contract assertion.
3. **No speculative API version:** use `/api` for the first release; add a real versioning policy only when multiple incompatible contracts must coexist or an external platform policy requires it.
4. **Disposable data only:** deleting/reseeding is authorized only because all current databases are confirmed disposable. This rule expires as soon as any environment contains data worth preserving.
5. **One clean initial migration:** squash after the target schema stabilizes, not repeatedly during intermediate model churn.
6. **Hand-written SQL audit:** generated Prisma SQL is never assumed to capture extensions, vector facilities, partial indexes, checks, functions, or triggers.
7. **Domain-oriented Prisma files:** use the GA multi-file facility; keep the main schema and migrations at the required root and split models by cohesive domain.
8. **Explicit Prisma v7 seed:** blank-database verification is `migrate reset` followed by `db seed`, then E2E/acceptance checks.

## Source quality and limits

All product/tool behavior above comes from official NestJS, Prisma, and Google Cloud documentation. Martin Fowler's first-person writing is used only for the secondary engineering-practice judgment about coordinated interface changes and separating refactoring from feature change. No source establishes a universal API-versioning law; the recommendation to remove `/v1` is an inference from Morshid's pre-release, single-client context and its explicit simplicity rules.

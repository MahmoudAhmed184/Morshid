# Whole-workspace refactor migration ledger

**Initiative:** Morshid whole-workspace architecture refactor  
**Plan:** `docs/architecture-refactor-plan-2026-08-11.md`  
**Ledger opened:** 11 August 2026  
**Starting branch:** `feature/socratic-tutor-v1-phase2`  
**Starting SHA:** `22fc7fbdce59fb2248db39a1bfd7b4d0b86f0480`  
**Implementation branch:** `refactor/whole-workspace-architecture`  
**First branch commit:** `1c88713195ec35e42e2c218ead57d08112ab85f5`  

This ledger is the working inventory for the approved plan. It records
ownership decisions before moves and names the focused verification and
handoff for each completed task. A row marked `delete` is an intentional clean
cutover, not a compatibility-removal suggestion.

## Baseline evidence

The verified starting worktree contained no tracked edits; it contained only
the approved plan and its five research notes as untracked files. The plan and
notes were committed in the first branch commit above before source changes.

| Evidence | Result |
| --- | --- |
| `npm run check` under Node `v26.4.0` / npm `12.0.2` | Passed: root 9 tests; client 60 files / 476 tests; server 117 suites / 1,723 tests; client and server production builds passed |
| `npm run test:e2e` | Failed: 30 suites / 257 tests failed, 12 suites / 178 tests passed. The failures share `password authentication failed for user "morshid"` from the already-running local PostgreSQL container; this is an environment credential mismatch, not an attributed source failure. |
| `npm run test:acceptance` | Exit 1: 28 passed, 2 failed. The suite booted both applications; the two failures are existing static-diagnosis presentation assertions in `student-static-diagnosis.spec.ts` (missing expected rendered diagnosis text). |
| Client unit/component test files | 60 |
| Server colocated unit spec files | 117 |
| Server E2E spec files | 42 |
| Server live spec files | 1 |
| Acceptance spec files | 6 |
| Root Node test files | 1 |
| OpenAPI baseline | `docs/architecture-baseline/openapi-v1.normalized.json`, generated from `GET /docs-json`; normalized snapshot size 51,612 bytes |
| Current Prisma migrations | 18 migration directories plus `migration_lock.toml`; net-live inventory is completed in Milestone 2 before replacement |

The shell environment is outside the supported range for the final gate. The
final verification must use the repository's Node 24 / npm 11 contract.

## Current server ownership inventory

| Current path | Current responsibility | Target disposition | Planned slice |
| --- | --- | --- | --- |
| `server/src/modules/auth` | Authentication, sessions, identity response | merge into `modules/identity` | 3 |
| `server/src/modules/admin/users` | Admin user administration | merge into Identity user administration | 3 |
| `server/src/modules/courses` | Course access and catalog | keep and deepen as Courses | 4 |
| `server/src/modules/admin/courses` | Admin courses, membership, material commands | distribute to Courses and Materials, then delete | 4 |
| `server/src/modules/materials` | Material catalog and processing | keep and deepen as Materials | 4 |
| `server/src/modules/rag-persistence` | Chunk/vector persistence | merge into Materials indexing/ingestion | 4 |
| `server/src/modules/student-chat` | Sessions, messages, new-turn/retry transport | split Conversations and Tutoring | 6A–6E |
| `server/src/modules/socratic-tutor` | Socratic analysis, teaching, generation, approval | merge into one Tutoring implementation | 6B–6E |
| `server/src/modules/tutor` | Python-only diagnosis runtime | move generic debugging contract, then delete | 6C–6E |
| `server/src/modules/output-policy` | Public response policy and safety | move private Response Governance into Tutoring, then delete | 6D–6E |
| `server/src/modules/completion` | Legacy completion provider/module | move consumer-neutral transport to platform AI; private TutorModel remains in Tutoring; delete legacy module | 6E, 8 |
| `server/src/modules/retrieval` | Course evidence retrieval | move behind Materials CourseEvidence | 6C–6E |
| `server/src/modules/reviews` | Review cases and actions | keep and deepen Reviews interfaces | 5, 6D |
| `server/src/modules/notifications` | Generic notification persistence/API | move student inbox to Reviews, then delete | 5 |
| `server/src/modules/admin/audit` | Admin audit query | merge into Audit | 4 |
| `server/src/modules/audit` | Audit persistence and query | keep as Audit | 4 |
| `server/src/modules/embedding` | Embedding provider | move technical adapter to platform AI | 8 |
| `server/src/modules/pdf-storage` | PDF storage adapter | move to platform document-storage | 8 |
| `server/src/modules/prisma` | Prisma service/module | move to platform database | 8 |
| `server/src/modules/redis` | Redis service/module | move to platform cache | 8 |
| `server/src/modules/config` | Configuration and validation | move to platform config | 8 |
| `server/src/modules/health` | Health endpoints | keep as Health over platform health interfaces | 8 |
| `server/src/modules/admin` | Admin composition shell | delete after actor-owned domain routes are direct | 4, 7 |

Common-area disposition:

| Current path | Target |
| --- | --- |
| `server/src/common/authorization/locked-student-chat-session.ts` | Conversations session admission |
| `server/src/common/gemini` | platform AI quota/transport, with duplicate completion implementation removed |
| `server/src/common/upstream` | platform AI consumer-neutral upstream transport/retry |
| `server/src/common/pipes` | `common/http` validation |
| `server/src/common/text` | keep as `common/text` |

## Current client ownership inventory

| Current path | Target disposition |
| --- | --- |
| `client/src/features/auth` | split into `features/auth/session`, `sign-in`, and `routing` |
| `client/src/features/admin` | distribute transport/contracts to Identity, Courses, Materials, and Audit; move UI to `workspaces/admin`; delete the feature bucket |
| `client/src/features/instructor` | distribute domain contracts to Courses, Materials, and Reviews; move role presentation to `workspaces/instructor` |
| `client/src/features/student` | distribute chat/session/review contracts to named features; move role presentation to `workspaces/student` |
| `client/src/features/notifications` | move inbox behavior to `features/reviews/student-inbox`, then delete |
| `client/src/features/status` | move to `features/system-status` |
| `client/src/features/landing` | keep as `features/landing` |
| `client/src/components/layout` | split shared authenticated sidebar to `workspaces/_shared`, account settings to `features/account-settings`, shared primitives to `components` |
| `client/src/components/ui` | keep as intentional shared UI/design-system ownership |
| `client/src/providers` | move application composition to `app`; theme to `components/theme` |
| `client/src/hooks/use-mobile.ts` | move to shared UI behavior |
| `client/src/lib/api` | keep shared HTTP only; move feature response parsing and queries to owning features |
| `client/src/lib/query` | keep feature-independent query infrastructure; pass QueryClient through router context |
| `client/src/routes` | keep, but make every route a thin TanStack adapter |
| `client/src/routeTree.gen.ts` | generated; regenerate only through TanStack tooling, never hand-edit |
| `client/src/styles.css` | move to `client/src/app/styles.css` |
| `client/src/components/logo.tsx` | move to `components/branding` |

The retained route contract is `/chat`, `/settings`, `/admin/*`, and
`/instructor/*`, with `_student` remaining a pathless protected layout. No
compatibility redirects are planned.

## Current test inventory and target groups

| Current group | Target group | Disposition |
| --- | --- | --- |
| `server/test/auth*.e2e-spec.ts`, `roles-guard`, `rbac`, `admin-users*` | `server/test/identity` | move/update for Identity contracts |
| `server/test/courses*`, `admin-courses*`, `course-boundary-audit` | `server/test/courses` | move/update for active membership |
| `server/test/materials*`, `material-processing`, `rag-persistence`, `retrieval*` | `server/test/materials` | move/update for Materials-owned evidence |
| `server/test/notifications*`, `review-*`, `manual-review-journey`, `instructor-review-action*`, `student-review-detail*` | `server/test/reviews` | move/update for Reviews-owned inbox/intake |
| `server/test/student-chat*`, `grounded-chat*`, `turn-service`, `message-turn-topic-linkage`, `topic-state`, `educational-analysis`, `teaching-decision`, `socratic-*`, `phase1-socratic-flow`, `gate-2` | `server/test/conversations` and `server/test/tutoring` | replace duplicate state and runtime paths in 6A–6E |
| `server/test/grounded-chat-migration.e2e-spec.ts`, `message-linkage-migration.e2e-spec.ts` | none | delete; replace upgrade-path checks with blank initial schema/catalog assertions |
| `server/test/openapi.e2e-spec.ts`, `app.e2e-spec.ts`, `fresh-seed*`, `automatic-safety-fresh-databases`, `gemini-quota-script` | `server/test/support` or owning capability | retain behavior, relocate by journey/capability |
| `server/test/fixtures/*` | capability `testing/` or `server/test/fixtures` | rename/move with the owning behavior; no production imports |
| `tests/acceptance/*.spec.ts` | `tests/acceptance/student`, `instructor`, `admin`, `cross-role`, `support` | group by actor journey and update callers directly |
| `client/src/**/*.test.*` | adjacent owning feature/workspace/route | move with behavior; delete shallow wiring tests when stronger interfaces replace them |
| `scripts/*.test.mts` | adjacent owned command tests | preserve operational command behavior and add database/schema command coverage |

## Current scripts, schemas, fixtures, and residual authored files

| Current area | Target disposition |
| --- | --- |
| `scripts/reset-local-db.mts` | platform database/disposable verification; guard project/database targets |
| `scripts/fresh-seed-demo.mts` and test | support/operations; update command order for initial migration plus explicit seed |
| `scripts/clear-local-review-data.mts` | Reviews-owned operational command |
| `server/scripts/clean-build-cache.mts` | server composition/tooling |
| `server/scripts/gemini-*.mts`, `iti-bedrock-*.mts` | platform AI live/probe scripts, or delete when the legacy consumer path disappears |
| `server/scripts/embedding-migration.mts` | platform AI/material ingestion migration tool; delete if no final architecture consumer remains |
| `server/scripts/live-diagnosis-validation.mts` | Tutoring code-diagnosis evaluation |
| `server/scripts/automatic-safety-live-smoke.mts` | Tutoring response-governance evaluation |
| `server/prisma/schema.prisma` | generator/datasource entry only |
| `server/prisma/identity.prisma` | new Identity domain schema file |
| `server/prisma/courses-and-materials.prisma` | new Courses/Materials schema file |
| `server/prisma/conversations.prisma` | new Conversations schema file |
| `server/prisma/tutoring.prisma` | new Tutoring schema file |
| `server/prisma/reviews.prisma` | new Reviews schema file |
| `server/prisma/audit.prisma` | new Audit schema file |
| 18 current migration directories | replace with one rolling clean-slate initial migration, then freeze in Milestone 9 |
| `server/prisma/migrations/migration_lock.toml` | retain and validate |
| `server/prisma/seed.ts`, `server/src/seeds` | keep under explicit seed ownership; update generated/domain imports |
| `fixtures/golden-dataset` | `fixtures/evaluations/code-diagnosis` |
| `fixtures/sources` | `fixtures/course-materials` |
| `storage/pdfs` | runtime storage outside source fixture ownership |
| `docker-compose.yml`, `Dockerfile`s, `.env.example`s | update only for final platform/config ownership and guarded disposable verification |
| `prisma.config.ts`, `server/prisma/README.md` | update for multi-file schema and one initial migration |
| `server/src/app.module.ts`, `app.setup.ts`, `main.ts` | keep as server composition and final Swagger ownership |
| `client/src/router.tsx`, `client/src/styles.css` | move into client `app` ownership, regenerate route tree |
| `AGENTS.md`, ADRs, current architecture/product docs | describe only the final current architecture; dated historical evidence must be labeled |

## Per-task handoff register

Each row is completed only after its focused gate passes and its coherent
commit SHA is recorded. The detailed handoff fields are filled in this ledger,
not inferred from the final aggregate diff.

| Task | Starting SHA | Final SHA | Commit(s) | Gate/result | Obsolete paths proven absent | Next safe task |
| --- | --- | --- | --- | --- | --- | --- |
| M0.1 branch and approval | `22fc7fbdce59fb2248db39a1bfd7b4d0b86f0480` | `1c88713195ec35e42e2c218ead57d08112ab85f5` | `docs(architecture): approve workspace refactor plan` | Branch created from exact SHA; plan/research committed | n/a | M0.2 ledger/characterization |
| M0.2 safety baseline and characterization | `1c88713195ec35e42e2c218ead57d08112ab85f5` | `6009895` | `docs(architecture): record refactor baseline` | `npm run check` passed; `npm run test:e2e` recorded the local PostgreSQL credential blocker; `npm run test:acceptance` recorded 28 passed / 2 existing diagnosis-render failures; OpenAPI snapshot and characterization index added | None intentionally removed | M0.3 handoff and Milestone 1 |
| M0.3 handoff/CI | `6009895` | `6009895` | draft PR #205 | Authenticated GitHub access was available; branch pushed and draft PR opened against `dev` so both existing CI jobs can observe pushed SHAs. | None intentionally removed | Milestone 1.1 |
| M1.1 architecture foundation | `a70a8b2` | `ad81143` | `chore(tooling): establish architecture guardrails` | `npm run check` passed: format, lint, root/client/server typecheck, client/server architecture gates, 9 root tests, 476 client tests, 1,723 server tests, and both production builds | `#/*` package/tsconfig alias removed; all authored `#/` imports absent; no dependency-cruiser baseline or exception file added | Milestone 2.1 |
| M2.1 clean Prisma foundation | `229b0ce` | `3e5252a` | `refactor(prisma): establish clean schema baseline` | Multi-file schema validated and generated; isolated Compose PostgreSQL reached one applied initial migration, explicit seed, catalog assertions, second deploy with no pending migrations, `prisma migrate status` up to date, and `prisma migrate diff --from-migrations ... --exit-code` reported `No difference detected`; `npm run check` passed with 9 root tests, 476 client tests, 1,723 server tests, both builds, and architecture gates | The 18 historical migration directories, upgrade-only migration tests, and `throughMigration` support were removed; `idx_chunks_embedding_hnsw`, `idx_messages_response_to`, and duplicate-response/backfill upgrade SQL are absent; generated Prisma output remains ignored | Milestone 3.1 |
| M3.1 Identity vertical slice | `4ab478b4635c10235232e01c1f5ac046b3c767f5` | `eef0ca1e5604fdae932f6bdefcf2c045811ffb96` | `refactor(identity): consolidate account ownership` | OpenAPI 13/13; Identity unit suites 28/28; Identity role/auth/user-administration E2E 73/73; client Identity suites 96/96; `npm run check` passed with 9 root tests, 476 client tests, 1,723 server tests, architecture gates, and both builds | `server/src/modules/auth`, `server/src/modules/admin/users`, old auth test-support names, old root auth/admin-user E2E paths, old client auth taxonomy folders, and client Admin-user transport/UI paths are absent; Identity boundary rule passes without exceptions | Milestone 4.1 |
| M4.1 Courses, Materials, and Audit vertical slices | `d9cde9f6697d075c47af4a666ab766e21263e9ff` | `050f40d` | `refactor(domains): consolidate course material and audit ownership` | Focused domain/workspace tests 9 suites / 44 tests; Courses/Materials E2E 3 suites / 67 tests; isolated chunk persistence 14/14; `npm run check` passed with 9 root tests, 476 client tests, 1,705 server tests, architecture gates, and both builds | `server/src/modules/admin`, `server/src/modules/rag-persistence`, duplicate course-access repository, old Admin/RAG production imports, and superseded client Admin feature transport paths are absent; Courses/Materials/Audit rules pass without exceptions | Milestone 5.1 |

### M2.1 handoff

- Starting SHA: `229b0ce`; implementation SHA: `3e5252a`; commit:
  `3e5252a`.
- Applicable authority: the approved architecture plan, ADR 0004, the
  research note `docs/research/predeployment-contract-and-prisma-clean-slate-2026-08-11.md`,
  and the M2 inventory `prisma-net-live-inventory.md`.
- Added `identity.prisma`, `courses-and-materials.prisma`,
  `conversations.prisma`, `tutoring.prisma`, `reviews.prisma`, `audit.prisma`,
  `assert-catalog.mts`, the rolling initial migration, and the net-live
  inventory. Changed the Prisma config/README, root and server scripts, and
  disposable schema tests. Deleted the single-file model body, all 18
  historical migration SQL files, and the two upgrade-only migration tests.
- The Prisma interface is now the directory-loaded domain schema with one
  generated client. No product interface gained a Prisma transaction type;
  no runtime dependency direction changed in this foundation slice.
- Retained extensions are `pgcrypto`, `citext`, and `vector`; the vector column
  remains `vector(1536)` with exact course-scoped retrieval and no access-method
  index. The initial SQL retains inventoried checks, FKs, indexes, partial
  indexes, function, and deferred review constraint trigger.
- Focused commands: `npm run db:generate --workspace server`, Prisma validate,
  isolated `docker compose -p morshid-m2-20260811 config --quiet` and
  `up -d --wait postgres`, explicit `db:migrate:deploy`, `db:seed`,
  `db:assert-catalog`, `prisma migrate status`, and drift diff all passed;
  `npm run check` passed. `git check-ignore` proved generated Prisma output is
  ignored, and repository searches found no deleted migration names or
  compatibility support in server tests/scripts.
- Known external baseline failures remain those recorded in M0: the normal
  local PostgreSQL credential mismatch blocks the full E2E suite, and two
  static-diagnosis acceptance assertions remain. The isolated M2 database
  itself passed all schema/seed/catalog gates.
- Next safe task: Milestone 3.1 Identity ownership cutover.

### M3.1 handoff

- Starting SHA: `4ab478b4635c10235232e01c1f5ac046b3c767f5`; implementation SHA:
  `eef0ca1e5604fdae932f6bdefcf2c045811ffb96`; commit:
  `refactor(identity): consolidate account ownership`.
- Applicable authority: the approved architecture plan sections 4, 5, 8.5,
  9, 15, and 17; ADR 0001, ADR 0005, ADR 0006, and ADR 0007; the Identity
  migration inventory above; and the approved pre-deployment contract
  research note.
- Moved server authentication and user administration into
  `server/src/modules/identity/`, including the flat Identity controller,
  service, access-token/session implementations, guards/decorators, identity
  user projection, and `user-administration/` capability. Moved client session,
  sign-in, and routing behavior into `client/src/features/auth/`, moved user
  management contracts into `client/src/features/user-management/`, and moved
  Admin user presentation into `client/src/workspaces/admin/users/`. Updated
  every in-repository caller directly and removed the unused session type
  forwarding file.
- Identity responses now contain identity fields only: course summaries were
  removed from sign-in/current-user responses, refresh and logout accept only
  the parsed HttpOnly cookie at the HTTP boundary, and JSON refresh-token
  response fields are absent. Rotation, hashed storage, password-change
  invalidation, cookie path/SameSite/production Secure behavior, disable and
  password-reset revocation, last-active-admin protection, and audit writes
  remain covered by the existing transaction-aware implementation and tests.
- The backend Admin module no longer owns user administration. Its remaining
  composition imports Identity only for the narrow module-level integration;
  Identity internals such as PasswordHasher and repositories are not exported.
  The server dependency graph now enforces `identity-interface-only`: other
  product modules may consume only the Identity module, request guard, role and
  public decorators, and identity types.
- Removed `server/src/modules/auth/**`,
  `server/src/modules/admin/users/**`, `server/test/support/auth-test-store.ts`,
  `server/test/support/auth-service-test-harness.ts`, the old root auth/admin
  user E2E paths, `client/src/features/auth/{api,components,hooks,schemas,stores,types,utils}`
  as authored paths, and the old Admin-user client transport/UI locations.
  Repository searches found no old module paths/classes or JSON refresh fields;
  `/api/v1/auth/*`, `/api/v1/admin/users`, and generated route-tree names remain
  intentional product URLs/route identifiers.
- Focused commands and exact outcomes: `npm run typecheck` passed;
  `npm run test:architecture` passed (331 client modules / 1,331
  dependencies, 392 server modules / 1,421 dependencies); the client Identity
  test selection passed 10 files / 96 tests; the Identity unit selection
  passed 3 suites / 28 tests; the OpenAPI E2E passed 1 suite / 13 tests; the
  moved Identity E2E selection passed 4 suites / 73 tests; and `npm run check`
  passed formatting, strict lint, typecheck, architecture, 9 root tests, 476
  client tests, 1,723 server tests, and both production builds.
- No schema, migration, seed, or generated Prisma source was changed in M3.
  Known external baseline failures remain those recorded in M0: the normal
  local PostgreSQL credential mismatch blocks the unisolated full E2E suite,
  and two static-diagnosis acceptance assertions remain. The isolated M2
  database verification remains green.
- Next safe task: Milestone 4.1, beginning the Courses ownership cutover.

## Milestone 4 migration inventory

Courses, Materials, and Audit become the owners of their current Admin
operations in this slice. The `/api/v1/admin/*` URLs remain presentation
routes, but no server module named Admin owns product behavior after the
cutover.

| Current surface | Target surface | Disposition |
| --- | --- | --- |
| `server/src/modules/admin/courses/**` | `server/src/modules/courses/**` and `server/src/modules/materials/**` | Move course catalog/membership commands and contracts into Courses; move material metadata commands and contracts into Materials; retain one repository per owner. |
| `server/src/modules/admin/courses/admin-courses.audit.service.ts` | `server/src/modules/courses/course-audit.ts` | Move course/membership audit composition to Courses and make Audit the query owner. |
| `server/src/modules/admin/audit/**` | `server/src/modules/audit/**` | Move the recent-event controller and response contract to Audit; keep `/api/v1/admin/audit` as the role workspace route. |
| `server/src/modules/courses/{courses.repository,courses.service,courses.dto}.ts` | consolidated Courses capability | Merge existing accessible-course behavior with catalog/membership administration; active `removedAt IS NULL` membership is the single access/count rule. |
| `server/src/modules/materials/**`, `server/src/modules/rag-persistence/**` | consolidated Materials capability | Keep upload/processing/indexing behavior together; fold chunk/embedding persistence into Materials and delete the duplicate RAG module. |
| `server/src/modules/retrieval/**` | Materials-owned course evidence seam | Preserve current exact course-scoped retrieval behavior behind the Materials owner for the later Tutoring interface; delete duplicate ownership where no caller remains. |
| `client/src/features/admin/{data,hooks,schemas}` course/material transport | `client/src/features/courses`, `client/src/features/materials` | Move contracts, queries, and mutations to domain features; update Admin and role callers directly. |
| `client/src/features/admin/{data,hooks,schemas}` audit transport | `client/src/features/audit` | Move audit query/contract to Audit ownership. |
| `client/src/features/admin/{components,pages}` course/material UI | Admin workspace presentation using domain features | Keep role-specific presentation under Admin workspace paths without backend Admin ownership. |
| course/membership/material/audit unit and E2E tests | adjacent Courses/Materials/Audit tests | Move and update tests to assert active-membership filtering, atomic commands, ingestion ownership, audit reads, and removed-membership non-authorization. |
| `dependency-cruiser.config.mjs` | incremental Courses/Materials/Audit rules | Enable named ownership rules only after the moved callers and duplicate repositories are gone; no baseline or exception list. |

M4 may delete only the superseded Admin course/material/audit paths, the
duplicate RAG persistence path, and duplicate retrieval ownership after direct
callers and focused tests pass. No Prisma schema change is expected in this
slice; any discovered schema change must regenerate the same rolling initial
migration and repeat the M2 catalog/drift gate.

### M4 handoff

- Starting SHA: `d9cde9f6697d075c47af4a666ab766e21263e9ff`; implementation SHA:
  `050f40d`; commit: `refactor(domains): consolidate course material and audit
  ownership`.
- Courses now owns catalog administration, active memberships, course access,
  material-management authorization, and course/membership audit composition.
  The single `CoursesRepository` owns the administration and access records;
  membership listing, counting, authorization, removal, and role changes all
  apply `removedAt IS NULL`, with removal and role changes conditionally
  updating the active row inside their audit transaction.
- Materials now owns Admin material listing/detail/title updates and the
  moved chunk/vector repository and embedding service. Material title updates
  and their `material.updated` audit event share one transaction. The Admin
  material contract contains only fields used by the current workspace; storage
  paths, hashes, extraction counts, chunk counts, and extraction errors are
  not exposed. Materials receives one Courses authorization decision per
  course-scoped request and no longer performs a duplicate course-existence
  preflight.
- Audit now owns the recent-event controller and contract. The old backend
  Admin composition, Admin course/material/audit implementation paths, and
  `rag-persistence` module are deleted. Client course, material, and audit
  contracts/queries/mutations live under their named features; Admin UI remains
  role presentation under `workspaces/admin`, and browser `/admin/*` routes
  remain unchanged.
- Added the named `audit.public.ts` and `course-access.public.ts` seams and
  enabled `courses-interface-only`, `materials-interface-only`, and
  `audit-interface-only` dependency-cruiser errors without baselines or
  exceptions. Production callers no longer reach through those capability
  boundaries.
- Focused results: Courses/Materials/Audit unit selection 5 suites / 22 tests;
  client domain/workspace selection 4 files / 22 tests; Courses, Materials,
  and course-administration E2E selection 3 suites / 67 tests; course
  administration plus OpenAPI E2E 2 suites / 42 tests; isolated Materials
  chunk persistence 1 suite / 14 tests; and the removed-membership regressions
  passed. `npm run check` passed formatting, lint, typecheck, architecture,
  9 root tests, 476 client tests, 1,705 server tests, and both production
  builds. Architecture reported 335 client modules / 1,341 dependencies and
  393 server modules / 1,424 dependencies with no violations.
- Repository searches found no authored `server/src/modules/admin` or
  `server/src/modules/rag-persistence` files, no old Admin/RAG controller or
  repository imports, and no duplicate course-access repository. No Prisma
  schema or migration changed in M4, so the audited rolling initial migration
  remains the M2 artifact.
- Known external baseline limitations remain: the unisolated full server E2E
  command uses the existing local PostgreSQL credential mismatch, and the
  acceptance suite retains its two pre-existing static-diagnosis presentation
  failures. The disposable database path is green when run with its isolated
  Compose credentials.
- Next safe task: Milestone 5.1 Reviews and Student inbox vertical slice.

## Milestone 1 migration inventory

Milestone 1 establishes the durable guidance and enforcement inputs that every
later migration depends on. The affected surface is intentionally limited to
repository guidance, domain vocabulary, accepted architectural decisions,
test discovery, dependency-cruiser configuration/scripts, client alias
resolution, and the migration ledger itself.

| Area | Files/paths to add or change | Ownership and disposition |
| --- | --- | --- |
| Repository guidance | `AGENTS.md`, `CONTEXT.md` | Record the approved architecture authority, non-negotiable ownership/dependency rules, and canonical domain terms. |
| Architecture decisions | `docs/adr/0001-*.md` through `0007-*.md` | Add the seven accepted ADRs required by the plan; these are decision records, not migration checklists. |
| Dependency enforcement | `dependency-cruiser.config.mjs`, root `package.json`, `package-lock.json` | Add the initial no-cycle, unresolved-import, and production-to-test gate; generated files are not followed. |
| Test discovery | `client/vite.config.ts`, `server/package.json`, `server/test/jest-e2e.json`, `server/test/jest-live-e2e.json` | Make unit, E2E, live, and client test patterns explicit and independent of regex defaults. |
| Import resolution | `client/package.json`, `client/tsconfig.json`, `client/tsconfig.architecture.json`, current `#/` callers | Remove the redundant `#/*` alias, update all direct callers to the canonical `@/*` alias, and keep resolver-only `baseUrl` configuration out of the product compiler contract. |
| Focused verification | `npm run test:architecture:client`, `npm run test:architecture:server`, `npm run test:architecture` | The gate must pass without known-violation baselines or temporary exceptions before the milestone commit. |

## Milestone 2 migration inventory

Milestone 2 is the first schema cutover. The historical migration chain is
evidence only and is replaced after this inventory is committed to the working
tree. The complete object-level reconciliation is recorded in
`docs/architecture-baseline/prisma-net-live-inventory.md`.

| Area | Files/paths to add, change, or delete | Disposition and verification |
| --- | --- | --- |
| Prisma configuration | `server/prisma.config.ts`, `server/prisma/README.md` | Load the `server/prisma/` directory and document the rolling initial history, explicit seed, exact vector scan, and absent HNSW index. |
| Authored schema | `server/prisma/schema.prisma`, `identity.prisma`, `courses-and-materials.prisma`, `conversations.prisma`, `tutoring.prisma`, `reviews.prisma`, `audit.prisma` | Keep the entry file to generator/datasource configuration and split the current semantic model into cohesive domain files. |
| Migration history | The 18 historical directories under `server/prisma/migrations/` | Delete the exact historical directories after the net-live inventory is captured; create one generated `*_initial/migration.sql`; retain `migration_lock.toml`. Data-upgrade backfills and duplicate-data guards are not reproduced in blank history. |
| Seed and generated output | `server/prisma/seed.ts`, `server/src/generated/prisma/` | Keep explicit seed behavior; regenerate Prisma output through `npm run db:generate`; generated output remains ignored and is never hand-edited. |
| Catalog assertions | New `server/prisma/assert-catalog.mts` and focused schema E2E coverage | Assert extensions, enum/table/index/check/FK/trigger contracts, vector dimensions, and HNSW absence against a blank migrated database. |
| Disposable verification | `server/test/support/disposable-database.ts`, `server/test/fresh-seed-review-readiness.e2e-spec.ts`, migration-history tests | Replace upgrade-path assumptions with initial-history count, explicit seed, catalog, and drift assertions. Historical upgrade tests are deleted in Milestone 7 after the replacement gate is established. |
| Operational documentation | `docs/architecture-baseline/prisma-net-live-inventory.md`, this ledger | Record every retained, omitted, and deliberately dropped database object and the exact M2 commands/results. |

### M2 handoff fields

The M2 handoff must record the starting and final SHAs, all schema/config/test
files added or deleted, the exact initial migration directory, catalog and
drift commands, generated-output ownership proof, disposable database result,
remaining baseline failures, and the next safe task (Milestone 3). The exact
historical migration names and their net-live objects must remain available in
the inventory document as labeled historical evidence.

## Milestone 3 migration inventory

Identity is the owner of authentication, credentials, refresh sessions, access
guards, users, and user administration. This slice changes public response
contracts and therefore updates every server/client caller directly.

| Current surface | Target surface | Disposition |
| --- | --- | --- |
| `server/src/modules/auth/**` | `server/src/modules/identity/**` | Move and flatten into named Identity files; delete the `auth` module and exports. |
| `server/src/modules/admin/users/**` | `server/src/modules/identity/user-administration/**` | Move controller, contracts, repository, audit, service, errors, and focused unit tests under Identity ownership. |
| `server/src/modules/admin/admin.module.ts` | Identity/Courses/Materials composition | Remove user providers/controllers/imports from the Admin composition; Admin user behavior is no longer a backend Admin domain. |
| `server/src/app.module.ts`, capability imports, guards, decorators | `identity.module.ts` and named Identity interfaces | Update all callers to direct Identity ownership without compatibility re-exports. |
| `server/test/auth*.e2e-spec.ts`, `roles-guard.e2e-spec.ts`, `rbac.e2e-spec.ts`, `admin-users*.e2e-spec.ts` | `server/test/identity/` | Move/update tests for cookie-only refresh, user-only auth responses, revocation, role protection, user administration, and atomic audit behavior. |
| `client/src/features/auth/**` | `client/src/features/auth/session`, `sign-in`, `routing` | Move session transport/store/refresh, sign-in contract/UI, and protected-route behavior into named slices. |
| `client/src/features/admin` user transport/contracts and user UI | `client/src/features/user-management`, `client/src/workspaces/admin/users` | Move owned contracts to the feature and presentation to the Admin workspace; delete old user paths. |
| `client/src/routes`, route loaders, auth callers | thin route adapters + named Identity feature interfaces | Update route/session callers directly; no aliases or redirect compatibility layer. |
| Auth DTO/schema/OpenAPI tests and characterization | Identity contract tests | Remove course summaries and JSON refresh fields; assert only the secure HttpOnly cookie carries refresh tokens. |
| `server/prisma/identity.prisma`, refresh-session persistence | keep | No schema change in M3; preserve hashed rotation/revocation/password-change invariants. |
| `docs/architecture-baseline/migration-ledger.md` | this entry and M3 handoff | Record exact moved/deleted paths, focused commands, boundary rules, and final SHA. |

M3 may delete only the superseded Auth/Admin-user paths and their compatibility
exports/tests. Courses, Materials, Audit, and later Admin presentation remain
owned by their current slices until their approved milestones.

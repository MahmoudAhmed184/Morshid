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

## Milestone 5 migration inventory

Reviews becomes the owner of review intake, evidence, Instructor resolution,
and the Student Review Inbox in this slice. The generic Notifications
capability is deleted; no compatibility route, alias, or forwarding module is
introduced.

| Current surface | Target surface | Disposition |
| --- | --- | --- |
| `server/src/modules/reviews/review-case.creator.ts`, `review-case.repository.ts`, and automatic review callers | Reviews intake interface and evidence implementation | Add one batch automatic-intake operation that accepts all trigger reasons in one transaction, preserves replay/idempotency, and returns one case result; update every caller directly. |
| `server/src/modules/reviews/automatic-review-evidence.ts`, `review-evidence-integrity.ts`, output-policy evidence builder, and detail-parser schema | `server/src/modules/reviews/evidence/**` | Colocate one bounded evidence schema, builder, parser, canonical serializer, and content-hash implementation; remove optional/duplicate evidence shapes and import the named implementation directly. |
| `server/src/modules/notifications/**` and all notification callers/tests | `server/src/modules/reviews/student-inbox/**` | Move list, unread count, read transition, safe presentation, controller, and focused persistence tests into Reviews; delete the generic module, routes, DTOs, and tests. |
| Prisma `Notification`, `NotificationType`, `NotificationStatus`, JSON metadata, dismissed state, and notification indexes/constraints | Reviews-owned inbox model in `server/prisma/reviews.prisma` and the rolling initial migration | Replace the generic schema with direct course/session/message/review identifiers, retain only current resolved/rejected and unread/read behavior, and remove unused fields/states. Reconcile the same initial migration, regenerate, reset a disposable database, seed explicitly, assert the catalog, and prove no drift. |
| Review detail/summary notification counts and `hasNotification` fields | Review-owned terminal/inbox contracts | Remove notification-specific fields and duplicate contract enums; retain only current review state and direct review identifiers. |
| `client/src/features/notifications/**` and notification course resolver | `client/src/features/reviews/student-inbox/**` plus Student workspace control | Move transport, schemas, queries, hooks, and bell presentation into the Reviews feature and Student workspace; navigate directly with `courseId`, `sessionId`, and `messageId` without course probing or preflight fetches. |
| `client/src/features/instructor/{data,instructor-review.schema.ts,hooks}` and `client/src/features/student/data/student-reviews*` | `client/src/features/reviews/{interface,instructor-queue,student-inbox}` | Move Review contracts and query/mutation behavior to the named Review feature; update Instructor and Student presentation callers directly and delete old feature-owned Review transport paths. |
| Review, inbox, manual/automatic journey, atomicity, replay, concurrency, navigation, and OpenAPI tests | Adjacent Reviews capability tests and journey E2E coverage | Update assertions and fixtures to the Reviews-owned inbox schema/API; add batch trigger, direct navigation, removed-membership authorization, atomic audit/inbox rollback, and idempotent read coverage. |
| `dependency-cruiser.config.mjs` | Reviews boundary rule | Enable a production `reviews-interface-only` rule after all cross-capability callers use `reviews.module.ts` or a named Reviews interface; no baselines or temporary exceptions. |
| `server/prisma/assert-catalog.mts`, fresh-schema/readiness tests, schema inventory, plan, and this ledger | current Reviews schema documentation | Replace generic notification catalog assertions with the final Reviews inbox objects and record every deliberate deletion and verification result. |

### M5 handoff

- Starting SHA: `1b58167`; implementation SHA: `581b8d9`; commit:
  `refactor(reviews): consolidate intake and student inbox`.
- The automatic intake contract is one `ReviewCaseCreator.createAutomaticBatch`
  call containing the message identifier, all trigger/source-event-key and
  detector-metadata records, one canonical evidence contribution, and the
  optional audit request context. Reviews canonicalizes the contribution once,
  creates/replays all triggers in one transaction, and rolls the entire batch
  back when any trigger cannot be created. The output-policy adapter now sends
  one batch for all detected reasons.
- Evidence is owned by `server/src/modules/reviews/evidence/**`. The shared
  implementation now contains the builder, strict versioned parser, bounded
  canonical snapshot, automatic contribution serializer, and content-hash
  inputs. The snapshot limit remains 128 KiB; source, citation, retrieval, and
  fact bounds are enforced by the canonical implementation. The former
  `server/src/modules/reviews/automatic-review-evidence.ts` and
  `review-evidence-integrity.ts` entry points were moved into that directory;
  the old output-policy evidence mapping was deleted.
- Reviews owns the Student Review Inbox. The old backend
  `server/src/modules/notifications/{notifications.controller.ts,notifications.dto.ts,notifications.errors.ts,notifications.module.ts,notifications.repository.ts,notifications.service.ts}`
  was deleted. Its current controller, DTO, errors, repository, service, and
  unit tests now live under `server/src/modules/reviews/student-inbox/`; the
  persistence E2E moved to
  `server/test/reviews/student-review-inbox.persistence.e2e-spec.ts`. The
  client notification bell, transport/schema/query/hook files, and
  `resolve-notification-course.{ts,test.ts}` were deleted or moved into
  `client/src/features/reviews/student-inbox/`, with the control presented by
  the Student workspace.
- The final inbox table is `review_inbox_items` with direct
  `recipient_user_id`, `review_case_id`, `course_id`, `session_id`, and
  `message_id` identifiers, `REVIEW_RESOLVED`/`REVIEW_REJECTED` types, and
  `UNREAD`/`READ` status. It has the recipient/review unique constraint and
  recipient-created lookup index. The API is:
  `GET /api/v1/reviews/inbox`,
  `GET /api/v1/reviews/inbox/unread-count`, and
  `POST /api/v1/reviews/inbox/:inboxItemId/read`.
  Student controls navigate directly with course, session, and message IDs;
  no course-probing resolver or discarded preflight request remains. Inbox
  creation stays in the same transaction as terminal review state, action
  history, idempotency, and audit.
- Instructor queue/detail/action authorization now calls the named Courses
  `CourseAccessService` active-membership interface. The queue's final list
  predicate and terminal action transaction retain active-membership conditions
  as race-safe defense-in-depth. Removed memberships therefore cannot list,
  view, or resolve a review.
- Client Review contracts moved from Instructor/Student ownership into
  `client/src/features/reviews/{interface,instructor-queue,student-inbox}`;
  Student chat now consumes the Review-owned summary contract. Student shell
  and layout moved to `client/src/workspaces/student/`. Instructor and Student
  pages, hooks, fixtures, and acceptance journeys were updated directly; no
  compatibility aliases were added.
- Prisma verification for the changed rolling initial migration:
  `node --input-type=module -e "..."` combined the seven authored schema
  files into `/tmp/morshid-m5-schema.prisma`; `npx prisma migrate diff
  --from-empty --to-schema /tmp/morshid-m5-schema.prisma --script -o
  /tmp/morshid-m5-generated.sql` regenerated the complete schema and was
  reconciled by hand in `20260811150000_initial/migration.sql`. The isolated
  `morshid-m2-20260811` Compose database was dropped/recreated, then
  `DATABASE_URL=... SHADOW_DATABASE_URL=... npm run db:migrate:deploy
  --workspace server`, explicit `npm run db:seed --workspace server`, and
  `npm run db:assert-catalog --workspace server` all passed. The catalog
  asserts the inbox table, enums, indexes, check, and five foreign keys. The
  final `npx prisma migrate diff --from-migrations prisma/migrations
  --to-config-datasource --exit-code --config prisma.config.ts` returned
  `No difference detected.` The removed HNSW and response-identity indexes
  remain absent.
- Focused verification passed: Reviews/client selection (13 client files,
  151 tests); server Reviews unit selection (7 suites, 51 tests, with the
  later authorization selection also green); isolated persistence/readiness
  E2E (4 suites, 25 tests); isolated review journey/safety/OpenAPI E2E (4
  suites, 28 tests); `npm run test:architecture` (334 client modules/1,332
  dependencies and 394 server modules/1,431 dependencies, no violations);
  `npm run check` (9 root tests, 60 client files/468 tests, 117 server
  suites/1,703 tests, architecture checks, and production builds); and the
  standalone `npm run build`.
- The production `reviews-interface-only` dependency-cruiser rule is enabled
  without a baseline or exception list. Searches across `server/src`,
  `server/test`, `client/src`, and `tests/acceptance` found no generic
  Notifications module/path/import, `hasNotification`, notification resolver,
  duplicate evidence entry point, or legacy notification endpoint. Historical
  baseline/ledger references are retained only as migration history.
- Known baseline limitations remain unchanged: the unisolated full server E2E
  path uses the local PostgreSQL credential mismatch, and the acceptance suite
  retains its two pre-existing static-diagnosis presentation failures. The
  isolated disposable database path is green with its explicit Compose
  credentials. No live model check was required for this deterministic M5
  slice.
- Next safe task: Milestone 6A — introduce the final Tutoring Attempt and
  admission transaction, delete duplicate attempt state, and prove the
  duplicate persistence path absent before commit.

## Milestone 6A migration inventory

Milestone 6A establishes the single persisted Tutoring Attempt and the atomic
admission seam that later Tutoring runtime work will consume. The cutover is
deliberately direct: all authored callers, persistence adapters, fixtures, and
contract tests move together, while the message-owned grounding lease fields
and the former TutorTurn model are deleted.

| Area | Files/paths to add, change, or delete | Disposition and verification |
| --- | --- | --- |
| Authored schema | `server/prisma/tutoring.prisma`, `server/prisma/conversations.prisma` | Rename the authoritative aggregate and its related persistence records to Tutoring Attempt terminology; add attempt claim/lease/version, request/strategy, retry, and Student/Assistant relationship state; remove message-owned grounding state. |
| Rolling migration | `server/prisma/migrations/20260811150000_initial/migration.sql`, `server/prisma/assert-catalog.mts` | Reconcile the same initial migration from an empty schema; remove grounding columns/indexes and old TutorTurn objects; assert the final attempt tables, enums, constraints, indexes, and foreign keys. |
| Attempt persistence | `server/src/modules/socratic-tutor/turn.repository.ts`, `turn.service.ts`, `turn.types.ts`, related Socratic callers/tests | Directly migrate the current state machine to Tutoring Attempt persistence and names; no second aggregate or compatibility repository remains. |
| Conversation admission | `server/src/modules/conversations/**`, `server/src/modules/student-chat/**`, `server/src/modules/student-chat/grounded-chat-turn.repository.ts` | Introduce the transaction-aware ConversationTurns admission boundary; create/replay the Student message, pending Assistant message, and RECEIVED Attempt atomically; move lease/expiry decisions to Attempt state. |
| API/client contracts | Student chat DTOs, presenter/repository types, client chat schemas/fixtures, OpenAPI and acceptance fixtures | Replace the public turn identifier with the authoritative attempt identifier and update every caller directly; do not retain aliases. |
| Regression coverage | Attempt admission/replay/concurrency/lease tests, message linkage and Socratic persistence tests | Prove one attempt per client key, replay identity, transaction rollback, concurrent admission serialization, retry relationship, lease expiry, and absence of grounding/TutorTurn state. |
| Documentation/search | This ledger, ADR 0002/0007 references, architecture scans | Record the exact schema and focused verification; repository searches must find no authored `TutorTurn` or `groundingAttemptId` entry point before the 6A commit. |

### M6A handoff

- Starting SHA: `15a76dd076402cb61c1f1e02c9f98e8170568b7d`; implementation SHA:
  `6f0ae3d`; commit: `refactor(tutoring): establish authoritative attempt
  admission`.
- Applicable authority: the approved architecture refactor plan; ADR 0002
  (one Tutoring Runtime and one Tutoring Attempt); ADR 0007 (opaque database
  transaction participation); and the approved research notes on NestJS/Prisma
  organization, clean-slate Prisma migration, and broad-refactor safety.
- `TutoringAttempt` is now the persisted aggregate name and owns client-message
  replay identity, claim/lease/version state, request kind, teaching strategy,
  Student/Assistant message relationships, terminal outcome, retry lineage,
  approval/fallback metadata, and review-required state. The former
  `TutorTurn`/`TutorCandidateAttempt` names and `Message.groundingAttemptId`
  plus grounding lease fields are removed from the authored schema, migration,
  repositories, tests, client contracts, and scripts. Retry attempts reuse the
  authoritative Student/Assistant records through `retryOfAttemptId`; the
  composite `(sessionId, clientMessageId)` constraint remains the replay key.
- Added `server/src/modules/conversations/{conversation-turns.ts,
  conversations.module.ts,prisma-conversation-turns.ts}` and
  `server/src/modules/prisma/database-transaction.ts`. The product-facing
  `ConversationTurns` interface accepts only the opaque `DatabaseTransaction`
  marker; Prisma transaction types remain inside the platform adapter. Student
  chat admission now creates/replays the message pair and attempt in the
  caller-owned transaction, and lease expiry/retry decisions read Attempt
  state rather than Message grounding columns.
- Changed the rolling `20260811150000_initial/migration.sql` from an empty
  schema diff, reconciled the generated output and retained handwritten
  extensions/constraints/triggers, removed duplicate custom inbox indexes, and
  updated `server/prisma/assert-catalog.mts`. The isolated disposable database
  was reset, migrated, explicitly seeded, catalog-asserted, and checked for
  drift. The catalog passed and
  `npx prisma migrate diff --from-migrations prisma/migrations
  --to-config-datasource --exit-code --config prisma.config.ts` returned
  `No difference detected.`; the HNSW and grounding indexes remain absent.
- Added/updated persistence, retry, replay, lease, message-linkage, Socratic,
  OpenAPI, client fixture, and acceptance callers directly. No compatibility
  aliases or forwarding modules were added. No product path was deleted in
  this slice; the superseded state was removed in-place and the new
  Conversations adapter was introduced for the next Tutoring Runtime slice.
- Verification: `npm run check` passed (root 9 tests, client 60 files/468
  tests, server 117 suites/1,703 tests, architecture checks, and client/server
  production builds); server/client formatting and typechecks passed; server
  CI lint passed; architecture passed with 334 client modules/1,332
  dependencies and 398 server modules/1,443 dependencies; focused isolated
  E2E passed (5 suites, 44 tests); `npx prisma validate` passed; catalog and
  drift checks passed; `git diff --check` passed.
- Obsolete-entry searches across `server/src`, `server/test`, `client/src`,
  `tests/acceptance`, and authored `server/prisma` found zero matches for
  `TutorTurn`, `tutor_turn`, `TutorCandidateAttempt`,
  `tutor_candidate_attempt`, `groundingAttemptId`, `grounding_attempt_id`,
  `groundingLeaseExpiresAt`, and `grounding_lease_expires_at`. The remaining
  generic UI `forwardRef` calls are React ref forwarding, not NestJS DI
  `forwardRef` architecture.
- Known baseline limitations remain unchanged: the unisolated full server E2E
  path uses the local PostgreSQL credential mismatch, acceptance retains the
  two pre-existing static-diagnosis presentation failures, and live model
  checks were not run without their documented credentials. The isolated
  deterministic path is green.
- Next safe task: Milestone 6B — introduce `TutoringRuntime.run` and switch
  the chat HTTP/application adapter to the single runtime interface.

## Milestone 6B migration inventory

Milestone 6B places the chat application path behind the final Tutoring
runtime boundary and removes the workflow's second attempt admission lookup.
The existing implementation remains private behind that interface only until
the later Tutoring workflow and ownership cutovers.

| Area | Files/paths to add, change, or delete | Disposition and verification |
| --- | --- | --- |
| Runtime interface | `server/src/modules/tutoring/interface/**`, `server/src/modules/tutoring/tutoring.module.ts` | Add the discriminated new-turn/retry command, caller-safe receipt, and one `TutoringRuntime.run` interface without Prisma or HTTP DTO imports. |
| HTTP/application adapter | `server/src/modules/student-chat/student-chat.controller.ts`, `student-chat.module.ts`, `grounded-chat.service.ts`, `student-chat.service.ts`, `app.module.ts` | Inject the runtime at the chat boundary; retain session/transcript operations in their current slice; bind the existing pipeline as the private implementation and pass only Student identity plus request context/budget. |
| Workflow cutover | `server/src/modules/student-chat/socratic-chat.types.ts`, `socratic-chat.orchestrator.ts`, `grounded-chat-turn.repository.ts`, `server/src/modules/socratic-tutor/turn.repository.ts` | Use the already-admitted Attempt identifier, remove the second `getOrCreate`/replay branch and redundant message-link admission, and make approved/classified finalization match the pre-linked Assistant identity. |
| Regression coverage | `server/src/modules/student-chat/grounded-chat.service.spec.ts`, `socratic-chat.orchestrator.spec.ts`, Socratic capability E2E | Prove both command variants route through `TutoringRuntime`, the workflow does not reacquire an Attempt, and all happy-path, retry, fallback, policy, and replay branches still use one Attempt. |
| Architecture/search | `dependency-cruiser.config.mjs`, this ledger, authored current paths | Keep the graph green; search for direct controller-to-legacy runtime coupling and duplicate workflow admission before the 6B commit. |

### M6B handoff

- Starting SHA: `d795ff114670f215b5ad4a513b285682c05fbcc9`; implementation SHA:
  `ba4c63b6d607c4228713d9b0dedd57f1d8cf3516`; commit:
  `refactor(tutoring): introduce runtime boundary`.
- Applicable authority: the approved architecture refactor plan; ADR 0002
  (one Tutoring Runtime and one Tutoring Attempt); ADR 0007 (opaque database
  transaction participation); and the approved research notes on NestJS/Prisma
  organization, clean-slate contracts, and broad-refactor safety.
- Added the final interface paths
  `server/src/modules/tutoring/interface/{run-tutoring-turn-command.ts,
  tutoring-runtime.ts,tutoring-turn-receipt.ts}` plus the composition module.
  The command is a discriminated new/retry union, and the receipt is a
  caller-safe domain contract with no Prisma or HTTP DTO imports. `TutoringRuntime.run`
  is the only runtime entry point exposed to the Student Chat controller.
- Student Chat now binds `GroundedChatService` behind the runtime token and
  the controller supplies only the authenticated Student identifier, chat
  scope, submitted content/identity, audit context, and request budget. The
  existing pipeline remains private behind that interface for the next direct
  Tutoring ownership cutover; no compatibility runtime or forwarding endpoint
  was added.
- The Socratic workflow now consumes the Attempt created by 6A. Its second
  `TurnService.getOrCreate`/completed-replay branch and redundant student
  message-link admission were deleted. Approved and classified response
  finalization now matches the already-linked Assistant record instead of
  requiring an absent Assistant relationship. This keeps one admission and
  one Attempt state machine while preserving terminal replay in the admission
  repository.
- Tests added/updated: runtime new/retry dispatch unit coverage and workflow
  admission-boundary coverage. The focused runtime unit selection passed (2
  suites, 19 tests); the isolated Socratic capability E2E passed (1 suite, 21
  tests); and the full repository gate passed: `npm run check` with root 9
  tests, client 60 files/468 tests, server 117 suites/1,705 tests, architecture
  checks, and production builds. Architecture passed with 334 client
  modules/1,332 dependencies and 402 server modules/1,445 dependencies.
- `npm run typecheck --workspace server`, serial server CI lint,
  `npm run test:architecture`, `git diff --check`, and formatting checks passed.
  The schema was unchanged in 6B, so no new migration or catalog reset was
  required; the 6A audited initial migration remains the database source.
- Searches show no controller import of `GroundedChatService`, no production
  workflow `getOrCreate` admission call, and no direct runtime alias. The
  legacy implementation symbols remain only in their private implementation
  files and focused tests until 6E deletes those paths.
- Known baseline limitations remain unchanged: unisolated full server E2E
  still has the local PostgreSQL credential mismatch, acceptance retains two
  pre-existing static-diagnosis presentation failures, and live model checks
  were not run without their documented credentials. The deterministic isolated
  capability path is green.
- Next safe task: Milestone 6C — move course-scoped evidence behind Materials'
  `CourseEvidence` and route code diagnosis through the generic Socratic
  workflow.

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

## Milestone 6C migration inventory

Starting SHA: `decde741ae2e30e95023b6c2544f66795d1676d8`.

Milestone 6C moves course-scoped evidence acquisition into Materials and routes
code diagnosis through the existing Socratic workflow. The slice is schema
neutral; the audited rolling initial migration and seed remain unchanged.

| Area | Files/paths to add, change, or delete | Disposition and invariants |
| --- | --- | --- |
| Materials evidence boundary | `server/src/modules/materials/course-evidence.ts`, `course-evidence.repository.ts`, adjacent specs; `server/src/modules/retrieval/**` | Move and rename the retrieval implementation into Materials. Export only `CourseEvidence.search(courseId, query, requestBudget?)` and sanitized evidence/result types; keep vectors, chunks, Prisma, readiness, and storage details behind the Materials implementation. Delete the Retrieval module and its old paths. |
| Module composition | `server/src/modules/materials/materials.module.ts`, `materials.module.spec.ts`, `server/src/app.module.ts`, `server/src/modules/student-chat/student-chat.module.ts` | Bind and export the Materials-owned CourseEvidence token; remove RetrievalModule composition and update direct consumers. |
| Socratic workflow | `server/src/modules/student-chat/socratic-chat.orchestrator.ts`, `socratic-chat.types.ts`, adjacent spec | Consume CourseEvidence for the one course-scoped search. Carry a generic debugging context through analysis, teaching, generation, validation, and approval; use the debugging evidence query when present. |
| Debugging contract | `server/src/modules/socratic-tutor/debugging-guidance.contract.ts`, `.spec.ts`, `tutor-prompt.builder.ts`, `tutor-model.adapter.ts`, `deterministic-guard.service.ts`, response-validation/context/generation files | Add language-neutral `DEBUGGING_GUIDANCE` and `TRACE_EXECUTION` contracts with four required sections, one inspection action, authorized citations, prompt-disclosure protection, no execution claims, and no complete-program rewrite. |
| Analysis and approval propagation | `analysis-model.provider.ts`, `response-approval.service.ts`, `structural-response.validator.ts`, `tutor-generation.service.ts`, `turn.repository.ts`, focused specs | Classify deterministic code-diagnosis requests as a generic debugging strategy, pass the context into prompt/generation/approval, and enforce the contract in deterministic validation while preserving Safe Fallback metadata on the authoritative Attempt. |
| Student application path | `server/src/modules/student-chat/grounded-chat.service.ts`, its focused specs and diagnosis-failure specs | Remove the dedicated diagnosis retrieval/completion path. Send diagnosis through the single Socratic orchestrator with a generic debugging context; retain only the runtime-private application adapter pending 6D/6E. |
| Capability and live/E2E callers | `server/test/grounded-chat.e2e-spec.ts`, `socratic-chat.e2e-spec.ts` support callers, `gate-2.e2e-spec.ts`, `material-processing.e2e-spec.ts`, retrieval-readiness and turn E2E callers, Gemini fixture | Update module injection and evidence types/names directly, prove generic diagnosis headings/citations and no execution/full rewrite, and prove provider failure returns a replayable Safe Fallback on one Attempt. |
| Residual documentation/search | this ledger and current authored imports | Prove no source/test import or module path targets `server/src/modules/retrieval`; historical plan/ledger evidence may retain labeled old names until the final 6E/8 cleanup. |

The next 6C implementation pass must run the focused unit suites, isolated
Socratic and Grounded capability E2E suites, typecheck/lint, architecture,
formatting, and the full repository gate before the implementation commit.

### M6C handoff

- Starting SHA: `decde741ae2e30e95023b6c2544f66795d1676d8`; implementation SHA:
  `2c21611b58a9416ce11de1a9b057dbb12eeebcc0`; commit:
  `refactor(tutoring): route code diagnosis through socratic workflow`.
- Applicable authority: the approved architecture refactor plan; ADR 0002
  (one Tutoring Runtime and one Tutoring Attempt); ADR 0006 (enforced
  dependency graph with explicit named interfaces); ADR 0007 (opaque database
  transaction participation); and the approved NestJS/Prisma, predeployment
  contract, and broad-refactor safety research notes.
- Moved retrieval persistence and service implementation into Materials as
  `CourseEvidenceRepository`, `PrismaCourseEvidenceRepository`,
  `MaterialsCourseEvidence`, and the narrow `CourseEvidence` contract. Added
  `materials.public.ts` and enabled the Materials named-public-interface
  dependency rule. Deleted `server/src/modules/retrieval/retrieval.module.ts`
  and the old Retrieval-owned paths. No Prisma schema, migration, seed, or
  catalog object changed in 6C.
- Added the generic `DebuggingGuidanceContext` and output contract. Code
  diagnosis now uses the same Educational Analysis, Teaching Decision,
  CourseEvidence search, Tutor Generation, deterministic validation, semantic
  approval, and Tutoring Attempt finalization pipeline as other supported
  requests. The contract requires Likely defect, Relevant location, Concept,
  and Next inspection step; exactly one inspection action; authorized course
  evidence; and no execution claim, prompt disclosure, or complete program.
- Removed the dedicated Grounded diagnosis retrieval/completion branch and
  passed diagnosis context through the private Socratic workflow behind
  `TutoringRuntime`. Updated all current callers, adapters, fixtures, and
  focused contracts directly; no compatibility wrapper or alternate endpoint
  was added.
- Tests added or replaced: generic debugging contract unit coverage,
  Materials CourseEvidence ownership and readiness coverage, deterministic
  diagnosis/provider fixtures, Socratic propagation, generic diagnosis E2E,
  and provider-failure Safe Fallback/replay coverage. The focused unit command
  passed 8 suites and 100 tests. The isolated capability command passed 2
  suites and 51 tests.
- Exact focused verification passed:
  `npm run test --workspace server -- --runInBand
  src/modules/materials/course-evidence.spec.ts
  src/modules/materials/course-evidence.repository.spec.ts
  src/modules/socratic-tutor/debugging-guidance.contract.spec.ts
  src/modules/student-chat/grounded-chat.service.spec.ts
  src/modules/student-chat/grounded-chat-diagnosis-failures.spec.ts
  src/modules/student-chat/socratic-chat.orchestrator.spec.ts
  src/modules/socratic-tutor/tutor-model.adapter.spec.ts
  src/modules/socratic-tutor/deterministic-guard.service.spec.ts` (8/100);
  `npm run typecheck --workspace server`; `npm run lint --workspace server
  -- --no-cache`; `npm run test:architecture`; `git diff --check`; and
  `DATABASE_URL=postgresql://m2_owner:m2_disposable_password_20260811@127.0.0.1:55433/m2_schema
  SHADOW_DATABASE_URL=postgresql://m2_owner:m2_disposable_password_20260811@127.0.0.1:55433/m2_schema_shadow
  REDIS_URL=redis://127.0.0.1:56379 npm run test:e2e --workspace server -- --runInBand
  --runTestsByPath ./test/socratic-chat.e2e-spec.ts
  ./test/grounded-chat.e2e-spec.ts --silent` (2/51).
- The canonical `npm run check` passed on the implementation tree: root 9
  tests, client 60 files/468 tests, server 118 suites/1,712 tests, formatting,
  root/server lint, typechecks, architecture, and client/server production
  builds. Architecture reported 334 client modules/1,332 dependencies and
  404 server modules/1,442 dependencies.
- Obsolete-entry verification passed: `rg --files
  server/src/modules/retrieval` returned no files, and the exact symbol search
  for `RetrievalModule|RetrievalService|RetrievedChunk|CourseRetrieval|
  retrieveCourseEvidence` across current source/tests/client/acceptance
  returned no matches. Broader historical Retrieval/Completion/Python names
  remain only in still-active pre-6E paths and will be removed in 6E/8.
- Known limitations remain unchanged: the unisolated full server E2E command
  still requires the local PostgreSQL credentials that are mismatched in the
  developer environment; the baseline acceptance run still has its two
  static-diagnosis presentation failures; and live model checks remain
  unavailable without the documented external credentials. The disposable
  isolated PostgreSQL/Redis capability path is green.
- Next safe task: Milestone 6D — establish transaction-aware finalization,
  Reviews intake, Audit joining, and one private response-governance path with
  rollback, replay, concurrency, retry, lease-expiry, provider-failure, Safe
  Fallback, and repair coverage.

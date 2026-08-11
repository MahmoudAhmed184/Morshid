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
| M0.2 safety baseline and characterization | `1c88713195ec35e42e2c218ead57d08112ab85f5` | pending | pending | `npm run check` passed; `npm run test:e2e` recorded the local PostgreSQL credential blocker; `npm run test:acceptance` recorded 28 passed / 2 existing diagnosis-render failures; OpenAPI snapshot and characterization index added | None intentionally removed | M0.3 commit baseline and open draft PR |

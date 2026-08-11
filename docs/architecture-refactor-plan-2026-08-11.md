# Morshid whole-workspace architecture refactor plan

- **Status:** Approved
- **Decision date:** 11 August 2026
- **Implementation state:** Not started
- **Self-grill:** Complete; owner validation pending
- **Recorded source branch:** feature/socratic-tutor-v1-phase2
- **Recorded source SHA:** 22fc7fbdce59fb2248db39a1bfd7b4d0b86f0480
- **Target implementer:** One GPT-5.6 Luna Max writer
- **Review:** Independent review by the planning agent after implementation

## 1. Outcome

Refactor the entire Morshid workspace into a capability-first architecture with
small, enforceable interfaces, adjacent behavior tests, explicit dependency
direction, and no obsolete compatibility paths.

This is a clean-slate, pre-deployment refactor. There is no deployed website or
database to preserve. Existing data may be discarded and reseeded. HTTP, URL,
authentication, database, fixture, and operational contracts may change when a
specific architectural or product simplification justifies the change.

The API keeps the intentional /api/v1 prefix. Browser URLs are retained or
replaced on the merit of the current information architecture and user
journeys, not for compatibility; all in-repository callers change directly and
no compatibility redirects are added. Deterministic Safe Fallback remains
required safety behavior; it is not compatibility scaffolding.

When goals conflict, use this order:

1. enforceable ownership and dependency boundaries;
2. human and agent navigation;
3. reduced directory crowding and merge-conflict risk;
4. visual uniformity.

## 2. Authority and non-negotiable rules

Apply these rules to every implementation decision:

1. Remove obsolete paths after direct cutover. Keep one implementation, not
   forwarding wrappers, deprecated re-exports, aliases, dual schemas, dual state
   machines, or fallback compatibility branches.
2. Choose the simplest implementation that fully satisfies current
   requirements. Add a seam only when behavior genuinely varies or when it is a
   real cross-module interface.
3. Grow in working vertical slices. Each milestone must leave the product
   buildable and tested end to end.
4. Keep modules deep: substantial behavior behind a small interface. Internal
   implementation detail stays private.
5. Keep concerns separate through ownership and dependency direction, not
   through uniform directory silhouettes.
6. Prefer established, maintained libraries and existing project dependencies.
   Check documentation and types before adding or rebuilding capability.
7. Make long-term architectural decisions. Do not add stopgaps intended for
   later replacement.
8. Study official framework conventions and established products before
   inventing a local pattern. A new design decision must record current official
   documentation or types, established product or repository patterns, and a
   reliable practitioner source when judgment is involved. A mechanical task
   may cite an already approved research note or ADR instead of repeating the
   research.
9. Preserve generated-file ownership. Never hand-edit
   client/src/routeTree.gen.ts or server/src/generated/prisma.
10. Preserve the repository style: two spaces, single quotes, no semicolons,
    trailing commas, strict typed TypeScript, and kebab-case filenames.

When a generic best-practice rule conflicts with these constraints, prefer the
smaller design proven by Morshid's current requirements. Examples:

- Do not create an injection token for one concrete implementation merely to
  enable mocking.
- Do not introduce events where one PostgreSQL transaction owns the invariant.
- Do not create a generic notification capability while reviews are its only
  producer.
- Do not add broad barrel files merely to shorten imports.

Research notes and historical reviews are evidence, not product or architecture
authority. This approved plan and its ADRs own the final decisions. Preserve a
dated historical document when it remains useful evidence, but label any
superseded conclusion explicitly; only current architecture, operation, and
product-contract documentation must describe the final runtime.

## 3. Settled program decisions

### 3.1 Branch and execution

- Implementation is blocked until the owner changes this document's status to
  Approved.
- Branch creation is the first implementation mutation. Create
  refactor/whole-workspace-architecture from the recorded source SHA, not from
  a moving branch tip. If the current branch or SHA differs, stop and report the
  mismatch before editing.
- Preserve and commit this plan and its five untracked research notes as the
  first branch commit.
- Accept that the parent branch is already substantially ahead of dev.
- Use one writer. Parallel agents may research, test, or review, but they must
  not write to the shared checkout.
- Preserve coherent capability-sized commits on the long-lived branch.
- Do not squash the entire refactor into one opaque commit.
- Keep the branch green at every milestone.
- After each completed capability, check whether dev moved. If it did, merge
  dev into the refactor branch without rewriting published history, rerun the
  milestone gate, and record the new base and merge SHAs in the ledger.

### 3.2 Architecture

- Use shared principles with platform-native frontend and backend structures.
- Organize product code by domain capability first.
- Keep small capabilities flat.
- Split crowded modules by business capability, not universal technical-role
  buckets.
- A source file plus its test does not earn a directory by itself.
- A folder is justified by a named capability, an independent change reason,
  or at least three cohesive implementation/support files.
- Keep focused tests adjacent to the behavior they verify.
- Do not require one test file per production file.
- Require tests for behavior, invariants, regressions, and interfaces.
- This capability-first replacement for mandatory per-file folders and
  universal services/ buckets was explicitly accepted by the owner during the
  grill.

### 3.3 Compatibility and data

- Use direct breaking cutovers; there are no compatibility layers.
- Keep /api/v1 as the API prefix.
- Evaluate browser URLs against current information architecture and user
  journeys; update all callers directly and add no compatibility redirects.
- Reset all disposable databases.
- Establish one rolling clean-slate initial Prisma migration, regenerate it for
  each schema-changing slice, and freeze/audit it after the target data model is
  complete. Never append compatibility migrations.
- Run seeding explicitly after reset.

## 4. Architecture vocabulary

Use these terms consistently in code, documentation, tasks, and review:

- **Module:** behavior with one intentional interface and a private
  implementation. This term is scale-independent.
- **Interface:** everything a caller must know, including types, invariants,
  errors, ordering, configuration, and performance constraints.
- **Implementation:** behavior hidden behind a module's interface.
- **Seam:** the location of a module's interface.
- **Adapter:** a concrete implementation at a seam.
- **Deep module:** substantial caller leverage behind a small interface.
- **Capability:** a cohesive domain behavior that changes for one reason.
- **Workspace:** role-specific frontend composition and presentation.
- **Platform:** technical infrastructure with no dependency on product modules.

Canonical domain language:

- **Identity:** authentication, credentials, refresh sessions, users, and user
  administration.
- **Course:** catalog, membership, assignments, and access policy.
- **Material:** an uploaded course knowledge source and its ingestion lifecycle.
- **Conversation:** a Student-owned chat session and its ordered Student and
  Assistant messages.
- **Tutoring Attempt:** the one authoritative execution record for a submitted
  Student turn.
- **Tutoring Runtime:** the single external interface that processes a Tutoring
  Attempt.
- **Socratic Workflow:** the one pedagogy, retrieval, generation, and approval
  path for every supported learning turn, including code diagnosis.
- **Debugging Guidance:** language-neutral, course-grounded diagnosis that
  identifies a likely issue and relevant location, explains the concept, and
  asks for one bounded inspection or trace action. Student code is never
  executed and a complete solution is never returned.
- **Response Governance:** shared safety and grounding decisions applied once to
  a proposed response.
- **Review Case:** the human-review aggregate, including intake, evidence,
  triggers, resolution, history, and Student visibility.
- **Student Review Inbox:** the current review-owned notification experience.
  It is not a generic notification system.
- **Audit Event:** an immutable record created with its owning state transition
  when atomicity is required.

After validation, create a root CONTEXT.md containing only this domain glossary,
without filesystem or implementation details.

## 5. Target workspace structure

Do not pre-create empty folders. The trees below show permitted ownership, not
mandatory directory silhouettes.

### 5.1 Server

    server/src/
    ├── app.module.ts
    ├── app.setup.ts
    ├── main.ts
    ├── common/
    │   ├── errors/
    │   ├── http/
    │   ├── security/
    │   ├── text/
    │   └── observability/
    ├── platform/
    │   ├── config/
    │   ├── database/
    │   ├── cache/
    │   ├── ai/
    │   └── document-storage/
    ├── modules/
    │   ├── identity/
    │   ├── courses/
    │   ├── materials/
    │   ├── conversations/
    │   ├── tutoring/
    │   ├── reviews/
    │   ├── audit/
    │   └── health/
    ├── generated/
    │   └── prisma/
    └── seeds/

Rules:

- common contains stable framework-level primitives used by multiple product
  modules. It never imports modules or platform composition.
- platform contains technical adapters and configuration. It never imports
  product modules.
- modules contains product capabilities.
- Each Nest module keeps its module file at the capability root.
- Cross-module callers import only the owning module file or a named file under
  that module's interface/ directory.
- There are no module-wide index.ts barrels.
- Internal files import each other directly with relative paths.
- Server source keeps relative imports; do not introduce a TypeScript path alias
  that Node output cannot resolve natively.

### 5.2 Client

    client/src/
    ├── app/
    │   ├── app-providers.tsx
    │   ├── router.tsx
    │   ├── route-load-error.tsx
    │   └── styles.css
    ├── routes/
    ├── features/
    │   ├── auth/
    │   │   ├── session/
    │   │   ├── sign-in/
    │   │   └── routing/
    │   ├── account-settings/
    │   ├── courses/
    │   │   ├── course-access/
    │   │   ├── course-administration/
    │   │   └── course-membership/
    │   ├── materials/
    │   │   ├── material-catalog/
    │   │   ├── material-ingestion/
    │   │   └── material-administration/
    │   ├── chat/
    │   │   ├── sessions/
    │   │   ├── messages/
    │   │   └── testing/
    │   ├── reviews/
    │   │   ├── interface/
    │   │   ├── instructor-queue/
    │   │   └── student-inbox/
    │   ├── user-management/
    │   ├── audit/
    │   ├── system-status/
    │   └── landing/
    ├── workspaces/
    │   ├── _shared/
    │   │   └── authenticated-sidebar/
    │   ├── admin/
    │   ├── instructor/
    │   └── student/
    ├── components/
    │   ├── branding/
    │   ├── ui/
    │   └── theme/
    ├── lib/
    │   ├── http/
    │   └── query/
    └── test/

Ownership:

- features own transport, runtime validation, query/mutation definitions, and
  pure domain rules. They may also own standalone public or cross-role domain
  pages and forms such as sign-in and account settings.
- workspaces own role shells, navigation, dashboards, pages, forms, React
  orchestration, and role-specific presentation. A role workspace may import
  workspaces/_shared; _shared never imports a role workspace.
- routes are thin TanStack adapters.
- components and lib are feature-independent shared primitives.
- app owns application composition.
- A feature may import shared code and another feature's named interface only.
- A workspace may compose multiple feature interfaces.
- Role workspaces never import another role workspace.
- Shared code never imports features, workspaces, routes, or app.
- Features never import workspaces, routes, or app.

Keep only the @/* client alias. Remove #/* from TypeScript and package imports.
Do not create broad feature index.ts barrels. Cross-feature imports use explicit
named interface files. Narrow component-local index files may expose one
component package; they must not aggregate an entire feature or capability.

### 5.3 Prisma

    server/prisma/
    ├── schema.prisma
    ├── identity.prisma
    ├── courses-and-materials.prisma
    ├── conversations.prisma
    ├── tutoring.prisma
    ├── reviews.prisma
    ├── audit.prisma
    ├── migrations/
    │   ├── migration_lock.toml
    │   └── <timestamp>_initial/
    │       └── migration.sql
    └── seed.ts

Group models by domain, not one model per file. Keep schema.prisma as the
generator/datasource entry and configure Prisma to load the schema directory.

The initial migration must explicitly contain every database object required by
the application, including:

- pgcrypto, citext, and vector extensions;
- vector dimensions and the deliberate absence of a vector access-method index;
- partial indexes;
- check and uniqueness constraints;
- foreign-key actions;
- the review constraint trigger;
- any handwritten SQL that Prisma's generated diff omits.

Do not use migrate resolve or production baselining for blank databases. Apply
the initial migration normally, then run prisma db seed explicitly.

The current supported retrieval contract is an exact course-scoped cosine scan.
The final initial migration must not recreate the historically removed HNSW
index. A future approximate-nearest-neighbor index requires a separate product
decision plus correctness, query-plan, and performance evidence.

### 5.4 Tests

    server/test/
    ├── identity/
    ├── courses/
    ├── materials/
    ├── conversations/
    ├── tutoring/
    ├── reviews/
    ├── audit/
    ├── support/
    └── fixtures/

    tests/acceptance/
    ├── student/
    ├── instructor/
    ├── admin/
    ├── cross-role/
    └── support/

- Server unit and interface specs remain beside source.
- Server E2E tests group by API capability, not by old file location.
- Browser acceptance tests group by actor journey.
- One-test fixtures stay local. Shared capability fixtures use testing/ or
  support/.
- Production code never imports tests or fixtures.

## 6. Backend ownership map

Every current top-level module must end in one of the following destinations:

| Current owner | Target |
| --- | --- |
| auth | Merge into Identity |
| admin/users | Merge into Identity user-administration |
| courses | Keep as Courses and absorb admin course/membership behavior |
| admin/courses | Delete after distributing course and material commands |
| materials | Keep as Materials |
| rag-persistence | Merge into Materials indexing/ingestion |
| student-chat | Move session/transcript operations to Conversations and new-turn/retry HTTP application behavior to Tutoring |
| socratic-tutor | Merge into Tutoring |
| tutor | Delete the Python-only runtime after moving its valuable diagnosis contract and no-execution guards into generic Tutoring debugging guidance |
| output-policy | Merge into private Tutoring response-governance |
| completion | Delete the legacy provider/module/configuration after direct cutover; keep the product TutorModel adapter private to Tutoring and only consumer-neutral transport/retry/quota primitives in platform AI |
| retrieval | Move course evidence search into Materials behind a narrow CourseEvidence interface consumed by Tutoring |
| reviews | Keep as Reviews and deepen its interfaces |
| notifications | Delete; move current behavior to Reviews student-inbox |
| audit and admin/audit | Merge into Audit |
| embedding | Move to platform AI |
| pdf-storage | Move to platform document-storage |
| prisma | Move to platform database |
| redis | Move to platform cache |
| config | Move to platform config |
| health | Keep as Health, depending only on platform health interfaces |
| admin | Delete after all actor routes are owned by their domains |

Current common code is assigned explicitly:

| Current common area | Target |
| --- | --- |
| authorization/locked-student-chat-session | Conversations session admission through ConversationTurns |
| gemini and upstream | Deduplicate into consumer-neutral platform AI transport/quota code |
| pipes | common/http validation |
| text | common/text deterministic primitives |

Generated Prisma types are persistence details, not canonical domain types.
Domain modules own their enums and contract types; repositories and database
adapters map them to generated Prisma types. Generated imports are allowed only
in platform database, persistence adapters/repositories, seeds, and explicit
persistence/E2E support.

Controllers may retain /admin, /instructor, and /student route namespaces while
living in the domain that owns the operation. Actor prefixes do not create
domain modules.

## 7. Backend dependency direction

The intended graph is acyclic:

    App
      ├── Identity ───────────────► Audit, Platform
      ├── Courses ────────────────► Audit, Platform
      ├── Materials ──────────────► Courses, Audit, Platform
      ├── Conversations ──────────► Courses, Audit, Platform
      ├── Tutoring ───────────────► Conversations, Courses, Materials, Reviews,
      │                              Audit, Platform
      ├── Reviews ────────────────► Courses, Audit, Platform
      ├── Audit ──────────────────► Platform
      └── Health ─────────────────► Platform

Platform and common point inward to nothing in the product graph.

No forwardRef is permitted in the target architecture. A cycle is an ownership
failure and must be redesigned.

## 8. Deep module interfaces

### 8.1 Tutoring

TutoringModule exports one concrete runtime interface and no pipeline internals:

    class TutoringRuntime {
      run(
        command: RunTutoringTurnCommand,
      ): Promise<TutoringTurnReceipt>
    }

The command is a discriminated new-turn or retry command. A new-turn command
contains authenticated Student context, course/session identifier,
client-message idempotency key, submitted content, request deadline or
cancellation, and audit context. A retry command contains the authoritative
Attempt identifier and retry context. It never accepts caller-supplied provider,
workflow, evidence, policy, or terminal-state decisions.

Tutoring owns the new-turn/retry HTTP application adapter and the Tutoring
Attempt. Conversations owns session lifecycle, transcript queries/pagination,
and all Student and Assistant message records. Tutoring calls a narrow
ConversationTurns interface to admit or finalize messages inside its
caller-owned transactions; Conversations never writes Tutoring-owned Attempt
state. The runtime returns a caller-safe receipt or replay of the same
client-message key.

Tutoring internally contains:

    tutoring/
    ├── tutoring.module.ts
    ├── interface/
    │   ├── tutoring-runtime.ts
    │   ├── run-tutoring-turn-command.ts
    │   ├── tutoring-turn-receipt.ts
    │   └── tutoring-errors.ts
    ├── attempt/
    ├── socratic-workflow/
    │   ├── analysis/
    │   ├── teaching-decision/
    │   ├── generation/
    │   ├── debugging-guidance/
    │   └── response-approval/
    ├── response-governance/
    └── infrastructure/

Code diagnosis is a request kind and teaching strategy inside the Socratic
workflow, not a second workflow or language-adapter framework. Do not add a
registry, plugin system, dynamic discovery, workflow DSL, or generic pipeline
framework.

Tutoring hides:

- attempt acquisition, lease, replay, and retry;
- input-risk classification;
- Topic and Topic State;
- educational analysis;
- teaching decisions, including CODE_DIAGNOSIS to DEBUGGING_GUIDANCE with
  TRACE_EXECUTION;
- course-scoped evidence acquisition through Materials' CourseEvidence
  interface;
- generation;
- structural, deterministic, semantic, and strategy-specific guards;
- bounded regeneration;
- deterministic Safe Fallback;
- terminal message and metadata persistence;
- citations and evidence;
- automatic review escalation;
- sanitized audit and provider metadata.

Route every supported request through this path. Before deleting legacy code,
move its valuable diagnosis contract into the Socratic prompt, deterministic
guards, and response requirements: likely issue, relevant location, concept,
and exactly one inspection/trace action. Retain the prohibitions on execution
claims, full solutions, submission-ready code, and unsupported citations.

The deterministic TutorModel adapter is a test adapter, not a real diagnostic
engine. It must emit contract-valid strategy-aware fixtures for deterministic
tests, while production configuration must use the configured live TutorModel.
Live/evaluation coverage establishes diagnosis quality; deterministic tests
establish routing, policy, persistence, and failure behavior.

Delete GroundedChatService's tutoring pipeline,
SocraticChatOrchestrator, CompletionProvider/CompletionModule, the Python-only
tutor runtime, public OutputPolicyModule, duplicate execution branches, and all
surplus Socratic exports after their required responsibilities have moved and
the direct cutover is green.

### 8.2 Conversation turns

ConversationsModule exports one narrow local interface used by Tutoring:

    class ConversationTurns {
      admit(input, transaction): Promise<AdmittedTurn>
      finalize(input, transaction): Promise<FinalizedMessage>
    }

admit owns session access, client-message idempotency, and creation/replay of the
Student and pending Assistant messages. finalize applies exactly one terminal
Assistant outcome. Both join the supplied transaction, expose domain-owned
types, and hide message tables and repositories. Session CRUD and transcript
queries remain separate Conversations application operations; they do not call
Tutoring.

### 8.3 Tutoring Attempt

Replace Message.groundingAttemptId and TutorTurn as competing state machines
with one Tutoring Attempt aggregate.

It owns:

- idempotency identity and client-message replay;
- lease/claim/version state;
- authoritative request kind and teaching strategy;
- Student and Assistant message relationships;
- processing and terminal outcome;
- retry relationship;
- retrieval/citation evidence;
- candidate and guard audit;
- provider/model/prompt/token metadata;
- review-escalation state.

Do not infer review or recovery state from Message.errorCode. Do not encode
multiple policy reasons into a bounded error string.

No database transaction may remain open across a remote model or embedding
call. Use explicit claim, process, and atomic finalize transitions.

#### Transaction ownership

Platform Database exposes an opaque DatabaseTransaction plus a transaction
runner. Product interfaces that must join a caller-owned transaction accept the
opaque context; Prisma.TransactionClient never crosses a product interface.

- Tutoring owns the admission transaction. It calls ConversationTurns to
  authenticate and authoritatively revalidate Student, active course access,
  and session state, then atomically creates or replays the Student message,
  pending Assistant message, and RECEIVED Attempt for a client-message key.
- Remote model and embedding calls occur only after admission commits and
  before finalization begins.
- Tutoring owns the finalization transaction. It asks ConversationTurns to write
  the terminal Assistant outcome, writes Attempt state/evidence/metadata/audit,
  and invokes ReviewCaseIntake when escalation is required.
- Reviews and Audit join the supplied transaction and never open a nested
  transaction in that path.
- Identity, Courses, Materials, and Reviews use the same convention when their
  own state transition and audit event must be atomic.
- Remote I/O is forbidden inside a database transaction.

Rollback tests must prove that a review-intake or audit failure rolls back the
Assistant outcome, Attempt completion, evidence, and all joined writes.

### 8.4 Response governance and Reviews

Shared response governance is private to Tutoring and runs once. Workflow-
specific validation stays within each workflow.

ReviewsModule owns a narrow intake interface:

    openAutomatic(input, transaction)

One call atomically creates or replays the case, all triggers, action history,
evidence, and audit inside the caller-owned transaction. It replaces the current
loop of one transaction per reason.

Reviews owns:

    reviews/
    ├── reviews.module.ts
    ├── interface/
    ├── intake/
    ├── evidence/
    ├── instructor-queue/
    ├── instructor-resolution/
    ├── student-detail/
    └── student-inbox/

Colocate the versioned evidence schema, builder, parser, hash/integrity rules,
and tests. Delete legacy optional evidence shapes.

Terminal Assistant outcome, attempt completion, evidence, and required review
intake must be one local PostgreSQL atomic unit. Do not use an in-process event
or add an outbox for this current single-process invariant.

### 8.5 Identity

IdentityModule owns sign-in, access-token validation, refresh sessions,
credentials, password changes, account enable/disable, and user administration.

- Keep user disable, refresh-token revocation, and audit atomic.
- Keep password reset, token revocation, and audit atomic.
- Keep the last-active-admin lock.
- Remove course summaries from authentication responses. Courses owns course
  access.
- Keep refresh tokens only in the secure HttpOnly cookie. Remove the JSON
  refresh-token request/response fallback.
- Preserve rotation, hashed storage, password-change invalidation, SameSite,
  production Secure, and cookie path under /api/v1/auth.
- Export only the narrow guards/identity interfaces other modules genuinely
  consume. PasswordHasher and user repositories remain private.

### 8.6 Courses

CoursesModule owns course catalog, administration, memberships, assignments,
and course access policy.

- Active membership is the canonical Instructor and Student access rule.
- Every access/count/list query excludes removed memberships.
- Membership removal and role changes condition on removedAt being null inside
  the mutation transaction.
- Course commands and their audit event remain atomic.
- Eliminate duplicate admin repositories and projections.
- Expose one deep course-access operation rather than repeating existence and
  authorization reads in consumers.

### 8.7 Materials

MaterialsModule owns catalog, title changes, upload, processing, indexing,
leases/finalization, and cleanup.

- Fold rag-persistence into material ingestion/indexing.
- Split the existing broad repository internally by catalog, upload, and
  processing responsibilities.
- Use Courses' access interface once; remove duplicate preflight reads.
- Export one CourseEvidence search interface that accepts the authorized course
  scope and query, performs the exact course-scoped scan, and returns sanitized
  evidence without exposing chunks, vectors, Prisma, or storage internals.
- Keep material state changes and audit atomic.
- Do not expose storage paths, hashes, processing internals, or extraction
  errors in admin projections unless a current screen uses them.

### 8.8 Review inbox instead of Notifications

Delete the generic backend and frontend Notifications capabilities.

- Reviews is the only current producer.
- Move the Student inbox into Reviews.
- Move the bell/control into Student workspace presentation.
- Include courseId, sessionId, messageId, and review identifiers in the inbox
  response.
- Navigate directly; delete per-course probing and discarded preflight API
  requests.
- Preserve creation of the review inbox item in the same transaction as
  Instructor resolution, history, idempotency, and audit.
- Use Courses' active-membership interface for Instructor authorization.
- Delete unused notification/review states and fields that have no current
  producer or command.

## 9. Frontend ownership map

Move current code as follows:

| Current area | Target |
| --- | --- |
| Auth session API/store/refresh | features/auth/session |
| Sign-in page/form/schema | features/auth/sign-in |
| Role route protection | features/auth/routing |
| Admin user transport/contracts | features/user-management |
| Admin user UI | workspaces/admin/users |
| Course transport/contracts across roles | features/courses |
| Role-specific course UI | matching workspace |
| Material transport/contracts | features/materials |
| Role-specific material UI | matching workspace |
| Student session/message transport and cache logic | features/chat |
| Student tutor UI and React orchestration | workspaces/student/tutor-workspace |
| Student and Instructor review contracts/queries | features/reviews |
| Review UI | matching Student or Instructor workspace |
| Generic notifications | delete; Reviews student-inbox plus Student control |
| Admin audit transport/contracts | features/audit |
| Admin audit UI | workspaces/admin/audit |
| Health transport and page | features/system-status |
| Account settings | features/account-settings |
| Role settings wrappers | delete; routes use the account settings page |
| Role-aware AppSidebar | workspaces/_shared/authenticated-sidebar |
| App provider/router/load error | app |
| Theme provider | components/theme |

Route rules:

- Keep _student as a pathless protected layout.
- Retain /chat, /settings, /admin/*, and /instructor/* because they fit the
  current information architecture, not because compatibility requires them.
  A later route decision may replace them directly without aliases or redirects.
- A route file owns route declaration, search/parameter validation, beforeLoad,
  query preloading, metadata, and prop mapping only.
- Page markup and feature behavior live outside routes.
- Keep a mixed flat/directory TanStack route tree where it is clearest.
- Prefix route-only helper/test files with TanStack's ignore convention.
- Pass QueryClient through router context; remove global loader access.
- Start independent loader work concurrently.
- Continue calling the Nest API directly. Do not add a TanStack BFF or server
  function layer.
- Never edit routeTree.gen.ts.

Delete duplicate schemas, unused aliases, pass-through role settings pages,
RolePlaceholderPage, unused constants, broad role data/schema/hook buckets,
and redundant Instructor dashboard wrappers after their direct replacement.

## 10. File and naming rules

- Files are kebab-case.
- Nest/React classes and components are PascalCase.
- Functions and variables are camelCase.
- Keep recognizable suffixes when they communicate a role:
  .module.ts, .controller.ts, .repository.ts, .adapter.ts, .policy.ts,
  .schema.ts, .test.tsx, and .spec.ts.
- Do not suffix every behavior class Service. Prefer domain names such as
  TutoringRuntime, CourseAccess, ReviewCaseIntake, TeachingPolicy, or
  ResponseGovernance.
- A repository encapsulates meaningful persistence behavior. Do not create a
  repository interface for a hypothetical second database.
- A port is justified when production and deterministic/test adapters are both
  real, especially true external model providers.
- Avoid utils, helpers, shared, and common as domain dumping grounds.
- A source/test pair stays adjacent and flat.
- Use adapters/ only where multiple adapters exist.
- Do not create empty controllers/, services/, repositories/, hooks/, schemas/,
  or components/ taxonomies.

## 11. Enforced dependency rules

Add one root development dependency: dependency-cruiser ^18.2.0. Use core
ESLint no-restricted-imports for simple textual alias rules.

Do not add a custom AST script, eslint-plugin-boundaries, a direct import-x
stack, or another cycle tool.

Add:

- dependency-cruiser.config.mjs
- npm run test:architecture:client
- npm run test:architecture:server
- npm run test:architecture

Insert test:architecture into npm run check after typechecking and before tests.

Rules become errors with no legacy baseline:

1. No circular dependencies, including type-only cycles.
2. No unresolved imports.
3. Production never imports tests, fixtures, test/, or testing/.
4. Client feature-to-feature imports target the other feature's interface/
   files only.
5. Client shared code is feature/workspace/route/app independent.
6. Client features do not depend on workspaces or composition.
7. Role workspaces do not depend on other role workspaces. They may import
   workspaces/_shared; _shared imports no role workspace.
8. Server cross-module imports target module files or interface/ files only.
9. Server common is product-module independent.
10. Platform is product-module independent.
11. Controllers do not import repositories or other controllers.
12. Repositories do not import controllers or application orchestrators.
13. Generated Prisma imports are limited to platform database, persistence
    adapters/repositories, seeds, and persistence/E2E support. Domain contracts
    use domain-owned types with explicit persistence mappings.
14. Generated files are not followed as authored dependency graphs.

Add strict rules incrementally in the same milestone that removes all current
violations for that rule. Never add a temporary allowlist.

## 12. Test standard

- Test through a module's interface whenever possible.
- Retain focused pure policy/schema tests when the algorithm is meaningful.
- Delete shallow wiring tests after stronger interface tests cover the behavior.
- Testing Library tests assert accessible user behavior.
- Playwright tests assert user-visible journeys and remain independent of
  source layout.
- External model providers use deterministic or mock adapters.
- Persistence-heavy interfaces use the real disposable PostgreSQL/pgvector
  test stack where transaction behavior is part of correctness.

Make discovery explicit:

- Client Vitest: src/**/*.{test,spec}.?(c|m)[jt]s?(x)
- Server unit Jest: **/*.spec.ts
- Server E2E Jest: **/*.e2e-spec.ts
- Server live Jest: **/*.live-spec.ts
- Playwright: tests/acceptance/**/*.spec.ts

Remove testRegex when adding Jest testMatch; Jest does not allow both.

Required regression coverage includes:

- removed memberships never authorize or appear in counts;
- one Instructor access rule based on active membership;
- user disable/password reset session revocation and audit atomicity;
- Tutoring Attempt idempotency, replay, concurrency, retry, and lease expiry;
- no transaction across model calls;
- language-neutral debugging guidance, representative language fixtures, and
  the no-student-code-execution architecture rule;
- course-scoped retrieval and privacy concealment;
- safety refusal, insufficient evidence, provider failure, and Safe Fallback;
- automatic review batching and atomicity;
- review evidence parsing and integrity;
- direct review-inbox navigation without course probing;
- all /api/v1 response/error/status contracts retained or deliberately replaced
  in the same vertical slice;
- route protection and role redirects;
- generated files remain generated and untouched.

## 13. Implementation sequence

Each milestone ends with its completion criterion. Do not begin the next
milestone while the current criterion is false.

Execute one numbered submilestone as one writer task. Before editing, inventory
its concrete source, test, schema, script, fixture, and documentation paths in
the migration ledger. End the task only when its named criterion and exact
recorded commands pass; then commit and produce the section 15 handoff before
starting another task.

After Milestone 2, every schema-changing task updates the same clean-slate
initial migration rather than appending a compatibility migration. It must
regenerate from empty, reconcile the live handwritten-SQL inventory, reset and
seed a disposable database, run catalog assertions, and prove no schema drift.
The final schema is frozen and audited again in Milestone 9.

### Milestone 0 — Branch and safety baseline

1. Verify the recorded source branch and SHA, then create
   refactor/whole-workspace-architecture from that exact commit.
2. Commit the approved plan and research notes.
3. Create a migration ledger mapping every current top-level server module,
   client area, test group, script, schema file, fixture group, and residual
   authored file to keep, move, merge, or delete. Record the starting SHA and
   current test counts.
4. Generate and store a normalized current OpenAPI snapshot. Add focused
   characterization for authentication cookie and role behavior, browser
   routes, provider protocols, persistence invariants, and operational commands.
   This is diagnostic evidence, not a compatibility gate; every later
   intentional delta is named and tested in its slice.
5. Run and record the canonical baseline checks and all known existing failures.
6. Ask the owner to open a draft PR to dev if authenticated GitHub access is not
   available to the writer. Otherwise open it so every pushed SHA runs both CI
   jobs. Extending CI to the branch is the local alternative.

Completion criterion: the starting SHA, existing failures, and CI behavior are
recorded; all checks expected to pass at baseline do pass.

### Milestone 1 — Architecture sources of truth and enforcement foundation

1. Add the exact rules in section 2 to AGENTS.md.
2. Add a concise pointer from AGENTS.md to the approved architecture document.
3. Create CONTEXT.md with the domain glossary.
4. Create only the architectural decision records listed in section 14.
5. Add dependency-cruiser and enable only the no-cycle, unresolved-import, and
   production-to-test rules that can be green without performing a later domain
   migration. Enable each remaining ownership rule in the capability slice that
   removes all of its violations.
6. Standardize client imports on @/* and remove #/*.
7. Make all test discovery patterns explicit.

Completion criterion: npm run check includes a green architecture check and no
new dependency rule contains a baseline or exception for legacy structure.

### Milestone 2 — Clean Prisma foundation

1. Inventory the net-live result of every existing migration before deleting
   anything: extensions, constraints, indexes, functions, triggers, custom SQL,
   and deliberately dropped or superseded objects.
2. Enable multi-file Prisma schema loading and split the current schema by
   domain without semantic change.
3. Generate the rolling initial SQL from empty, reconcile the handwritten-SQL
   inventory, and replace the 18-migration chain with one valid initial history
   while retaining migration_lock.toml.
4. Require the removed HNSW index to remain absent.
5. Reset, migrate, and seed a blank disposable database.
6. Prove generated Prisma output remains generated and ignored.
7. Add database catalog assertions for extensions, exact final indexes, checks,
   foreign keys, and the review constraint trigger, then prove no schema drift.

Completion criterion: a blank database reaches the seeded current behavior
using only the initial migration and explicit seed command.

### Milestone 3 — Identity vertical slice

1. Create Identity ownership and move Auth plus admin user behavior.
2. Remove course summaries from auth responses.
3. Remove JSON refresh-token fallback; keep the secure refresh cookie.
4. Preserve account/session/audit transaction invariants.
5. Move client session/sign-in/routing and user-management contracts.
6. Move Admin user UI to its workspace.
7. Delete obsolete Auth/Admin user paths and exports.
8. Add and enable Identity boundary rules.

Completion criterion: sign-in, refresh, logout, current-user, Admin user
management, role protection, and revocation E2E tests pass with no old paths.

### Milestone 4 — Courses, Materials, and Audit vertical slices

1. Move Admin course/membership behavior into Courses.
2. Establish active membership as the one access rule.
3. Fix every removedAt query and transaction.
4. Move Admin material behavior into Materials.
5. Fold RAG persistence into Materials indexing.
6. Move Admin audit query into Audit.
7. Move client domain transport/contracts and role workspace UI.
8. Remove duplicate repositories, projections, preflight reads, and admin paths.
9. Add and enable Courses/Materials/Audit boundary rules.

Completion criterion: Student, Instructor, and Admin course/material/audit
journeys pass; removed memberships cannot authorize or inflate results.

### Milestone 5 — Reviews and Student inbox vertical slice

1. Deepen Review intake and batch automatic triggers.
2. Colocate one evidence schema/builder/parser/integrity implementation.
3. Move notification persistence and inbox behavior into Reviews.
4. Add direct navigation identifiers.
5. Move the client Review contracts, Instructor queue, Student inbox, and
   workspace controls.
6. Delete generic Notifications, legacy evidence shapes, duplicate review
   enums, unused states, course probing, and compatibility paths.
7. Add and enable Reviews boundary rules.

Completion criterion: manual and automatic review, replay/idempotency,
Instructor resolution, Student inbox, navigation, and atomic audit tests pass.

### Milestone 6 — Conversations and Tutoring vertical slices

Implement in working layers:

1. 6A: Introduce the final Tutoring Attempt model and admission transaction,
   switch current persistence to it, and delete Message.groundingAttemptId and
   TutorTurn in the same slice. Repository search must prove the duplicate state
   is absent before commit.
2. 6B: Introduce TutoringRuntime.run and switch the chat HTTP/application
   adapter. Existing pipelines may remain only as private implementation behind
   that interface.
3. 6C: Move course-scoped evidence search behind Materials' CourseEvidence
   interface. Route CODE_DIAGNOSIS through the same Socratic analysis, teaching,
   generation, and approval path with generic DEBUGGING_GUIDANCE and
   TRACE_EXECUTION contracts.
4. 6D: Establish transaction-aware finalization, Reviews intake, Audit joining,
   and one private response-governance path. Add rollback, replay, concurrency,
   retry, lease-expiry, provider-failure, Safe Fallback, and repair coverage.
5. 6E: Delete GroundedChatService, SocraticChatOrchestrator, old Tutor,
   SocraticTutor, OutputPolicy, Completion, Retrieval, and duplicate execution
   paths, including Python-only runtime/configuration/scripts; rename retained
   fixtures and documentation to the generic code-diagnosis contract. Enable
   final Conversations/Tutoring rules and prove obsolete entry points absent by
   repository search.

Completion criterion: the exact Tutoring unit/interface specs, capability E2E
specs, generic code-diagnosis evaluation specs, and Student Playwright journeys
recorded in each task packet pass through one attempt state machine and one
runtime interface; old paths and state fields no longer exist.

### Milestone 7 — Frontend-wide ownership completion

1. Finish the feature/workspace/app split.
2. Thin every route.
3. Move role-aware layout out of shared components.
4. Consolidate account settings.
5. Split monolithic chat and review schemas.
6. Consolidate duplicate contract types.
7. Replace global QueryClient loader access with router context.
8. Delete old role buckets, wrappers, aliases, and unused modules.
9. Enable all client boundary rules.

Completion criterion: dependency-cruiser reports no cycles or ownership
violations; all client tests, production build, and acceptance journeys pass.

### Milestone 8 — Platform, tests, scripts, and documentation

1. Finish platform relocation for config, database, cache, AI, and storage.
2. Remove feature constants from platform environment validation.
3. Move E2E and acceptance specs into capability/journey folders.
4. Update all server/scripts/*.mts imports, the root review-data script,
   server/package.json hard-coded test paths, server/prisma.config.ts,
   server/prisma/README.md, Swagger tags in app.setup.ts, .env.example, Docker
   and CI paths/comments, architecture scans, and literal documentation paths.
5. Move fixtures/golden-dataset to fixtures/evaluations/code-diagnosis and
   fixtures/sources to fixtures/course-materials. Keep runtime storage/pdfs
   outside source ownership.
6. Delete grounded-chat-migration.e2e-spec.ts and
   message-linkage-migration.e2e-spec.ts; replace upgrade-path assertions with
   blank-initial-schema and final-catalog assertions.
7. Assign residual authored files: app.setup.ts to server composition,
   styles.css to client app styles, use-mobile.ts to shared UI behavior,
   logo.tsx to components/branding, and component documentation plus narrow
   local indexes to their component package.
8. Delete prunable obsolete directories and empty folders.
9. Regenerate route and Prisma outputs through official commands.
10. Update AGENTS.md and ADRs to describe only the final structure.

Completion criterion: repository search finds no obsolete module names, import
paths, compatibility aliases, stale docs, or tool globs.

### Milestone 9 — Final schema freeze

1. Freeze the final multi-file Prisma model.
2. Regenerate the candidate initial migration from empty.
3. Reconcile every net-live handwritten SQL item and deliberate deletion from
   the Milestone 2 inventory.
4. Confirm migration_lock.toml is present and valid.
5. Replace the rolling initial history with the final single initial migration.
6. Reset, migrate, and seed a new disposable database; assert every required
   catalog object, assert HNSW is absent, and prove no schema drift.

Completion criterion: the final schema and the one initial migration produce the
same audited database from nothing, with no intermediate or compatibility
migration remaining.

### Milestone 10 — Final verification

Run on the exact candidate SHA:

1. npm run check
2. npm run test:e2e
3. npm run test:acceptance
4. The live suite only when its documented external credentials are available.
5. A clean install/build in the supported Node 24 and npm 11 environment.
6. A guarded disposable Compose project with a unique validated project name
   and fresh PostgreSQL, Redis, and document-storage volumes; never reuse or
   destructively target the developer's normal volumes.
7. On that blank environment: initial migration, explicit seed, server boot,
   client boot, readiness check, and the exact Student, Instructor, Admin, and
   cross-role Playwright specs recorded in the ledger.
8. An independent full diff review against this plan.

Completion criterion: every required check is green, every plan item is
accounted for, and every deviation has an accepted replacement decision rather
than an undocumented exception.

## 14. Durable decision records

Create these ADRs after plan approval:

1. Capability-first product ownership and platform separation.
2. One Tutoring Runtime and one Tutoring Attempt.
3. Reviews-owned Student inbox and removal of generic Notifications.
4. Clean-slate multi-file Prisma schema and single initial migration.
5. Frontend domain features plus role workspaces.
6. Enforced dependency graph with explicit named interfaces.
7. Opaque database transaction participation across local module interfaces.

Each ADR records context, chosen decision, rejected alternatives, consequences,
and status. Do not use ADRs as task checklists.

## 15. AI writer task contract

Every implementation task packet must include:

- the starting SHA, one numbered submilestone, and its migration-ledger entries;
- AGENTS.md, this plan, and the applicable ADR and research-note identifiers;
- the research basis for any new design decision, or the approved source for a
  mechanical decision;
- exact capability and owned paths;
- the interface and invariants being established;
- paths the task may delete;
- dependencies and allowed dependency direction;
- behavior changes explicitly authorized by this plan;
- exact focused commands and test paths to run;
- completion criterion;
- required handoff fields.

The writer's handoff for every task must report:

- starting SHA, final SHA, and commit or commits;
- applicable ADR, plan, research, and migration-ledger identifiers;
- files added, moved, changed, and deleted;
- obsolete paths proven absent;
- interface and dependency changes;
- schema/migration/seed changes;
- tests added, replaced, and deleted;
- commands run and exact outcomes;
- remaining failures or risks;
- the next safe task.

Only the primary Luna Max writer edits files. Read-only agents may research or
review. The writer must inspect the current worktree before every task and
preserve unrelated user changes.

## 16. Commit strategy

Use scoped Conventional Commits with imperative lowercase subjects. Suggested
sequence:

- docs(architecture): define workspace refactor rules
- chore(tooling): enforce architecture dependencies
- refactor(prisma): establish clean schema baseline
- refactor(identity): consolidate account ownership
- refactor(courses): consolidate course ownership
- refactor(materials): consolidate material ingestion
- refactor(reviews): consolidate review workflow
- refactor(tutoring): introduce tutoring runtime
- refactor(client): separate domain features and workspaces
- test(architecture): reorganize system verification
- docs(architecture): finalize ownership documentation

Do not use the p=#N suffix on branch commits.

## 17. Definition of done

The refactor is complete only when all conditions are true:

- Every authored file has one clear owner.
- Every current top-level module is kept, moved, merged, or deleted according to
  the ownership map.
- Small capabilities remain flat; no implementation/test pair is wrapped in a
  meaningless directory.
- No universal services, controllers, repositories, components, hooks, or
  schemas buckets remain inside product capabilities. Shared shadcn primitives
  under components/ui and other explicitly owned platform/shared packages are
  intentional exceptions.
- Cross-owner imports use explicit interfaces.
- The dependency graph is acyclic and enforced.
- Platform and shared code do not depend on product code.
- Admin exists only as routes/workspace presentation, not a backend domain.
- Generic Notifications, OutputPolicy, duplicate tutoring paths, and duplicate
  attempt state are gone.
- Tutoring exports one runtime interface.
- Every supported request, including CODE_DIAGNOSIS, uses the one Socratic
  workflow; no CompletionProvider or Python-only runtime remains.
- Tutoring owns the Attempt from admission through terminal finalization;
  Conversations owns the session and Student/Assistant message records through
  its transaction-aware ConversationTurns interface.
- Cross-module atomic writes use the opaque DatabaseTransaction convention; no
  Prisma transaction type crosses a product interface and no remote I/O occurs
  inside a database transaction.
- Review intake is atomic and accepts all triggers in one call.
- Removed memberships cannot authorize or affect counts.
- Refresh tokens exist only in secure cookies.
- Prisma uses cohesive domain files and one audited initial migration.
- The final migration retains migration_lock.toml and does not recreate the
  removed HNSW index.
- Blank databases migrate and seed deterministically.
- Generated Prisma and TanStack route files are generated, never hand-edited.
- Unit/interface tests are adjacent and behavior-focused.
- E2E and acceptance tests are grouped by capability/journey.
- No production source imports test support.
- No obsolete path, alias, compatibility layer, legacy schema shape, or stale
  reference remains in current architecture, operation, or product-contract
  documentation. Dated historical evidence may name removed paths only when it
  is clearly labeled as historical or superseded.
- npm run check, npm run test:e2e, and npm run test:acceptance pass on the final
  exact SHA.
- The independent review finds no unresolved Standards or Spec findings.

## 18. Rejected alternatives

- Universal services/, controllers/, and repositories/ folders: scatters
  capabilities and adds depth without encapsulation.
- One directory per implementation/test pair: creates traversal and import
  churn without a seam.
- Keeping all modules flat: fails navigation and locality in large modules.
- One package or TypeScript project per feature: adds build and public-package
  machinery without independent consumers.
- Broad index.ts barrels: hide ownership, increase cycle risk, and may damage
  route chunking.
- New server path aliases: TypeScript paths do not rewrite Node imports.
- Generic workflow engine: one current Socratic workflow needs no registry or
  dynamic dispatch framework.
- Separate Python diagnosis workflow or speculative language-adapter framework:
  code diagnosis is a strategy inside the one current Socratic workflow.
- Generic Notifications: only Reviews currently produces inbox items.
- Event-driven review/notification finalization: loses the required local
  transaction invariant.
- Compatibility wrappers and dual state machines: violate the clean-slate
  decision and preserve complexity.
- A TanStack Start BFF/server-function layer: duplicates the established Nest
  API without a current requirement.
- Multiple concurrent AI writers in one checkout: creates overlap and
  assumption drift.

## 19. Evidence

Repository research:

- [NestJS and Prisma backend organization](research/nestjs-prisma-backend-organization-2026-08-11.md)
- [Frontend file architecture](research/frontend-file-architecture-2026-08-11.md)
- [Predeployment contracts and Prisma clean slate](research/predeployment-contract-and-prisma-clean-slate-2026-08-11.md)
- [Whole-workspace broad-refactor safety](research/whole-workspace-broad-refactor-safety-2026-08-11.md)
- [Solo AI-agent long-lived refactor workflow](research/solo-ai-agent-long-lived-refactor-workflow-2026-08-11.md)

Primary documentation:

- [Nest modules](https://docs.nestjs.com/modules)
- [Nest circular dependencies](https://docs.nestjs.com/fundamentals/circular-dependency)
- [Nest testing](https://docs.nestjs.com/fundamentals/testing)
- [Prisma schema location and multi-file schemas](https://www.prisma.io/docs/orm/prisma-schema/overview/location)
- [Prisma migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
- [Prisma transactions and idempotency](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [TanStack Start routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing)
- [TanStack Router file-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing)
- [TanStack Query options](https://tanstack.com/query/latest/docs/react/guides/query-options)
- [React custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Vitest writing tests](https://vitest.dev/guide/learn/writing-tests.html)
- [Testing Library](https://testing-library.com/docs/)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [TypeScript paths](https://www.typescriptlang.org/tsconfig/paths.html)
- [ESLint no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
- [Dependency-cruiser rules](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)
- [OpenAI model and multi-agent guidance](https://developers.openai.com/api/docs/guides/latest-model)

Relevant practitioner evidence:

- [Kent C. Dodds on colocation](https://kentcdodds.com/blog/colocation)
- [Martin Fowler on Branch by Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html)
- [Vercel on package-import and barrel costs](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)

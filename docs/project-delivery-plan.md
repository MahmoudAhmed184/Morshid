# Morshid system delivery and execution plan

## 1. System overview and core invariants

Morshid is an AI-powered Socratic tutoring and course-grounded educational guidance platform designed for institutional learning environments. The platform provides interactive, pedagogical debugging assistance and conceptual guidance without disclosing direct final solutions to students.

### Core pedagogical invariants
1. **Strict solution withholding (`NO_FINAL_ANSWER`)**: The AI tutor must never provide complete code solutions, final numerical answers, or direct assignment resolutions. It guides students through diagnostic questions, targeted hints, execution tracing, and misconception repair.
2. **Authoritative course grounding**: All pedagogical responses and citations must be strictly derived from instructor-uploaded course materials. Guidance outside the enrolled course corpus is prohibited.
3. **Deterministic guardrails and safe fallbacks**: Every candidate tutor response undergoes a multi-stage validation pipeline (JSON structural schema, deterministic regex guards, and semantic evaluation). If a guard fails or upstream models become unavailable, the system safely falls back to a grounded guiding question or hint.
4. **Human-in-the-loop oversight**: Students can flag confusing or incorrect guidance (up to 3 requests per day), and the system automatically flags low-confidence turns, citation mismatches, and source conflicts for instructor review. Instructors resolve cases through an administrative queue, publishing reviewed guidance directly to the student's review inbox.

### Architecture foundation
Morshid is structured as an npm workspace comprising a **NestJS 11** backend API (`server/`) and a **React 19 / TanStack Start / TanStack Router** single-page application (`client/`), backed by **PostgreSQL 18** with **pgvector** and **Redis 8.4**.

The codebase strictly follows the architecture rules established in [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md), [CONTEXT.md](file:///home/mahmoud-ahmed/Projects/Morshid/CONTEXT.md), and accepted Architecture Decision Records ([ADR 0001](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0001-capability-first-ownership.md) through [ADR 0008](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)).

---

## 2. Current implementation status (completed baseline)

The following capabilities are fully implemented, tested, and active in the repository:

### 2.1 Core infrastructure and platform
- **Runtime and toolchain**: Node.js `>=24.7 <25`, npm `>=11`, strict TypeScript 6.0 across all packages.
- **Database and persistence**: PostgreSQL 18 with `pgvector 0.8.4` through Prisma ORM 7.8. Multi-file schema organization partitioned by capability (`audit.prisma`, `identity.prisma`, `courses-and-materials.prisma`, `conversations.prisma`, `tutoring.prisma`, `reviews.prisma`) with a single rolling clean-slate migration (`20260811150000_initial`) and database catalog hash assertion ([ADR 0004](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0004-clean-slate-prisma-migration.md)).
- **Atomic transactions**: Opaque database transaction participation through `PrismaDatabaseTransactionRunner` ([ADR 0007](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0007-opaque-database-transaction.md)).
- **Caching and distributed coordination**: Redis 8.4 for health readiness checks, Gemini API rate-limit token bucket tracking, daily quota tracking, and multi-project API key pooling with Lua scripts.
- **Local storage**: Local filesystem adapter (`LocalPdfStorageAdapter`) storing PDF files under UUID-keyed paths (`<uuid>.pdf`).

### 2.2 Identity, authentication, and RBAC
- **Native authentication**: Native NestJS authentication in the `identity` module; external auth libraries (for example, BetterAuth) are not used.
- **Password security**: Node native Argon2id (`node:crypto.argon2Sync`) password hashing with timing-safe comparisons and constant-time dummy verification for non-existent users.
- **Session tokens**: Short-lived signed HS256 JWT access tokens (15-minute TTL) in the `Authorization: Bearer` header, paired with rotating HMAC-SHA256 hashed refresh tokens (7-day TTL) stored in `morshid_refresh` HttpOnly, SameSite, Secure cookies.
- **Role-based access control**: Strict `@Roles(...)` guards enforcing three institutional roles: `ADMIN`, `INSTRUCTOR`, and `STUDENT`. (The `TA` role does not exist).
- **User administration**: Admin endpoints for user CRUD, cursor-paginated listings, account disabling/reactivation (which immediately revokes active refresh tokens), admin password resets, and bulk CSV user import with PapaParse.

### 2.3 Course administration and member rosters
- **Course lifecycle**: Full CRUD for course entities, course archiving (`archivedAt`), term metadata, and course-scoped enrollment rosters.
- **Roster management**: Admin endpoints for individual member assignment, role changes, member removal, and multi-course bulk user assignment.
- **Tenant isolation**: Strict course-boundary validation across all student and instructor endpoints preventing cross-course data leakage.

### 2.4 Materials ingestion and vector search
- **PDF text ingestion**: Dedicated `materials` capability module extracting text from uploaded PDFs using `pdfjs-dist`.
- **Text chunking**: Natural-boundary chunker (`MaterialTextChunker`) creating chunks with a target size of 1,200 characters and 200-character overlap.
- **Document profiles and status**: Lifecycle tracking (`PROCESSING`, `READY`, `WARNING`, `FAILED`) with persisted vector model profiles (`MaterialChunk.embedding_model`).
- **Strict course readiness**: Retrieval operations strictly enforce that all materials for a course have active vector embeddings matching the current system profile (`findCourseEvidenceReadiness`). Queries are blocked if any course material is unindexed or processing.
- **pgvector cosine retrieval**: Course-isolated exact cosine distance search executed using a materialized SQL Common Table Expression (`chunk.embedding <=> ${queryEmbedding}::vector(1536)`).
- **Embedding migration CLI**: Resumable, multi-worker command-line migration runner (`npm run embedding:migrate`) for re-embedding the corpus when updating vector models.

### 2.5 Socratic tutoring runtime and multi-model orchestration
- **Seven-phase tutoring runtime (`TutoringRuntime.run`)**:
  1. *Admission and locking*: Request admission and optimistic conversation row locks ([ADR 0002](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0002-one-tutoring-runtime-and-attempt.md)).
  2. *Topic resolution*: Automatic curriculum DAG traversal and student topic mastery tracking (`TopicState`).
  3. *Educational analysis*: Analysis model role (`ANALYSIS_MODEL_*`) evaluating student intent, state (`NO_PRIOR_KNOWLEDGE`, `PARTIAL_UNDERSTANDING`, `MISCONCEPTION`, `DEBUGGING_ISSUE`, `NEAR_SOLUTION`), effort level, and misconceptions. Fast-path boundary classification for off-topic, ambiguous, or unsafe prompts.
  4. *Policy selection*: Teaching policy engine selecting pedagogical strategies (`GUIDED_EXPLANATION`, `SOCRATIC_QUESTIONING`, `MISCONCEPTION_REPAIR`, `DEBUGGING_GUIDANCE`), specific techniques (10 pedagogical techniques), and revelation limits (`NO_FINAL_ANSWER`).
  5. *Course-scoped evidence retrieval*: Exact cosine distance search in pgvector with course readiness gating and backing file verification.
  6. *Candidate generation and three-stage guard approval*: Tutor model role (`TUTOR_MODEL_*`) candidate generation validated against:
     - Stage 1: Structural JSON schema validation and citation verification.
     - Stage 2: Deterministic regex guard preventing direct answer disclosure, step count overflows, and code execution.
     - Stage 3: Semantic evaluator role (`SEMANTIC_GUARD_*`) scoring pedagogical compliance, hint quality, and solution withholding.
  7. *Safe fallback and persistence*: Safe deterministic fallback hint generation upon guard rejection or timeout; atomic transaction committing turns, citations, topic progression, guard telemetry, and audit events.
- **Project-aware Gemini chat pool**: Multi-project key rotation pooling up to 32 Gemini API keys through Redis Lua scripts with exponential backoff and jittered cooldown on HTTP 429 rate limits ([ADR 0008](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)).
- **Offline deterministic testing provider**: SHA-256 hash vector provider and deterministic Socratic response generator allowing full unit, integration, and E2E testing without external API keys or cloud dependencies.

### 2.6 Python 3.14 academic curriculum
- **Corpus coverage**: 12 academic modules (PY-01 through PY-12), 125 total pages, 8 debugging detectors, 96 section anchors, and verified zero student solution leakage ([validation_report.md](file:///home/mahmoud-ahmed/Projects/Morshid/validation_report.md)).
- **Instructor reference base**: 36 assessed reference solutions and capstone test specifications in `qa_reference/`.

### 2.7 Human-in-the-loop review system
- **Intake and quotas**: Student review requests on assistant messages (daily quota of 3 requests per day, maximum 200 characters, advisory locks, idempotency key support) across 6 structured categories.
- **Automated trigger ingestion**: Automatic creation of review cases upon low-confidence retrieval (`GENERAL_NOT_FOUND`), citation omission, source conflict, policy failure, or solution risk.
- **Evidence snapshots**: Immutable JSONB snapshots (`ReviewEvidenceSnapshot`) capturing full conversation context, system prompts, retrieved chunks, and student notes.
- **Instructor resolution queue**: Filterable instructor workspace supporting four resolution pathways: approve original, inline edit, replace with fresh guidance, or reject request.
- **Student review inbox**: Dedicated student review inbox (`/api/v1/reviews/inbox`) with unread counters, notification badge, and direct deep-linking to conversation messages ([ADR 0003](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0003-reviews-owned-student-inbox.md)).

### 2.8 Frontend workspaces and design system
- **Role workspaces**: Workspaces for Student (`/chat`), Instructor (`/instructor`), and Admin (`/admin`) with a shared authenticated sidebar ([ADR 0005](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0005-frontend-features-and-workspaces.md)).
- **State and data fetching**: TanStack Query v5 with optimistic updates for chat messages, infinite scrolling for review queues and audit feeds, and interval polling for material ingestion status. Zustand for client auth state.
- **UI architecture**: Tailwind CSS v4, shadcn/ui components on `@base-ui/react` and Radix primitives, Lucide icons, IBM Plex typography, light/dark modes, and 6 institutional color palettes with native View Transitions.

### 2.9 Automated quality gates and verification
- **Architecture enforcement**: Automated dependency cruiser graph checks (`npm run test:architecture`) verifying unidirectional module dependencies ([ADR 0006](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0006-enforced-dependency-graph.md)).
- **Generated code ownership**: Automated verification script (`npm run test:generated-ownership`) preventing manual edits to generated Prisma clients or route trees.
- **Database catalog assertion**: Semantic database catalog verification (`npm run db:assert-catalog`) validating PostgreSQL schema consistency against runtime expectations.
- **E2E and acceptance testing**: Playwright browser journeys (`npm run test:acceptance`) and server integration suites (`npm run test:e2e`).
- **Clean-slate demo rehearsal**: Five-stage automated reset and seeding script (`npm run demo:fresh-seed`) validating demo readiness against protected scenarios.

---

## 3. Incomplete scope and system gaps

The following capabilities were discussed in earlier designs or historical requirements but are not implemented in the current system:

| Area | Planned capability | Current status | Scope classification |
|---|---|---|---|
| **Document formats** | DOCX, Markdown, TXT, EPUB, ZIP, PPTX ingestion | Only text-based PDF ingestion is supported through `pdfjs-dist`. | System gap (deferred to future work) |
| **OCR processing** | Optical Character Recognition for scanned PDFs | Scanned PDFs without text layers fail with `NO_EXTRACTABLE_TEXT`. | System gap (deferred to future work) |
| **Object storage** | Cloud S3 / MinIO object storage adapter | Files are stored directly on the local filesystem (`LocalPdfStorageAdapter`). | System gap (sufficient for local/pilot; cloud adapter needed for multi-node) |
| **Chat delivery** | Server-Sent Events (SSE) token-by-token streaming | Synchronous HTTP POST request-response cycle returning complete turns with optimistic UI updates. | Current architecture choice (streaming deferred to horizon 1) |
| **Message queue** | External message brokers (BullMQ, Redis Streams, RabbitMQ) | In-process database-polling scheduler (`material_processing_commands` with leases). | Current architecture choice (sufficient for single-node deployment) |
| **UI localization** | Full Right-to-Left (RTL) Arabic layout toggle | Arabic IBM Plex fonts are loaded; UI layout is English Left-to-Right (LTR). | System gap (deferred to horizon 1) |
| **Authentication** | Institutional SSO (SAML 2.0, OIDC) / OAuth / self-registration | Native email/password authentication and admin user provisioning. | System gap (enterprise requirement; deferred to horizon 3) |
| **LMS integration** | LTI 1.3 standard for Canvas/Blackboard/Moodle | Standalone web platform without external LMS gradebook sync. | System gap (deferred to horizon 3) |
| **Teaching assistants** | Dedicated `TA` role with scoped grading/review privileges | Only `ADMIN`, `INSTRUCTOR`, and `STUDENT` roles exist. | Omitted by design |
| **Reviewed-answer RAG** | Secondary vector embedding of resolved instructor review cases | Reviews update target conversation messages and inbox notifications only; not indexed for RAG. | System gap (deferred to horizon 2) |

---

## 4. Future roadmap

```
+-----------------------------------------------------------------------------+
| Horizon 1: Near-term hardening and production polish                        |
| - SSE token streaming for chat turns                                        |
| - Full RTL layout and Arabic language toggle                                |
| - Automated continuous LLM evaluation runner                                |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Horizon 2: Pedagogical and retrieval updates                                |
| - Hybrid search (BM25 lexical + pgvector cosine) and reranking              |
| - Second-tier RAG grounded in resolved instructor reviews                   |
| - Multi-course curriculum expansion and multi-format ingestion (DOCX/MD)     |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Horizon 3: Enterprise and institutional platform                            |
| - Institutional LMS integration (LTI 1.3 standards)                         |
| - Institutional SSO and identity providers (SAML 2.0 / OIDC)                |
| - S3 / cloud object storage adapter and multi-tenant organization isolation  |
+-----------------------------------------------------------------------------+
```

### Horizon 1: Near-term hardening and production polish
1. **Server-Sent Events (SSE) streaming**: Transition chat turns from synchronous REST requests to token-by-token SSE streaming to reduce perceived latency on multi-phase tutor generation.
2. **Full RTL and Arabic localization**: Implement bidirectional layout toggles and complete Arabic UI string translation.
3. **Automated LLM evaluation runner**: Continuous evaluation pipeline running the 65-item golden dataset ([docs/golden-dataset-p0-v1.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/golden-dataset-p0-v1.md)) against active models to score pedagogical adherence, safety guard performance, and citation honesty.

### Horizon 2: Pedagogical and retrieval updates
1. **Hybrid retrieval pipeline**: Combine dense pgvector cosine search with sparse BM25 lexical keyword search and a lightweight cross-encoder reranker to improve accuracy on technical code syntax queries.
2. **Reviewed-answer second-tier RAG**: Index approved and edited instructor review responses as a secondary vector knowledge tier for frequent student misconceptions.
3. **Multi-format ingestion engine**: Add text extractors for Markdown (`.md`), plain text (`.txt`), and Microsoft Word (`.docx`) documents.

### Horizon 3: Enterprise and institutional platform
1. **LTI 1.3 LMS integration**: Deep linking and single sign-on integration with standard learning management systems (Canvas, Moodle, Blackboard).
2. **Enterprise identity federation**: Support SAML 2.0 and OpenID Connect (OIDC) identity providers with automated role mapping.
3. **Cloud object storage adapter**: Implement AWS S3 or MinIO storage adapters for multi-instance deployments.

---

## 5. Engineering and product priorities

| Priority | Feature / work item | Pedagogical impact | Technical complexity | Target horizon |
|---|---|---|---|---|
| **P1** | Automated golden dataset evaluation runner | High | Low | Horizon 1 |
| **P1** | Token-by-token SSE chat streaming | Medium | Medium | Horizon 1 |
| **P1** | Full RTL Arabic UI layout support | High | Medium | Horizon 1 |
| **P2** | Hybrid search (BM25 + pgvector) | High | Medium | Horizon 2 |
| **P2** | Markdown and DOCX ingestion support | Medium | Medium | Horizon 2 |
| **P2** | S3 and MinIO cloud storage adapter | Low | Low | Horizon 2 |
| **P2** | Reviewed-answer second-tier vector index | High | High | Horizon 2 |
| **P3** | LTI 1.3 LMS integration | High | High | Horizon 3 |
| **P3** | Institutional SAML and OIDC SSO integration | Medium | Medium | Horizon 3 |

---

## 6. System dependencies and operational risks

| Risk area | Potential failure mode | Implemented mitigation |
|---|---|---|
| **Upstream LLM rate limits and 429s** | Upstream provider quotas exhausted during peak class usage. | Multi-project Gemini API key rotation pool through Redis Lua scripts, exponential backoff with jitter, and deterministic safe fallback generation ([ADR 0008](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)). |
| **Embedding model version mismatch** | Query vectors generated with a new model compared against old chunk vectors. | Strict course readiness check (`findCourseEvidenceReadiness`) blocks retrieval if any chunk lacks the active vector profile. Resumable migration CLI (`npm run embedding:migrate`) re-indexes the corpus. |
| **Data privacy and solution leakage** | Student solutions or private course materials indexed publicly or exposed across courses. | Course-isolated SQL queries, client access token verification on every request, zero logging of private student attempts to third-party logs, and restricted Gemini embedding governance policy. |
| **Database concurrency and race conditions** | Duplicate review submissions or concurrent message turn modifications. | Database-level row locking, unique constraint idempotency tokens, and opaque transaction runner ([ADR 0007](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0007-opaque-database-transaction.md)). |

---

## 7. Verification and completion criteria

All new code, modifications, and extensions must satisfy the following completion criteria:

### Automated verification gate (`npm run check`)
Every change must pass the repository-wide gate before being committed or merged:
1. **Formatting**: `npm run format:check` (Prettier code style).
2. **Linting**: `npm run lint:ci` (Zero warnings and errors across root, client, and server).
3. **Type checking**: `npm run typecheck` (Strict TypeScript compilation across all workspaces).
4. **Architecture gate**: `npm run test:architecture` (Zero dependency cruiser boundary violations).
5. **Generated code integrity**: `npm run test:generated-ownership` (Prisma client and route tree unedited).
6. **Unit tests**: `npm test` (All unit tests passing across root, client, and server).
7. **Production build**: `npm run build` (Clean Vite client build and NestJS server compilation).

### Additional verification commands
- **Database catalog check**: `npm run db:assert-catalog`
- **Server integration E2E**: `npm run test:e2e`
- **Browser acceptance journeys**: `npm run test:acceptance`
- **Clean-slate demo rehearsal**: `MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed`
- **Live model smoke tests**: `npm run test:tutoring:live`, `npm run test:gemini-embedding:smoke`, `npm run test:iti-bedrock-embedding:probe`

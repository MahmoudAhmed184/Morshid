# 19. Codebase Map & Symbol Inventory

This document provides a reference index of primary entry points, capability modules, services, repositories, and interfaces across the Morshid repository.

---

## 1. Primary Entry Points & Configuration

| File Path | Primary Symbol(s) | Description |
|---|---|---|
| [`server/src/main.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/main.ts) | `bootstrap()` | Backend entry point; initializes NestFactory and binds HTTP listener. |
| [`server/src/app.setup.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/app.setup.ts) | `configureApp()` | Global server setup: prefixes, CORS, Swagger docs, global guards and pipes. |
| [`server/src/app.module.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/app.module.ts) | `AppModule` | Root NestJS dependency injection module. |
| [`client/src/app/router.tsx`](file:///home/mahmoud-ahmed/Projects/Morshid/client/src/app/router.tsx) | `getRouter()` | Frontend TanStack Router initialization. |
| [`client/src/routes/__root.tsx`](file:///home/mahmoud-ahmed/Projects/Morshid/client/src/routes/__root.tsx) | `Route` | Frontend root component injecting query client and session providers. |
| [`dependency-cruiser.config.mjs`](file:///home/mahmoud-ahmed/Projects/Morshid/dependency-cruiser.config.mjs) | `default` | Architectural boundary and layering enforcement rules. |

---

## 2. Server Capability Modules (`server/src/modules/`)

### 2.1 Identity & Access Control
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `identity/identity.module.ts` | `IdentityModule` | Root identity module registering global `APP_GUARD` providers. |
| `identity/identity.guard.ts` | `IdentityGuard` | Authentication guard validating Bearer JWT and password version. |
| `identity/identity.roles.guard.ts` | `RolesGuard` | RBAC authorization guard evaluating `@Roles(...)` metadata. |
| `identity/password-hasher.ts` | `PasswordHasher` | Argon2id password hashing and constant-time dummy verifier. |
| `identity/access-token.ts` | `AccessTokenService` | JWT access token signer and validator. |
| `identity/refresh-session.ts` | `RefreshSession` | HMAC-SHA256 refresh token rotation with single-use reuse detection. |
| `identity/identity-audit.ts` | `IdentityAudit` | Audit recorder helper for authentication and session events. |
| `identity/user-administration/user-administration.service.ts` | `UserAdministrationService` | Admin user CRUD, atomic bulk imports, and account toggles. |

### 2.2 Courses Capability
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `courses/courses.module.ts` | `CoursesModule` | Courses capability module. |
| `courses/courses.controller.ts` | `CoursesController` | Course listing and access verification endpoints. |
| `courses/course-administration.controller.ts` | `CourseAdministrationController` | Admin endpoints for course lifecycle and bulk member rosters. |
| `courses/course-access.service.ts` | `CourseAccessService` | Domain authorization policies for course access and management. |
| `courses/courses.repository.ts` | `PrismaCoursesRepository` | Transactional persistence for courses and memberships. |

### 2.3 Materials Ingestion & Evidence
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `materials/materials.module.ts` | `MaterialsModule` | Materials capability module. |
| `materials/catalog/materials.controller.ts` | `MaterialsController` | PDF material upload and status querying endpoints. |
| `materials/upload/pdf-upload.validator.ts` | `PdfUploadValidator` | Strict multipart upload validation (MIME, size, magic bytes). |
| `materials/processing/material-processing.scheduler.ts` | `DurableMaterialProcessingScheduler` | Polling queue worker claiming processing commands with leases. |
| `materials/processing/pdf-text-extractor.ts` | `PdfJsTextExtractor` | `pdfjs-dist` text extraction and partial page warning detector. |
| `materials/processing/material-text-chunker.ts` | `MaterialTextChunker` | NFKC normalization and 1200/200 sliding window text chunker. |
| `materials/evidence/materials-course-evidence.ts` | `MaterialsCourseEvidence` | RAG evidence provider with course readiness checks. |
| `materials/evidence/course-evidence.repository.ts` | `PrismaCourseEvidenceRepository` | PostgreSQL `pgvector` cosine similarity retrieval repository. |

### 2.4 Conversations Capability
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `conversations/conversations.module.ts` | `ConversationsModule` | Conversations capability module. |
| `conversations/conversations.controller.ts` | `ConversationsController` | Session management and message history retrieval endpoints. |
| `conversations/prisma-conversation-turns.ts` | `PrismaConversationTurns` | Transactional message sequence allocation and turn admission. |
| `conversations/prisma-conversation-authorization.ts` | `lockAuthorizedConversation` | Pessimistic `FOR UPDATE` row locker on chat sessions and memberships. |

### 2.5 Tutoring Engine & Socratic Runtime
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `tutoring/tutoring.module.ts` | `TutoringModule` | Tutoring capability module. |
| `tutoring/tutoring-runtime.application.ts` | `TutoringRuntimeApplication` | Application orchestrator implementing `TutoringRuntime.run()`. |
| `tutoring/socratic-workflow/socratic-workflow.ts` | `SocraticWorkflow` | 7-phase Socratic teaching execution pipeline. |
| `tutoring/socratic-workflow/analysis/educational-analysis.service.ts` | `EducationalAnalysisService` | Student state, misconception, and effort analysis service. |
| `tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts` | `selectTeachingPolicy` / `fixedGuardPolicy` | Pedagogical strategy selection and fixed teaching guard policy. |
| `tutoring/socratic-workflow/generation/tutor-generation.service.ts` | `TutorGenerationService` | Socratic prompt builder and candidate response generator. |
| `tutoring/socratic-workflow/response-approval/response-approval.service.ts` | `ResponseApprovalService` | 3-stage validation coordinator (Structural, Deterministic, Semantic). |
| `tutoring/socratic-workflow/response-approval/safe-fallback.service.ts` | `SafeFallbackService` | Deterministic probing question generator on LLM failure. |
| `tutoring/attempt/tutoring-turn.repository.ts` | `PrismaTutoringTurnRepository` | Persistence for attempts, guard results, and topic states. |

### 2.6 Reviews Subsystem (HITL)
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `reviews/reviews.module.ts` | `ReviewsModule` | Reviews capability module. |
| `reviews/intake/review-case.controller.ts` | `ReviewCaseController` | Student review request intake endpoint. |
| `reviews/intake/review-case.repository.ts` | `PrismaReviewCaseRepository` | Transactional review case creation with snapshot hashing. |
| `reviews/instructor-queue/instructor-review-queue.controller.ts` | `InstructorReviewQueueController` | Instructor review queue listing and detail endpoints. |
| `reviews/instructor-resolution/instructor-review-resolution.controller.ts` | `InstructorReviewResolutionController` | Instructor moderation resolution actions (Approve, Edit, Replace, Dismiss). |
| `reviews/student-inbox/student-review-inbox.controller.ts` | `StudentReviewInboxController` | Student notification inbox for review resolutions. |

### 2.7 Audit & Health Capabilities
| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `audit/audit.service.ts` | `AuditService` | Centralized service for persisting immutable `audit_logs` records. |
| `audit/access-audit.service.ts` | `AccessAuditService` | Fail-safe logger for RBAC denials and access security events. |
| `health/health.controller.ts` | `HealthController` | Terminus probes for `/health/live` and `/health/ready`. |

---

## 3. Platform Adapters (`server/src/platform/`)

| File Path | Primary Symbol(s) | Description |
|---|---|---|
| `database/prisma.service.ts` | `PrismaService` | NestJS wrapper for generated Prisma Client with lifecycle management. |
| `database/database-transaction.ts` | `DatabaseTransactionRunner` | Opaque database transaction participation contract (ADR 0007). |
| `cache/redis.service.ts` | `RedisService` | Node redis client wrapper for token buckets and quota caching. |
| `document-storage/local-pdf-storage.adapter.ts` | `LocalPdfStorageAdapter` | Filesystem storage adapter with mode 0600 and UUID filenames. |
| `ai/embedding/embedding-provider.factory.ts` | `createEmbeddingProvider` | Factory selecting `Deterministic` or `Gemini` vector embedders. |
| `ai/upstream/gemini-chat-project-pool.ts` | `GeminiChatProjectPool` | Multi-project Gemini rate limit rotation in Redis (ADR 0008). |
| `ai/upstream/structured-chat.transport.ts` | `StructuredChatTransport` | OpenAI-compatible HTTP fetch client with deadline management. |
| `config/env.schema.ts` | `validateEnv()` | Zod environment variable parser and boot validator. |

---

## 4. Frontend Codebase Map (`client/src/`)

### 4.1 Domain Features (`client/src/features/`)
| Feature Directory | Public Interface File / Barrel | Responsibilities |
|---|---|---|
| `features/auth/` | `features/auth/session/interface/index.ts` | Login forms, session context, JWT decoding, token renewal (`authenticated-api-client.ts`). |
| `features/chat/` | `features/chat/` | Socratic chat messages, session lists, citations, debug UI. |
| `features/courses/` | `features/courses/` | Course selector, student enrollment, readiness diagnostic cards. |
| `features/materials/` | `features/materials/` | PDF drag-and-drop uploader, processing status badges. |
| `features/reviews/` | `features/reviews/interface/` | Instructor review moderation panel, student inbox list. |
| `features/user-management/`| `features/user-management/` | Admin user table, CSV bulk importer, password reset modals. |
| `features/audit/` | `features/audit/` | System audit log viewer table and filter controls. |
| `features/system-status/` | `features/system-status/` | Real-time diagnostic cards for DB, Redis, and AI providers. |

### 4.2 Role Workspaces (`client/src/workspaces/`)
| Workspace Directory | Primary Components | Target Persona |
|---|---|---|
| `workspaces/student/` | `StudentLayout`, `TutorPage` | Student chat workspace, citations drawer, review modal. |
| `workspaces/instructor/` | `InstructorLayout`, `InstructorDashboardPage` | Instructor course manager, PDF uploader, review queue. |
| `workspaces/admin/` | `AdminLayout`, `AdminDashboardPage` | Administrator user manager, audit explorer, system status. |
| `workspaces/_shared/` | `AuthenticatedNavbar`, `WorkspaceHeader` | Shared authenticated navigation chrome and user footer. |

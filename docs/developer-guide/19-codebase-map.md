# 19. Codebase map and symbol inventory

This document lists the main entry points, capability modules, services, repositories, and interfaces across the Morshid repository.

---

## 1. Primary entry points and configuration

| File path | Primary symbols | Description |
|---|---|---|
| [`server/src/main.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/main.ts) | `bootstrap()` | Backend entry point. Initializes NestFactory and binds the HTTP listener. |
| [`server/src/app.setup.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/app.setup.ts) | `configureApp()` | Global server setup, including route prefixes, CORS, Swagger docs, global guards, and pipes. |
| [`server/src/app.module.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/app.module.ts) | `AppModule` | Root NestJS dependency injection module. |
| [`client/src/app/router.tsx`](file:///home/mahmoud-ahmed/Projects/Morshid/client/src/app/router.tsx) | `getRouter()` | Initializes TanStack Router for the frontend. |
| [`client/src/routes/__root.tsx`](file:///home/mahmoud-ahmed/Projects/Morshid/client/src/routes/__root.tsx) | `Route` | Frontend root component that sets up the query client and session providers. |
| [`dependency-cruiser.config.mjs`](file:///home/mahmoud-ahmed/Projects/Morshid/dependency-cruiser.config.mjs) | `default` | Dependency rules enforcing architecture boundaries and layering. |

---

## 2. Server capability modules (`server/src/modules/`)

### 2.1 Identity and access control
| File path | Primary symbols | Description |
|---|---|---|
| `identity/identity.module.ts` | `IdentityModule` | Root identity module. Registers global `APP_GUARD` providers. |
| `identity/identity.guard.ts` | `IdentityGuard` | Authentication guard that validates bearer JWTs and password version. |
| `identity/identity.roles.guard.ts` | `RolesGuard` | Role-based access guard that checks `@Roles(...)` metadata. |
| `identity/password-hasher.ts` | `PasswordHasher` | Hashes passwords with Argon2id and runs constant-time verifications. |
| `identity/access-token.ts` | `AccessTokenService` | Signs and validates JWT access tokens. |
| `identity/refresh-session.ts` | `RefreshSession` | HMAC-SHA256 refresh token rotation with reuse detection. |
| `identity/identity-audit.ts` | `IdentityAudit` | Records audit events for logins, logouts, and session changes. |
| `identity/user-administration/user-administration.service.ts` | `UserAdministrationService` | User CRUD, bulk CSV imports, and account activation toggles for administrators. |

### 2.2 Courses
| File path | Primary symbols | Description |
|---|---|---|
| `courses/courses.module.ts` | `CoursesModule` | Courses module definition. |
| `courses/courses.controller.ts` | `CoursesController` | Endpoints for listing courses and checking access. |
| `courses/course-administration.controller.ts` | `CourseAdministrationController` | Admin endpoints for course lifecycle and roster management. |
| `courses/course-access.service.ts` | `CourseAccessService` | Authorization policies for course access and management. |
| `courses/courses.repository.ts` | `PrismaCoursesRepository` | Database queries for courses and enrollments. |

### 2.3 Materials ingestion and evidence
| File path | Primary symbols | Description |
|---|---|---|
| `materials/materials.module.ts` | `MaterialsModule` | Materials capability module. |
| `materials/catalog/materials.controller.ts` | `MaterialsController` | Endpoints for uploading course PDFs and checking processing status. |
| `materials/upload/pdf-upload.validator.ts` | `PdfUploadValidator` | Validates multipart uploads against MIME types, file size, and magic bytes. |
| `materials/processing/material-processing.scheduler.ts` | `DurableMaterialProcessingScheduler` | Worker loop that claims pending PDF processing jobs using lease locks. |
| `materials/processing/pdf-text-extractor.ts` | `PdfJsTextExtractor` | Extracts text with `pdfjs-dist` and flags unreadable pages. |
| `materials/processing/material-text-chunker.ts` | `MaterialTextChunker` | Normalizes text with NFKC and splits it into 1200-character chunks with 200-character overlap. |
| `materials/evidence/materials-course-evidence.ts` | `MaterialsCourseEvidence` | Retrieval provider that checks course readiness and supplies context passages. |
| `materials/evidence/course-evidence.repository.ts` | `PrismaCourseEvidenceRepository` | Runs cosine similarity searches against embeddings in `pgvector`. |

### 2.4 Conversations
| File path | Primary symbols | Description |
|---|---|---|
| `conversations/conversations.module.ts` | `ConversationsModule` | Conversations module definition. |
| `conversations/conversations.controller.ts` | `ConversationsController` | Endpoints for creating chat sessions and loading message history. |
| `conversations/prisma-conversation-turns.ts` | `PrismaConversationTurns` | Allocates turn sequence numbers inside database transactions. |
| `conversations/prisma-conversation-authorization.ts` | `lockAuthorizedConversation` | Locks conversation and membership rows with `SELECT ... FOR UPDATE`. |

### 2.5 Tutoring engine and Socratic runtime
| File path | Primary symbols | Description |
|---|---|---|
| `tutoring/tutoring.module.ts` | `TutoringModule` | Tutoring module definition. |
| `tutoring/tutoring-runtime.application.ts` | `TutoringRuntimeApplication` | Entry orchestrator that runs the full tutoring workflow. |
| `tutoring/socratic-workflow/socratic-workflow.ts` | `SocraticWorkflow` | Seven-step execution pipeline for Socratic responses. |
| `tutoring/socratic-workflow/analysis/educational-analysis.service.ts` | `EducationalAnalysisService` | Analyzes student mastery, misconceptions, and effort from message turns. |
| `tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts` | `selectTeachingPolicy` / `fixedGuardPolicy` | Selects teaching policies and enforces guardrail limits. |
| `tutoring/socratic-workflow/generation/tutor-generation.service.ts` | `TutorGenerationService` | Builds prompt payloads and calls the language model. |
| `tutoring/socratic-workflow/response-approval/response-approval.service.ts` | `ResponseApprovalService` | Coordinates structural, deterministic, and semantic response validations. |
| `tutoring/socratic-workflow/response-approval/safe-fallback.service.ts` | `SafeFallbackService` | Generates static fallback questions when the model output fails validation. |
| `tutoring/attempt/tutoring-turn.repository.ts` | `PrismaTutoringTurnRepository` | Saves turn attempts, guard evaluations, and student topic states. |

### 2.6 Reviews subsystem (HITL)
| File path | Primary symbols | Description |
|---|---|---|
| `reviews/reviews.module.ts` | `ReviewsModule` | Reviews capability module. |
| `reviews/intake/review-case.controller.ts` | `ReviewCaseController` | Endpoint for students to flag turns for human review. |
| `reviews/intake/review-case.repository.ts` | `PrismaReviewCaseRepository` | Creates review cases with SHA-256 snapshot hashes. |
| `reviews/instructor-queue/instructor-review-queue.controller.ts` | `InstructorReviewQueueController` | Endpoints for listing and viewing pending instructor reviews. |
| `reviews/instructor-resolution/instructor-review-resolution.controller.ts` | `InstructorReviewResolutionController` | Endpoints for approving, editing, replacing, or dismissing flagged responses. |
| `reviews/student-inbox/student-review-inbox.controller.ts` | `StudentReviewInboxController` | Endpoints for students to view instructor review resolutions. |

### 2.7 Audit and health capabilities
| File path | Primary symbols | Description |
|---|---|---|
| `audit/audit.service.ts` | `AuditService` | Writes immutable entries to the `audit_logs` table. |
| `audit/access-audit.service.ts` | `AccessAuditService` | Logs authorization failures and security events without throwing errors. |
| `health/health.controller.ts` | `HealthController` | Terminus health check endpoints for liveness and readiness probes. |

---

## 3. Platform adapters (`server/src/platform/`)

| File path | Primary symbols | Description |
|---|---|---|
| `database/prisma.service.ts` | `PrismaService` | Prisma client lifecycle wrapper for NestJS connection management. |
| `database/database-transaction.ts` | `DatabaseTransactionRunner` | Transaction runner interface separating business logic from Prisma clients (ADR 0007). |
| `cache/redis.service.ts` | `RedisService` | Redis client wrapper for rate limits and quota tracking. |
| `document-storage/local-pdf-storage.adapter.ts` | `LocalPdfStorageAdapter` | Stores uploaded PDFs on disk with 0600 permissions and UUID names. |
| `ai/embedding/embedding-provider.factory.ts` | `createEmbeddingProvider` | Factory choosing between Gemini and deterministic local embedding providers. |
| `ai/upstream/gemini-chat-project-pool.ts` | `GeminiChatProjectPool` | Rotates Gemini API requests across projects to avoid rate limits (ADR 0008). |
| `ai/upstream/structured-chat.transport.ts` | `StructuredChatTransport` | HTTP client for OpenAI-compatible chat endpoints with request deadlines. |
| `config/env.schema.ts` | `validateEnv()` | Zod schema that validates environment variables at startup. |

---

## 4. Frontend codebase map (`client/src/`)

### 4.1 Domain features (`client/src/features/`)
| Feature directory | Public interface file or barrel | Responsibilities |
|---|---|---|
| `features/auth/` | `features/auth/session/interface/index.ts` | Login forms, session state, JWT decoding, and token refresh in `authenticated-api-client.ts`. |
| `features/chat/` | `features/chat/` | Chat message feed, conversation list, source citations, and debug inspection panel. |
| `features/courses/` | `features/courses/` | Course selection, enrollment flows, and readiness diagnostic cards. |
| `features/materials/` | `features/materials/` | Drag-and-drop PDF upload UI and material processing badges. |
| `features/reviews/` | `features/reviews/interface/` | Instructor review panel and student resolution inbox. |
| `features/user-management/`| `features/user-management/` | User table, CSV bulk import dialog, and password reset forms. |
| `features/audit/` | `features/audit/` | Audit log table and filter controls. |
| `features/system-status/` | `features/system-status/` | Status cards for PostgreSQL, Redis, and AI endpoints. |

### 4.2 Role workspaces (`client/src/workspaces/`)
| Workspace directory | Primary components | Target persona |
|---|---|---|
| `workspaces/student/` | `StudentLayout`, `TutorPage` | Student chat view, citations drawer, and review modal. |
| `workspaces/instructor/` | `InstructorLayout`, `InstructorDashboardPage` | Instructor course manager, material uploader, and review queue. |
| `workspaces/admin/` | `AdminLayout`, `AdminDashboardPage` | User administration, audit explorer, and system status dashboard. |
| `workspaces/_shared/` | `AuthenticatedNavbar`, `WorkspaceHeader` | Top navigation bar, breadcrumbs, and user menu. |

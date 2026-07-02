# Morshid Project Delivery Plan

Date: July 2, 2026  
Delivery window: 8 weeks  
Team: ThinkFirst, 5 full-stack developers  
Protected P0 course: Python Programming

## Source Documents

This plan is based on:

- `README.md`
- `docs/project-pitch.md`
- `docs/project-description.md`
- `docs/morshid-decisions.md`

## Delivery Frame

Morshid is an 8-week ITI graduation project. The plan protects one complete P0 loop:

1. Admin creates users and course assignments.
2. Instructor uploads clean text-based Python PDFs.
3. Student chats inside the assigned Python Programming course.
4. Morshid retrieves only course material.
5. Morshid gives cited Socratic guidance without final answers.
6. Unsupported, conflicting, or risky guidance is flagged.
7. Instructor reviews the flag.
8. Student sees the review result.

The implementation defaults are:

- Frontend: TanStack Start, React, Shadcn/ui, TailwindCSS v4, TanStack Query, Zustand.
- Backend: NestJS as the only public API.
- Database: PostgreSQL with pgvector.
- Cache and limits: Redis.
- Files: local Docker volume for PDFs.
- Auth: email/password, Admin-created users, Student/Instructor/Admin RBAC.
- AI/RAG: provider abstraction, backend prompt templates, course-scoped retrieval, simple top-k vector retrieval first.
- Streaming: NestJS SSE preferred, full-response fallback if needed.
- Infra: Docker Compose, Caddy, lightweight CI, manual deploy.
- Conditional Django: only if ITI requires Python; it stays internal behind NestJS.

Cut-first or later scope:

- CSV import.
- DOCX.
- Analytics and rich dashboards.
- Reviewed-answer second-tier RAG.
- Arabic/RTL.
- SSO/OAuth.
- Full CI/CD.
- Advanced retrieval, hybrid search, reranking, and complex evaluation automation.

## Scrum Structure

### Roles and Owner Model

All five members are full-stack developers, but each sprint has clear owners:

| Owner role | Primary accountability | Backup responsibility |
|---|---|---|
| Product and UX owner | Landing page, sign-in UX, Student chat UX, role dashboards, demo flow, reviewer-facing polish | Acceptance criteria clarity, usability QA |
| NestJS owner | API modules, auth, RBAC, course ownership checks, audit logs, Swagger | Backend test patterns |
| AI service owner | Provider abstraction, prompt templates, tutor orchestration, classification, output policy | SSE orchestration integration |
| Ingestion and evaluation owner | PDF extraction, chunking, embeddings, retrieval sanity, golden dataset | RAG tests and source-quality fixtures |
| QA and DevOps owner | Docker Compose, CI, deployment, security tests, cross-course isolation tests, demo reliability | Release checklist and backup demo plan |

Every story has one directly responsible owner and one reviewer from a different owner area. AI-policy and security-sensitive stories require review from both the AI service owner and QA/DevOps owner.

### Sprint Cadence

Each sprint is one week.

| Ceremony | Timebox | Participants | Output |
|---|---:|---|---|
| Sprint planning | 60-90 min, start of week | All | Sprint goal, committed stories, owners, risks |
| Daily scrum | 15 min daily | All | Progress, blockers, ownership changes |
| Backlog refinement | 45 min mid-week | Product/UX, NestJS, AI, QA owners; others as needed | Ready stories for next sprint |
| Technical design checkpoint | 30 min mid-week | Relevant owners | Decisions recorded before implementation spreads |
| Sprint review/demo | 45-60 min end of week | All, optional supervisor | Working demo against acceptance criteria |
| Sprint retrospective | 30 min end of week | All | Process changes, action items |

### Board Workflow

Use GitHub Flow with short-lived feature branches and pull requests.

Story states:

- Backlog.
- Ready.
- In Progress.
- Blocked.
- Review.
- QA.
- Done.

Task states:

- Todo.
- Doing.
- Blocked.
- Done.

### Definition of Ready

A story is ready when:

- It maps to the protected P0 loop or an explicit sprint gate.
- User value and acceptance criteria are clear.
- Required design or API decisions are recorded.
- Dependencies are identified and available.
- Test requirements are listed.
- Owner and reviewer are assigned.
- Scope is small enough to complete within the sprint.
- Cut line is clear if the sprint gets compressed.

### Definition of Done

A story is done when:

- Code is merged through review.
- Acceptance criteria pass locally.
- Required unit, integration, e2e, or security tests are added and passing.
- Role and course-boundary checks are enforced server-side where applicable.
- API changes appear in Swagger/OpenAPI when public.
- User-facing errors are clear and safe.
- Audit events are emitted for security or policy-relevant actions.
- Documentation or `.env.example` changes are updated.
- The sprint demo can show the behavior from a clean seeded environment.

### Blockers Policy

- Raise blockers in daily scrum immediately; do not wait for the next ceremony.
- A blocker older than half a day gets a named unblock owner.
- A blocker older than one day is escalated to the whole team and the sprint scope is rebalanced.
- AI provider or API-budget blockers must have a local fixture/mock path within the same sprint.
- If a gate is at risk, cut from P2 first, then P1. Do not cut the P0 Socratic + RAG + review loop unless replacing implementation depth with a controlled demo path.

### Review Cadence

- Every PR gets one code reviewer.
- Auth, RBAC, course isolation, file upload, AI prompt/policy, and review workflow changes require two reviewers.
- End-of-week demo must use seeded accounts and a fresh database reset where possible.
- Security acceptance tests are reviewed every sprint from Sprint 1 onward.
- The golden demo dataset is reviewed at the end of Weeks 2, 4, 6, 7, and 8.

## Epic List

### Epic 1: Controlled Access to the Python Course

Users can enter Morshid through secure seeded accounts, see only their assigned role/course shell, and operate inside a consistent local development environment.

Primary outcomes:

- Working repo, Docker Compose, PostgreSQL/pgvector, Redis, NestJS, TanStack Start.
- Email/password auth with disabled-account blocking.
- Role and course-assignment foundation.
- Seeded Admin, Instructor, three Students, and Python Programming course.
- Basic role-specific UI shells.

### Epic 2: Admin Course and Account Operations

Admins can manage P0 users, the Python Programming course, course assignments, material metadata, and audit visibility through simple CRUD pages.

Primary outcomes:

- User create/disable/reactivate/password reset.
- Course and assignment management.
- Basic material metadata management.
- Recent audit log view.

### Epic 3: Instructor Material Readiness

The Instructor can upload clean text-based PDFs for the Python course, see processing status, and know whether each source is usable for Student retrieval.

Primary outcomes:

- PDF upload to local Docker volume.
- Material status lifecycle: Processing, Ready, Ready with warning, Failed.
- Text extraction, chunking, pgvector embeddings.
- Retrieval sanity output: extracted text length, chunk count, 2-3 test queries, result.

### Epic 4: Student Course Chat Experience

Students can use private course sessions and receive a responsive chat experience that preserves messages and handles failures safely.

Primary outcomes:

- Student course/session list.
- Create, rename, delete sessions.
- Send messages.
- Optimistic message rendering.
- SSE streaming through NestJS, with full-response fallback.
- Inline retry for failed AI requests.

### Epic 5: Course-Grounded RAG With Citations

Morshid retrieves only from the active course and provides source-labeled, cited guidance for conceptual Python questions.

Primary outcomes:

- Course-filtered vector retrieval.
- Similarity threshold for "not found in uploaded course material".
- Inline citation tags like `[Python Basics, chunk 3]`.
- Right-panel source metadata and excerpts.
- Cross-course retrieval tests.

### Epic 6: Socratic Tutor and Code Diagnosis

Morshid classifies requests and applies the tutoring policy: direct conceptual help when allowed, hints for problem-like prompts, and debugging guidance without corrected full code.

Primary outcomes:

- Request classification.
- Four-level hint ladder.
- Python-only static code diagnosis for snippets around 100 lines or less.
- Output policy check for final-answer leakage, missing labels, missing citations, unsafe content, and policy bypass attempts.
- Golden evaluation dataset coverage.

### Epic 7: Instructor Review and Student Resolution Loop

Unsupported, conflicting, risky, or manually flagged guidance enters a narrow Instructor review queue, and the Student sees the final review outcome.

Primary outcomes:

- Manual Student flag with 3-per-day limit and 200-character reason.
- Automatic flags for missing/correctness-sensitive evidence, conflicting sources, policy check failures, and possible final-answer leakage.
- Instructor review queue with limited context.
- Approve, edit, replace, reject, resolve actions.
- Student chat status and in-app notification after review.

### Epic 8: Secure, Reliable, Demo-Ready Pilot

The team can deploy and demonstrate the P0 loop with safety, observability, usage limits, evaluation evidence, and a tested fallback path.

Primary outcomes:

- Usage limits: 30 chat requests per Student per day, 5 per minute burst, 3 review requests per Student per day.
- Audit events for P0 security and policy actions.
- Caddy and manual deploy path.
- Security acceptance suite.
- Evaluation report.
- Demo script, seeded data, backup plan, and final polish.

## Eight-Week Sprint Plan

### Sprint 1: Foundations and P0 Course Shell

Sprint goal: A fresh developer can run Morshid locally, sign in as each seeded role, and see role-appropriate shells for the seeded Python Programming course with server-side auth, RBAC, course assignment checks, audit foundation, Swagger, CI, and initial security tests.

Main epics: Epic 1, start Epic 2.

Gate: Users, roles, one course, login, and seeded chat shell work end to end.

Detailed Sprint 1 plan appears later in this document.

### Sprint 2: Admin Operations and Golden Demo Data

Sprint goal: Admin can manage the P0 users/course/assignments enough to support the demo, and the team has a locked Python golden dataset by the end of the week.

Main epics: Epic 2, Epic 8.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Complete Admin user operations | Create user form; edit role/name; disable/reactivate; manual password reset; disabled-session invalidation test | NestJS owner |
| Complete course assignment operations | Course detail page; assign/unassign Instructor; assign/unassign Students; assignment boundary guard tests | NestJS owner |
| Material metadata shell | Create/edit material record; status field; course filter; delete/mark unavailable placeholder | Product/UX owner |
| Audit log view | Recent audit events API; Admin table; filters by actor/action/course if simple | QA/DevOps owner |
| Golden dataset v1 | 3 conceptual, 3 problem-like, 3 attempts, 3 code bugs, 2 unsupported, 3 injection, 2 auth tests | Ingestion/evaluation owner |
| P0 sample PDFs | Draft or collect 3-5 clean Python PDFs with permission-safe content; titles and version labels | Ingestion/evaluation owner |
| Security tests expansion | Student cannot access Admin endpoints; Student cannot access Instructor queue; disabled user blocked | QA/DevOps owner |
| UI consistency pass | Landing/sign-in polish; dashboard empty states; responsive smoke check | Product/UX owner |

Deliverables:

- Admin CRUD for users, course, assignments, and material metadata.
- Golden demo dataset v1 committed under docs or test fixtures.
- Security tests for role and disabled-account boundaries.
- P0 sample PDF plan finalized.

### Sprint 3: PDF Upload and Ingestion Pipeline

Sprint goal: Instructor can upload one clean text-based Python PDF and see a usable processing status with extracted text and chunks stored for the course.

Main epics: Epic 3.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| PDF upload API | Multipart endpoint; file type/size validation; local Docker volume storage; ownership guard | NestJS owner |
| Material processing model | Status transitions; error/warning fields; extracted length; chunk count; metadata storage | Ingestion/evaluation owner |
| Text extraction | Clean text PDF parser; unreadable/empty text warnings; duplicate filename/content hash warning if simple | Ingestion/evaluation owner |
| Chunking baseline | Recursive/fixed chunking; course/material/chunk metadata; chunk versioning basics | AI service owner |
| Instructor materials UI | Upload form; status list; failure/warning states; refresh/polling | Product/UX owner |
| Upload security tests | Reject unsupported file type; reject oversize; Instructor only own course; Admin any course | QA/DevOps owner |
| Audit events | material uploaded, failed, ready, deleted/unavailable | QA/DevOps owner |

Deliverables:

- One clean PDF can be uploaded and processed into chunks.
- Instructor sees Processing, Ready, Ready with warning, or Failed.
- Invalid file attempts fail safely and are tested.

### Sprint 4: Retrieval, Embeddings, Citations, and Chat Response Path

Sprint goal: A Student can ask a conceptual Python question and receive a course-grounded cited response using only chunks from the Python course, streamed via SSE or returned via the approved fallback.

Main epics: Epic 4, Epic 5.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Embedding provider abstraction | Embedding interface; env-selected provider; deterministic test/mock provider | AI service owner |
| pgvector retrieval | Store embeddings; course-filtered top-k query; similarity threshold; cross-course fixture | Ingestion/evaluation owner |
| Basic AI provider abstraction | Completion/streaming interface; provider env config; mock provider for tests | AI service owner |
| Student session API | Create/list/rename/delete session; persist messages; assignment guard | NestJS owner |
| SSE chat endpoint | Authorized endpoint; save Student message; stream AI response; save final response and citations | NestJS owner |
| Frontend chat shell completion | Course/session sidebar; message list; input; typing/stream state; retry placeholder | Product/UX owner |
| Citation panel v1 | Inline citation tags; right panel with document title, version, chunk, excerpt, status | Product/UX owner |
| Retrieval tests | Same-course retrieval succeeds; other-course chunks never returned; unsupported query labels not found | QA/DevOps owner |

Deliverables:

- End-to-end conceptual question with retrieved citations.
- SSE path preferred; full-response fallback documented if SSE is unstable.
- Gate 2 proof: one PDF can be ingested, retrieved, cited, and used in a Student response.

### Sprint 5: Socratic Policy, Classification, and Code Diagnosis

Sprint goal: Morshid applies the P0 tutoring policy across conceptual, problem-like, attempted-solution, unsupported, and Python code-diagnosis requests.

Main epics: Epic 6.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Request classification | Structured categories; schema validation; obvious rule checks; test fixtures | AI service owner |
| Prompt templates | Versioned backend templates for conceptual, problem-like, attempt diagnosis, code diagnosis, unsupported, safety | AI service owner |
| Hint ladder implementation | 4-level hint behavior; attempt-required logic; analogous example rule; no final answer rule | AI service owner |
| Python code diagnosis | Detect Python snippets; line/block references; max length handling; no server-side execution | AI service owner |
| Output policy check v1 | Final-answer leakage check; missing citation/label check; unsupported correctness-sensitive check | Ingestion/evaluation owner |
| Frontend labels | Course-grounded, general not found, uncertain awaiting review, instructor-reviewed placeholder | Product/UX owner |
| Golden dataset run v1 | Run dataset manually or scripted; record pass/fail notes; tune prompts | Ingestion/evaluation owner |
| Policy/security tests | Prompt injection cannot reveal system prompt or force final answer; document injection ignored | QA/DevOps owner |

Deliverables:

- Socratic behavior works for the core demo examples.
- Code diagnosis identifies bugs without corrected full code.
- Direct-answer leakage tests exist and are tracked.

### Sprint 6: Flags, Instructor Review, and Student Outcome

Sprint goal: Risky or disputed guidance enters Instructor review, and the Student sees the resolved result in the original chat.

Main epics: Epic 7.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Flag model and API | Automatic/manual flag creation; flag reason/type; 3-per-day manual limit; 200-character reason | NestJS owner |
| Review queue | Instructor sees only owned course flags; count badge; list by status/type/date | Product/UX owner |
| Review detail | Student identity; course; flag reason; Student message; AI response; citations; at most 1 previous/next message | Product/UX owner |
| Review actions | Approve; edit; replace; reject with reason; mark resolved; retain original response | NestJS owner |
| Student outcome UI | Awaiting review status; resolved status; reviewed answer attached to response; notification/bell | Product/UX owner |
| Notification foundation | Polling endpoint; unread count; review completed/rejected/limit reached events | NestJS owner |
| Audit events | flag created; Instructor review action; review status update | QA/DevOps owner |
| Privacy tests | Instructor cannot browse unflagged chats; review context is limited; Student cannot view others' flags | QA/DevOps owner |

Deliverables:

- Gate 3 proof: Socratic policy, code diagnosis, and Instructor review work on the golden demo dataset.
- Student sees review completion or rejection result.
- Instructor cannot access unflagged private chats.

### Sprint 7: Limits, Security, Deployment, and UI Polish

Sprint goal: The P0 loop is stable, rate-limited, auditable, responsive, and deployable with a reviewer-ready interface.

Main epics: Epic 8, polish across Epics 2-7.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Usage limits | Redis counters; daily and burst limits; no AI call when exceeded; clear UI message; usage audit event | NestJS owner |
| Provider failure handling | Preserve Student message; temporary unavailable response; retry; no ungrounded fallback | AI service owner |
| Security suite | Course isolation; role escalation; disabled session; private chat access; prompt injection; upload validation | QA/DevOps owner |
| Caddy and deploy docs | Caddy config; Docker Compose production profile; manual deploy checklist; env/secrets checklist | QA/DevOps owner |
| Dashboard polish | Empty/loading/error states; responsive tables; consistent role navigation; dark/light toggle if time allows | Product/UX owner |
| API hardening | Consistent error codes; Swagger completeness; request validation; global exception filter | NestJS owner |
| Evaluation run v2 | Run golden dataset; record metrics; identify blocker fixes for Sprint 8 | Ingestion/evaluation owner |

Deliverables:

- Gate 4 proof: security tests, cross-course isolation, usage-limit handling, and demo data are stable.
- Manual deployment path is documented and tested at least once.
- UI is coherent enough for graduation reviewers.

### Sprint 8: Evaluation, Demo Prep, and Final Hardening

Sprint goal: The team can repeatedly demonstrate the protected P0 loop with seeded data, documented evidence, and a tested backup path.

Main epics: Epic 8.

Tasks and subtasks:

| Task | Subtasks | Owner |
|---|---|---|
| Final bug fixing | Triage by P0 impact; freeze cut-first scope; fix demo blockers only after mid-week | All owners |
| Evaluation report | Citation accuracy; retrieval relevance; Socratic compliance; code diagnosis; security results | Ingestion/evaluation owner |
| Demo script | Admin path; Instructor upload; Student conceptual; problem hint; code diagnosis; unsupported flag; review resolution; security denial | Product/UX owner |
| Backup demo path | Seeded DB snapshot; sample PDFs preloaded; mock provider option; fallback model env; recorded evidence if provider outage occurs | QA/DevOps owner |
| Final deployment | Deploy to VPS/university server; smoke test; document rollback/restart steps | QA/DevOps owner |
| Presentation assets | Architecture diagram; scope guardrails; test results; screenshots; known limitations | Product/UX owner |
| Final security pass | Re-run acceptance suite; verify no public signup/SSO/CSV/DOCX accidental scope leaks | QA/DevOps owner |

Deliverables:

- Gate 5 proof: evaluation report, bug fixes, backup path, and final presentation assets are ready.
- Final deployed or locally reproducible demo.
- Known limitations documented honestly.

## Sprint 1 Detailed Plan

### Sprint Goal

By the end of Sprint 1, the team can run the project locally with Docker Compose, sign in with seeded P0 demo accounts, enforce basic role and course boundaries server-side, and navigate role-specific shells for Admin, Instructor, and Student. The project also has CI, Swagger/OpenAPI, audit-log foundation, and first acceptance/security tests.

### Assumptions

- The team uses a simple monorepo, not Turborepo unless setup is trivial.
- Prisma is used for the NestJS database layer.
- Auth uses NestJS-owned JWT access tokens plus refresh-token rotation unless BetterAuth proves clean by the end of Sprint 1. If BetterAuth is not integrated by mid-week, fall back to NestJS-owned auth immediately.
- Passwords are seeded for local/demo only through documented seed conventions. Production secrets are not committed.
- The Python Programming course is the only P0 course, but one hidden test course may be seeded for boundary tests.
- PDF upload/ingestion is not required to work in Sprint 1; material CRUD is a shell/metadata surface only.
- Django is not introduced in Sprint 1 unless ITI formally requires it before the sprint starts.

### Dependencies

- Node.js version decision and package manager decision.
- Docker and Docker Compose available on developer machines.
- PostgreSQL image with pgvector support.
- Redis Docker image.
- Team agreement on GitHub Flow and PR review rules.
- Seed credentials policy for demo accounts.
- AI provider keys are not required for Sprint 1.

### Day-by-Day Scrum Plan

| Day | Scrum focus | Target work | End-of-day proof |
|---|---|---|---|
| Day 1 | Align repo and architecture defaults | Monorepo folders, package scripts, Docker Compose for PostgreSQL/pgvector/Redis, NestJS scaffold, TanStack Start scaffold | `docker compose up` starts infrastructure; frontend/backend dev commands boot |
| Day 2 | Persist core identity/course model | Prisma schema, first migration, seed script for users/course/assignments, `.env.example`, config validation | Fresh DB migration and seed creates all P0 accounts and Python course |
| Day 3 | Authenticate and authorize | Auth endpoints, password hashing, JWT/refresh handling, disabled-account blocking, role guard | Seeded users can sign in; disabled seeded/test user is blocked |
| Day 4 | Role shells and Admin skeleton | Landing/sign-in route, route guards, Admin user/course/material CRUD shell, Instructor dashboard shell, Student course/chat shell | Each role lands in the correct shell and cannot open another role shell |
| Day 5 | Audit, Swagger, CI, and tests | Audit service/table, Swagger setup, CI workflow, auth/RBAC/course-boundary tests, sprint review cleanup | CI passes; security acceptance tests pass; Sprint 1 demo script works |

### Sprint 1 Stories

#### Story 1.1: Local Workspace Foundation

As a developer,  
I want a runnable monorepo with frontend, backend, shared conventions, and infrastructure folders,  
So that the team can build the P0 loop consistently from the first week.

Acceptance criteria:

- Given a clean checkout, when a developer follows `README.md`, then backend and frontend dependencies install with documented commands.
- Given local development, when the developer starts infrastructure, then PostgreSQL/pgvector and Redis are available through Docker Compose.
- Given project setup, when config is missing, then the app fails with a clear validation error instead of silent defaults.
- Given a new environment variable is required, when it is added to code, then `.env.example` is updated.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Create monorepo structure | `backend/`, `frontend/`, `infra/`, shared scripts; root package scripts; README setup section | QA/DevOps owner |
| Scaffold backend | NestJS app; health endpoint; config module; validation library; test command | NestJS owner |
| Scaffold frontend | TanStack Start app; TailwindCSS v4; Shadcn/ui baseline; TanStack Query client; Zustand store folder | Product/UX owner |
| Establish code quality | Lint, format, type-check scripts; GitHub Flow branch naming note | QA/DevOps owner |

Test requirements:

- Backend health endpoint smoke test.
- Frontend route smoke test.
- Config validation unit test for missing required variables.

#### Story 1.2: Docker Compose Runtime Foundation

As a developer,  
I want local services for PostgreSQL/pgvector, Redis, and PDF storage,  
So that Sprint 1 and later sprints run against the same service boundaries as the demo.

Acceptance criteria:

- Given Docker Compose is started, when services are healthy, then PostgreSQL, pgvector, Redis, and the PDF volume are available.
- Given the backend starts, when it connects to the database and Redis, then health checks report ready.
- Given the database is rebuilt, when migrations and seed run, then the P0 course data is recreated.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Compose file | PostgreSQL with pgvector; Redis; named PDF volume; backend/front-end service placeholders if useful | QA/DevOps owner |
| Service health checks | DB ready check; Redis ready check; backend `/health` includes dependency status | NestJS owner |
| Local reset commands | Migrate, seed, and reset scripts documented | QA/DevOps owner |

Test requirements:

- Health endpoint integration test.
- Manual `docker compose up` smoke check.

#### Story 1.3: P0 Identity, Course, Assignment, and Audit Schema

As an Admin,  
I want the system to know users, roles, the Python course, assignments, and audit events,  
So that access can be controlled before AI features are added.

Acceptance criteria:

- Given a fresh database, when migrations run, then tables exist for users, roles/role field, courses, course assignments, materials metadata, sessions/messages shell, refresh tokens, and audit logs.
- Given seed runs, when the database is inspected, then it contains `admin@morshid.demo`, `instructor@morshid.demo`, `student1@morshid.demo`, `student2@morshid.demo`, `student3@morshid.demo`.
- Given seed runs, when assignments are inspected, then the Instructor owns the Python Programming course and all three Students are assigned to it.
- Given audit events are emitted, when stored, then actor, action, target, course id if relevant, timestamp, IP/user agent if available, and metadata JSON are represented.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Prisma schema | User, Course, CourseAssignment, Material, ChatSession shell, Message shell, RefreshToken, AuditLog | NestJS owner |
| Migration and seed | First migration; seed accounts; seed Python course; seed assignments; optional hidden boundary-test course | NestJS owner |
| Seed documentation | Local demo password convention; warning not for production; reset command | QA/DevOps owner |
| Audit foundation | Audit service; audit action enum/constants; create event helper | QA/DevOps owner |

Test requirements:

- Migration test or CI migration check.
- Seed test that asserts required accounts, roles, course, and assignments.
- Audit service unit test.

#### Story 1.4: Email/Password Auth Foundation

As a seeded user,  
I want to sign in and maintain an authorized session,  
So that I can access only the Morshid features allowed for my account.

Acceptance criteria:

- Given valid seeded credentials, when a user signs in, then the API returns an authenticated session/token response and records login success.
- Given invalid credentials, when sign-in is attempted, then the API rejects the request and records login failure without revealing whether the email exists.
- Given a disabled account, when sign-in or token refresh is attempted, then the API rejects the request server-side and records a disabled-account access attempt.
- Given a signed-in user, when they call `/me`, then the API returns id, email, role, display name, disabled status, and assigned courses visible to that role.
- Given logout, when refresh token/session state exists, then it is revoked or invalidated.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Auth API | Sign-in; refresh; logout; `/me`; password hashing; refresh-token storage/rotation | NestJS owner |
| Disabled-account enforcement | Guard or strategy check on every authenticated request; old token blocked for disabled users | NestJS owner |
| Auth DTO validation | Email/password schema; consistent error codes; no user enumeration | NestJS owner |
| Frontend auth client | Sign-in form; auth state; route redirect; logout action | Product/UX owner |
| Audit events | login success/failure; logout; disabled-account access attempt | QA/DevOps owner |

Test requirements:

- Valid login integration test.
- Invalid login integration test.
- Disabled account cannot log in.
- Disabled account cannot use old token/session.
- Logout invalidates refresh.

#### Story 1.5: RBAC and Course Assignment Foundation

As the system,  
I want role and course-assignment checks enforced in NestJS,  
So that Students, Instructors, and Admins cannot cross authorization boundaries.

Acceptance criteria:

- Given a Student, when they call an Admin endpoint, then the request is denied and audited.
- Given a Student, when they request courses, then only assigned courses are returned.
- Given an Instructor, when they request courses, then only owned/assigned courses are returned.
- Given an unassigned user, when they request a course resource, then the request is denied server-side.
- Given route metadata declares roles, when a request lacks an allowed role, then access is denied consistently.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Role guard | `@Roles` decorator; guard; test-only sample endpoints if needed | NestJS owner |
| Course access guard/helper | Course assignment resolver; Admin bypass rules; Instructor ownership rule; Student assignment rule | NestJS owner |
| Frontend route protection | Role-based shell redirects; unauthorized state/page | Product/UX owner |
| Unauthorized audit | Unauthorized access attempt event; target metadata | QA/DevOps owner |

Test requirements:

- Student cannot access Admin endpoints.
- Student cannot access Instructor shell/API.
- Instructor cannot access Admin endpoints.
- Student cannot access unassigned course.
- Course list is scoped by assignment.

#### Story 1.6: Admin CRUD Shell for P0 Users, Course, and Materials

As an Admin,  
I want simple management screens for users, the Python course, assignments, and materials metadata,  
So that the demo setup is visible and controllable before ingestion is implemented.

Acceptance criteria:

- Given an Admin is signed in, when they open the Admin dashboard, then they can see users, the Python course, assignments, and material metadata sections.
- Given an Admin creates or updates a user, when the operation succeeds, then the table reflects the change and an audit event is recorded.
- Given an Admin disables/reactivates a user, when that user attempts access, then server-side account status is enforced.
- Given an Admin assigns a Student to the Python course, when the Student signs in, then the course appears.
- Given a non-Admin opens Admin endpoints or routes, then access is denied.
- Given materials ingestion is not implemented yet, when material metadata is created, then the UI labels it as metadata/shell status, not ready for retrieval.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Admin API shell | Users CRUD; disable/reactivate; reset password placeholder/action; course list/detail; assignments; material metadata CRUD | NestJS owner |
| Admin UI shell | Sidebar/dashboard; users table; course card/table; assignments controls; materials table | Product/UX owner |
| Audit coverage | user created/disabled/reactivated/password reset; assignment changes; material metadata changes | QA/DevOps owner |
| Boundary tests | Non-Admin denied from Admin APIs and UI | QA/DevOps owner |

Test requirements:

- Admin can list seeded users/course.
- Non-Admin cannot call Admin endpoints.
- Disable/reactivate changes server behavior.
- Assignment changes affect Student course list.

#### Story 1.7: Instructor and Student P0 Shells

As an Instructor or Student,  
I want role-appropriate starter screens for the Python course,  
So that later material, chat, and review features have stable navigation targets.

Acceptance criteria:

- Given the Instructor signs in, when they open the dashboard, then they see the Python Programming course, materials area, review queue placeholder/count, and upload placeholder.
- Given a Student signs in, when they open the app, then they see the assigned Python Programming course and a basic chat/session shell.
- Given a Student has no assigned courses in a test fixture, when they sign in, then they see a clear empty state.
- Given any role signs in, when they use the app, then the top-level navigation and sign-out are present.
- Given the Student chat shell is present, when a message is typed in Sprint 1, then it is not sent to AI yet and the UI clearly indicates chat is not connected until later sprint work.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Landing and sign-in route | Root landing page; sign-in CTA; sign-in form; first impression polish | Product/UX owner |
| Instructor dashboard shell | Course summary; materials placeholder; review queue placeholder; source status placeholder | Product/UX owner |
| Student shell | Course selector/sidebar; session list placeholder; chat panel; disabled send or local-only placeholder | Product/UX owner |
| Role routing | Redirect by role after sign-in; protect role routes | Product/UX owner |
| API support | Course list by role; minimal session shell endpoint if needed | NestJS owner |

Test requirements:

- Frontend smoke/e2e for landing to sign-in to role shell.
- Student sees only assigned Python course.
- Instructor sees only owned Python course.
- Unauthorized role route shows denied/redirect state.

#### Story 1.8: Swagger, CI, and Initial Acceptance/Security Tests

As the team,  
I want automated checks and API documentation from Sprint 1,  
So that later changes do not break auth, role boundaries, or the demo setup silently.

Acceptance criteria:

- Given the backend is running, when Swagger is opened, then auth, users, courses, materials shell, and health endpoints are documented.
- Given a PR is opened, when CI runs, then lint, type-check, tests, and build checks execute.
- Given auth and RBAC tests run, when a boundary is violated, then the request fails and the test asserts the failure.
- Given the Sprint 1 demo script is followed from a fresh seed, then each seeded account reaches its expected shell.

Tasks:

| Task | Subtasks | Owner |
|---|---|---|
| Swagger/OpenAPI setup | NestJS Swagger module; tags; auth scheme; DTO annotations for Sprint 1 APIs | NestJS owner |
| CI workflow | Install; lint; type-check; backend tests; frontend tests/build if scaffold supports it | QA/DevOps owner |
| Acceptance test suite | Auth success/failure; disabled account; role boundaries; course assignment boundaries | QA/DevOps owner |
| Sprint demo script | Fresh setup commands; credentials; role-shell walkthrough; expected pass/fail boundary checks | Product/UX owner |

Test requirements:

- CI must run all Sprint 1 automated tests.
- Acceptance tests must include:
  - auth success and failure
  - disabled account blocked
  - Student denied from Admin boundary
  - Student denied from Instructor boundary
  - Instructor denied from Admin boundary
  - Student sees only assigned course
  - unassigned course access denied

### Sprint 1 Completion Checklist

- Repository uses the agreed simple monorepo structure.
- Docker Compose starts PostgreSQL/pgvector and Redis.
- Local PDF volume exists in Compose even if upload is not implemented.
- NestJS backend scaffold is running.
- TanStack Start frontend scaffold is running.
- Shared `.env.example` and config validation are present.
- Prisma schema and first migration exist.
- Seed creates:
  - `admin@morshid.demo`
  - `instructor@morshid.demo`
  - `student1@morshid.demo`
  - `student2@morshid.demo`
  - `student3@morshid.demo`
  - Python Programming course
  - Instructor ownership/assignment
  - Student course assignments
- Auth endpoints work for seeded users.
- Disabled-account blocking is enforced server-side.
- RBAC guard and course assignment helper exist.
- Landing page and sign-in route exist.
- Admin user/course/material CRUD shell exists.
- Instructor dashboard shell exists.
- Student course/chat shell exists.
- Audit-log table/service exists and records Sprint 1 events.
- Swagger/OpenAPI is available for Sprint 1 endpoints.
- Lightweight CI runs lint/type-check/tests/build as available.
- Initial acceptance/security tests pass for auth, disabled accounts, role boundaries, and course assignment boundaries.

### Sprint 1 Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Auth library integration takes too long | Delays all role/course work | Timebox BetterAuth to early week; use NestJS-owned JWT fallback immediately if integration is unclear |
| Frontend scaffold conflicts with Tailwind v4/Shadcn setup | UI shell slips | Keep minimal component set; avoid design-system overbuild; prioritize sign-in and role shells |
| Prisma/pgvector setup friction | Later RAG work blocked | Install pgvector in Compose during Sprint 1; vectors can be added in Sprint 3/4 migrations if needed |
| Too much Admin CRUD depth | P0 foundation slips | Build simple tables/forms only; CSV, bulk actions, analytics, and rich dashboards are cut-first |
| Tests are postponed | Security regressions become invisible | Add boundary tests in the same story as guards/endpoints |
| Seed credentials mishandled | Demo or security confusion | Document local-only demo password convention; never commit production secrets |

### Exact Sprint 1 Deliverables

At Sprint 1 review, the team should demonstrate:

1. Fresh setup from documented commands.
2. Docker Compose services running for PostgreSQL/pgvector and Redis.
3. Database migration and seed from empty state.
4. Sign-in as `admin@morshid.demo`.
5. Admin dashboard showing seeded users, Python course, assignments, and material metadata shell.
6. Sign-in as `instructor@morshid.demo`.
7. Instructor dashboard showing the Python Programming course, material area placeholder, and review queue placeholder.
8. Sign-in as `student1@morshid.demo`.
9. Student shell showing only the assigned Python Programming course and chat/session placeholder.
10. Attempted Student access to Admin endpoint fails.
11. Attempted Student access to Instructor endpoint fails.
12. Disabled account access fails server-side, including old token/session where implemented.
13. Course assignment boundary test passes.
14. Audit log contains login, logout, user/assignment change, disabled access, and unauthorized access events.
15. Swagger/OpenAPI is available.
16. CI passes.

## Cross-Sprint Quality Requirements

### Security Acceptance Coverage

These scenarios must exist by Sprint 7, with Sprint 1 starting the foundation:

- Student cannot access Admin endpoints.
- Student cannot access Instructor review queue.
- Student cannot access another Student's session/messages.
- Student cannot retrieve materials/chunks from another course.
- Instructor cannot view unflagged private chats.
- Disabled user cannot use old session/token.
- Prompt injection cannot reveal system prompt or force final answer.
- Uploaded document text cannot override system policy.
- AI response without required citation/source label is blocked or flagged.

### Evaluation Coverage

The golden dataset must be locked by the end of Sprint 2 and run at each major gate:

- 3-5 conceptual Python questions with expected citations.
- 3-5 problem-like questions where final answers must not be given.
- 3-5 Student attempts with common mistakes.
- 3-5 short Python snippets with known bugs.
- 2-3 unsupported questions requiring "not found in uploaded material" labels.
- 2 conflicting-source cases if easy to create naturally.
- 3-5 prompt-injection/final-answer-bypass attempts.
- 2-3 authorization/course-isolation tests.

### Scope Guardrails

Protected through Week 8:

- One seeded Python Programming course.
- Clean text-based PDFs only.
- Course-scoped retrieval and citations.
- Socratic hints and no final answers for assessed-looking prompts.
- Static Python code diagnosis without execution.
- Instructor review for flagged exchanges.
- Student-visible review result.
- Auth, RBAC, disabled-account blocking, and course isolation.

Cut before P0 is threatened:

- CSV import.
- DOCX.
- Reviewed-answer second-tier RAG.
- Rich dashboards and analytics.
- Arabic/RTL.
- SSO/OAuth.
- Full CI/CD.
- Advanced retrieval beyond simple top-k vector search.
- Complex notification delivery beyond polling/status updates.


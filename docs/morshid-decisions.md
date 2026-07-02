# Morshid Decisions

**Date:** July 2, 2026
**Purpose:** This file captures the concrete P0 app decisions that were missing or underdefined. It should guide the SRS, architecture, implementation plan, and demo preparation.

## 1. P0 Product Slice

P0 supports exactly one controlled computing course for the graduation demo:

- Course: **Python Programming**
- Users: **1 Admin, 1 Instructor, 3 Students**
- Materials: **3-5 clean text-based PDF course files**
- Goal: prove the core loop:
  1. Student asks a question.
  2. Morshid retrieves only from the Python course.
  3. Morshid gives Socratic and/or cited guidance.
  4. Unsupported, conflicting, or risky guidance is flagged.
  5. Instructor reviews the flagged exchange.
  6. Student sees the review outcome.

P0 does not attempt a broad multi-course production pilot.

## 2. Demo Accounts

Seeded demo accounts:

- `admin@morshid.demo`
- `instructor@morshid.demo`
- `student1@morshid.demo`
- `student2@morshid.demo`
- `student3@morshid.demo`

Students are assigned only to the Python Programming course. The Instructor owns only that course.

## 3. Course Materials

P0 supports **clean text-based PDF only**.

Recommended P0 PDFs:

- `Python Basics - Variables and Types`
- `Control Flow - If Statements and Loops`
- `Functions and Scope`
- `Lists, Dictionaries, and Common Errors`
- `Debugging Python Code`

Each PDF requires:

- document title
- course
- version label
- optional topic/week metadata

DOCX is P1. OCR and scanned documents are future scope.

## 4. Retrieval Sanity Check

For P0, each uploaded PDF gets a simple retrieval sanity check.

The system should show:

- extracted text length
- chunk count
- 2-3 retrieval test queries
- result: `Ready`, `Ready with warning`, or `Failed`

Source statuses:

- `Processing`
- `Ready`
- `Ready with warning`
- `Failed`

This is not a full ingestion QA platform. It only proves that the uploaded source is usable for the demo.

## 5. Socratic Tutor Behavior

For problem-like or assignment-like requests, Morshid uses a 4-level hint ladder:

1. If no attempt is provided, ask what the Student tried and give only a small starting hint.
2. If the attempt is weak or incorrect, point out the likely misconception and ask one guiding question.
3. If the attempt is partial, confirm the correct part, identify the next step, and give a targeted hint.
4. If the Student is still stuck, solve a similar but different example, then ask the Student to apply the pattern.

Allowed:

- direct conceptual explanations
- short syntax examples
- debugging hints
- similar worked examples

Forbidden:

- final answer to the exact problem
- corrected full code for the submitted task
- complete assignment implementation
- "here is the complete solution" style responses

## 6. Code Diagnosis

P0 supports static Python code diagnosis.

Rules:

- Max pasted code: about 100 lines.
- Python only.
- No server-side execution of untrusted code.
- Morshid may identify likely bugs, explain concepts, point to suspicious lines/blocks, and suggest what to inspect next.
- Morshid must not rewrite the full corrected solution.

## 7. Unsupported or Conflicting Sources

If the course PDFs support the answer:

- label as `Course-grounded`
- include citations

If the PDFs do not support a safe conceptual question:

- Morshid may answer with general knowledge
- label as `General explanation - not found in uploaded course material`

If the PDFs do not support an assignment-like or correctness-sensitive question:

- give limited learning guidance
- label uncertainty
- create an Instructor review flag

If sources conflict:

- disclose the conflict
- create an Instructor review flag

## 8. Citations

P0 citation format:

- Inline citation tag, for example: `[Python Basics, chunk 3]`
- Source panel metadata:
  - document title
  - version label
  - topic/week if available
  - short quoted excerpt
  - source status

Page-level citations and document viewer are P1/future.

## 9. Instructor Review

P0 review triggers:

- Student manually flags a response.
- Morshid uses general knowledge for an assignment-like or correctness-sensitive question.
- Retrieved sources conflict.
- Output policy check detects possible final-answer leakage.
- AI response fails required citation/source-label rules.

Manual Student review limit:

- 3 review requests per Student per day
- optional reason limited to 200 characters

Instructor review visibility:

- Student identity
- course
- flag reason/type
- Student message
- AI response
- retrieved source snippets/citations
- at most 1 previous and 1 next message if available
- review action history for that flag

Instructor cannot browse unflagged private chats.

Instructor actions:

- approve
- edit response
- replace response
- reject Student review request with reason
- mark resolved

After resolution:

- reviewed outcome is attached to the original flagged response
- Student sees status/update in chat and notification
- original AI response is retained
- Instructor-reviewed answer, timestamp, Instructor identity, and reason/action are retained
- reviewed answers are not automatically reused in P0

## 10. Notifications

P0 uses simple in-app notifications/status updates.

Required notifications/status:

- Student sees when review is completed.
- Student sees when manual review request is rejected.
- Student sees when usage limit is reached.
- Instructor sees review queue count when opening dashboard.
- Source upload status is visible on the materials page.

Implementation may use polling or page refresh. No email, push notifications, WebSocket notifications, or notification preferences in P0.

## 11. Authentication and Accounts

P0 authentication scope:

- email/password login
- logout
- Admin-created users
- roles: Admin, Instructor, Student
- Admin can create users manually
- Admin can assign users to the Python course
- Admin can disable/reactivate users
- Admin can reset passwords manually
- disabled users are blocked server-side, including old sessions/tokens

BetterAuth is allowed only if it proves clean integration by the end of Week 1. If not, fall back to NestJS-owned auth.

NestJS must enforce:

- role authorization
- resource ownership
- course access
- disabled-account blocking

No public signup, SSO, OAuth, email verification, forgot-password email, or CSV import in P0.

## 12. Architecture

Preferred architecture:

- NestJS is the single backend for public APIs, application logic, and AI/RAG orchestration.

Current external constraint:

- ITI currently requires Python.

Conditional fallback:

- If ITI refuses NestJS-only, use an internal Django AI service for the required Python component.
- NestJS remains the only public backend API.
- Django remains internal and handles AI/RAG operations only unless ITI explicitly requires more.

Under both architectures:

- Frontend talks to NestJS.
- NestJS owns auth, RBAC, accounts, courses, sessions, materials, reviews, notifications, audit, and public streaming endpoint.
- PostgreSQL + pgvector and Redis remain.

## 13. Runtime AI Model

Preferred model:

- Sonnet 4.6

Fallback models:

- Haiku 4.5
- any cheaper model provided or approved by ITI

The app must use a provider abstraction so the model can be changed without rewriting the application.

Model choice depends on:

- ITI approval
- API budget
- reliability
- latency
- reasoning quality

## 14. Data Storage

Required P0 services:

- PostgreSQL
- pgvector
- Redis
- local Docker volume for PDFs

PostgreSQL stores:

- users
- roles
- courses
- enrollments
- sessions
- messages
- materials metadata
- chunks metadata
- embeddings via pgvector
- flags/reviews
- notifications
- audit events

Local Docker volume stores:

- original uploaded PDFs

Redis is required and used for:

- AI request rate limits/usage counters
- short-lived stream/request tokens if needed
- ingestion status or simple queue coordination
- optional unread-count/cache

Postgres remains the source of truth.

## 15. Chat and Sessions

P0 supports private Student chat sessions.

Student can:

- create session
- rename session
- delete session
- send messages
- retry failed AI request

Messages persist. Failed AI request preserves the Student message and offers retry. Chat input is disabled while a response is generating.

Instructor cannot browse unflagged Student sessions.

Archive, search, export, sharing, folders, and tags are not P0.

## 16. Streaming

Preferred P0 behavior:

- authorized NestJS SSE endpoint
- NestJS validates user/course/session
- NestJS calls AI/RAG orchestration
- response streams to frontend through NestJS
- final response and citations are saved in Postgres

Fallback:

- typing indicator
- full response when ready

If SSE is not stable by the end of Week 4, use the fallback and protect the core demo loop.

## 17. Usage Limits

P0 limits:

- 30 AI chat requests per Student per day
- 3 manual review requests per Student per day
- 5 AI chat requests per minute burst limit

Limits are configured through environment/config, not necessarily through UI.

When a limit is reached:

- show a clear message
- preserve the typed message if possible
- do not call the AI provider
- record a usage event

## 18. Audit Logging

P0 audit events:

- login success/failure
- logout
- disabled-account access attempt
- user created/disabled/reactivated/password reset
- role/course assignment changes
- material uploaded/failed/ready/deleted
- flagged response created
- Instructor review action
- chat deleted
- usage limit reached
- unauthorized access attempt
- cross-course access/retrieval prevention event if detected

Audit fields:

- actor user id
- action
- target type/id
- course id if relevant
- timestamp
- IP/user agent if easy
- metadata JSON

No full observability platform is required for P0.

## 19. Admin Scope

P0 Admin dashboard is simple CRUD.

Admin can manage:

- users
- roles
- course assignments
- Python course
- materials
- recent audit log
- usage-limit config visibility/basic settings

CSV import, analytics, charts, bulk actions, and policy-builder UI are not P0.

## 20. Instructor Scope

P0 Instructor dashboard focuses on:

- assigned course details
- assigned materials
- upload PDF
- processing/status/sanity result
- delete or mark unavailable if allowed
- review queue
- open flagged exchange
- approve/edit/replace/reject/resolve
- completed reviews list

No student analytics, weak-topic dashboard, full chat browsing, reviewed-answer library editor, or multi-instructor routing in P0.

## 21. UI/UX Boundary

Detailed UI/UX decisions are deferred.

This file only captures:

- functional scope
- roles and permissions
- data boundaries
- architecture constraints
- evaluation/demo requirements

Deferred:

- exact Student UI layout
- dashboard designs
- visual design
- color/theme decisions
- component-level choices
- landing-page copy beyond required policy notice

The existing frontend stack remains:

- TanStack Start
- React
- Shadcn/ui
- TailwindCSS
- TanStack Query
- Zustand

## 22. Evaluation Dataset

P0 requires a locked Python golden dataset by the end of Week 2.

Recommended dataset:

- 5 conceptual Python questions with expected citations
- 5 problem-like questions where final answers must not be given
- 5 Student attempts with common mistakes
- 5 short Python code snippets with known bugs
- 3 unsupported questions requiring "not found in uploaded material" label
- 2 conflicting-source cases if easy to create naturally
- 5 prompt-injection/final-answer-bypass attempts
- 3 authorization/course-isolation tests

Each item includes:

- input prompt
- expected classification
- expected source/citation behavior
- expected allowed/forbidden answer behavior
- pass/fail notes

LLM-as-judge is optional and depends on ITI token/API budget. Human/team review remains the authority for P0 evaluation.

## 23. Privacy Notice

Students must see a short notice before first chat use.

Recommended wording:

> Morshid is a learning assistant. Your private chats are visible only to you unless a response is flagged for review. Flagged exchanges may be reviewed by the course Instructor with limited context to correct or improve guidance. Morshid does not grade you or decide academic misconduct.

## 24. Retention

P0 retains:

- chats
- materials
- reviews
- audit records

Retention lasts for the graduation pilot duration. No automatic deletion in P0. Production retention policy is future/institutional work.

## 25. Deployment

P0 deployment target:

- one VPS or university-provided server
- Docker Compose
- Caddy reverse proxy
- environment variables for secrets/config
- local Docker volume for PDFs
- manual deployment steps

Required services:

- frontend
- NestJS
- PostgreSQL
- Redis
- Caddy
- Django only if ITI requires Python

## 26. CI and Documentation

P0 CI:

- lightweight CI
- lint/type-check/tests/build checks
- manual deploy

P0 API docs:

- Swagger/OpenAPI for NestJS public APIs
- internal contract document only if Django is used

NestJS Swagger should cover:

- auth
- users
- courses
- materials
- sessions/messages
- flags/reviews
- notifications

## 27. Security Acceptance Tests

P0 must pass:

1. Student cannot access Admin endpoints.
2. Student cannot access Instructor review queue.
3. Student cannot access another Student's session/messages.
4. Student cannot retrieve materials/chunks from another course.
5. Instructor cannot view unflagged private chats.
6. Disabled user cannot use old session/token.
7. Prompt injection cannot reveal system prompt or force final answer.
8. Uploaded document text cannot override system policy.
9. AI response without required citation/source label is blocked or flagged.

## 28. Graduation Demo Proof Checklist

The demo must prove:

1. Admin creates/assigns users to Python course.
2. Instructor/Admin uploads PDF and sees ready/sanity status.
3. Student asks conceptual question and gets cited course-grounded answer.
4. Student asks problem-like question and gets hints, not final answer.
5. Student submits buggy Python code and gets diagnosis, not corrected full code.
6. Unsupported/uncertain answer is labeled and flagged.
7. Instructor reviews flagged exchange and resolves it.
8. Student sees reviewed outcome/status.
9. Unauthorized access/cross-course/private-chat test fails correctly.
10. Usage limit or provider failure shows clear safe message.

## 29. Deferred Decisions

The following are intentionally deferred:

- detailed UI/UX decisions
- demo backup path if AI provider/token budget fails
- broader deferred-decision catalog
- production retention policy
- DOCX implementation details
- reviewed-answer reuse and second-tier RAG
- analytics or learning-progress features

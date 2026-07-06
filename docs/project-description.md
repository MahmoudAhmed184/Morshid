# Morshid — Project Description

**Date:** July 1, 2026  
**Product name:** Morshid (مرشد)  
**Initial context:** ITI Graduation project  
**Primary audience:** Graduation reviewers and the teams producing the requirements, SRS, architecture, and evaluation documents

## 1. Document Purpose and Authority

This document defines the agreed high-level description of Morshid: its vision, users, scope, core behavior, workflows, business rules, user-story inventory, pilot success criteria, assumptions, risks, and open questions.

It is the authoritative starting point for subsequent requirements discovery. Detailed functional requirements, acceptance criteria, data models, interfaces, technology choices, and test procedures belong in the SRS, architecture, and evaluation documents.

## 2. Product Summary

Morshid is an AI-powered Socratic teaching assistant for higher-education students. It helps students understand course material through guided questions, hints, reasoning steps, source-grounded explanations, and citations instead of simply giving final answers.

The graduation claim is:

> Morshid is a course-grounded AI learning assistant that helps students understand concepts through guided hints, citations, and instructor-reviewed support without giving away assessed solutions.

Morshid is not a general chatbot, a full learning-management system, or an academic decision-maker. Its distinguishing combination is:

- Enforced Socratic guidance for problem-like requests
- Retrieval from sources scoped to one course
- Transparent citations and guidance labels
- Instructor review of flagged or uncertain guidance
- Code diagnosis and debugging guidance for student-submitted code

General-purpose AI assistants provide broad help, while source-centered notebook tools emphasize working with supplied material. Morshid is intentionally narrower: it combines course grounding with learning rules and Instructor oversight.

## 3. Problem and Vision

### 3.1 Problem

Students increasingly use general-purpose AI to complete assignments and solve problems without doing the reasoning themselves. In this pattern, the student makes the AI the pilot rather than using it as a learning aid. The result can be shallow understanding, copied solutions, unverifiable answers, and reduced practice in independent thinking.

Instructors also face repeated student questions, limited visibility into common confusion, and difficulty trusting or correcting the AI-generated guidance students receive elsewhere.

### 3.2 Vision

Morshid should make the student try, think, and explain an attempt. It should provide enough support to move learning forward without replacing the student's reasoning. Course materials and instructor oversight should make the guidance more relevant, transparent, and accountable than an unrestricted chatbot response.

The MVP primarily benefits students. Instructors and institutions are secondary beneficiaries through more consistent guidance, reviewable uncertainty, and controlled course boundaries.

## 4. Pilot Context and Supported Domain

Morshid will begin as a controlled ITI Graduation project pilot. The future target may include broader higher education.

The MVP focuses on higher-education computing courses, including:

- Programming
- Software engineering
- Databases
- Networks
- Artificial intelligence
- Theoretical computing

The underlying approach may later support other text-based courses. The MVP does not promise strong support for advanced mathematics or every academic subject.

The implementation is constrained to:

- An 8-week delivery period (early July to late August 2026)
- A team of 5 members operating as full-stack developers
- A low student-project budget
- Simple cloud hosting or a university-provided server
- Paid AI API access with controlled usage (model provided or approved by ITI)
- A reliable graduation demonstration rather than production-scale operation

### 4.1 Team Structure

The team of 5 operates as full-stack developers, meaning every member can contribute to frontend, backend, and AI features as needed.

The practical execution model should still assign clear owners:

- **Product and UX owner:** landing page, chat UX, role dashboards, demo flow, and reviewer-facing polish
- **NestJS owner:** authentication, RBAC, accounts, courses, sessions, uploads API, notifications, and audit events
- **AI service owner:** RAG pipeline, Tutor Agent behavior, classification, citations, and LLM provider integration
- **Ingestion and evaluation owner:** document parsing, chunking, indexing, retrieval tests, golden datasets, and scoring
- **QA and DevOps owner:** Docker, CI, deployment, security tests, cross-course isolation tests, and demo reliability

## 5. Product Model

### 5.1 Course Workspace

Each course acts as a separate notebook with:

- A shared, course-scoped knowledge base managed by the course Instructor or an Admin
- Private chat sessions belonging to each assigned Student
- A course-scoped reviewed-answer library

Every chat belongs to exactly one course. Retrieval and reviewed guidance must never cross course boundaries.

At a high level, Morshid combines a large language model (LLM), retrieval-augmented generation (RAG), specialized tutoring behavior, and human Instructor review. Provider, model, storage, and orchestration choices belong in the architecture document.

### 5.2 Student Journey

The primary Student journey is:

1. Visit the landing page and click "Sign In."
2. Sign in with an Admin-created account.
3. View courses assigned by an Admin.
4. Select one course.
5. View available source metadata and manage private sessions for that course.
6. Ask a question, submit an attempted solution, or paste code for diagnosis.
7. See the message appear immediately; observe a typing indicator while the AI generates.
8. Receive appropriately labeled Socratic guidance streamed in real time.
9. View citations when course sources were used.
10. Flag incorrect, confusing, or unhelpful guidance when necessary.
11. Receive an in-app notification if an Instructor later reviews the guidance.

The main Student interface is a mobile-responsive, sidebar-driven conversational interface similar in layout to mainstream AI chat products. A separate Student dashboard is not required for the MVP.

### 5.3 User Interface Layout

The primary layout follows a sidebar-driven pattern:

- **Left sidebar:** Course selection and session list
- **Main area:** Chat conversation with streaming AI responses
- **Right panel (collapsible):** Citations and source information
- **Top bar:** User menu, notifications bell, theme toggle

Admin and Instructor roles have separate dashboard views with tables and cards for their management tasks. The interface defaults to a dark theme with a light theme toggle.

A polished landing/marketing page at the root URL introduces Morshid, highlights key features, and provides a "Sign In" button. This is the first impression for graduation reviewers.

## 6. Actors and Responsibilities

### 6.1 Student

A Student is assigned to courses by an Admin and can:

- Ask course-related questions in private course chats
- Submit attempted solutions for diagnosis and the next useful hint
- Submit code for debugging guidance (identifying bugs, explaining concepts behind mistakes, providing hints without fixing the code)
- Receive direct conceptual explanations or Socratic problem guidance
- View guidance labels and citations
- View metadata for available course sources
- View citations when authorized for the course
- Create, rename, archive, and delete personal chat sessions
- Manually request Instructor review of a response up to 3 times per day, with an optional reason limited to 200 characters
- Receive review, correction, and usage-limit notifications

Students cannot upload official course sources, join courses freely, view other students' chats, or retrieve content from another course.

### 6.2 Instructor

An Instructor manages educational content and review activity for assigned courses. In the MVP, one Instructor owns each course. Support for multiple Instructors per course is a future extension.

An Instructor can:

- Request a course and manage materials for owned courses after Admin creation
- Upload, archive, replace, and delete materials for owned courses
- Monitor parsing, indexing, retrieval-test, and extraction quality
- Review only automatically or manually flagged exchanges
- Approve, edit, reject, or replace flagged guidance
- Provide a reason when rejecting a Student's review request
- Add approved guidance to the reviewed-answer library explicitly
- Add, edit, withdraw, or supersede manual reviewed guidance

An Instructor does not have general access to unflagged private conversations.

### 6.3 Admin

An Admin controls the pilot's accounts, courses, assignments, permissions, and system-wide policy. An Admin can:

- Create, disable, reactivate, and reset passwords for accounts
- Bulk import accounts via CSV upload in P2/full MVP scope (name, email, role, course assignments) with validation, duplicate detection, and results report
- Create courses and assign Students and Instructors
- Manage materials for any course
- Configure retention, allowed file types, file-size limits, AI usage limits, flagging rules, and enrollment controls
- Review basic system and audit logs
- Delete chats when authorized by policy
- Mark a course as ended
- Manually trigger retention cleanup for ended courses

Public registration is not available in the MVP.

## 7. Core Product Capabilities

### 7.1 Socratic Tutor

The Tutor capability handles Student chat, retrieves course context, applies the academic-integrity policy, cites sources, labels uncertainty, and creates review flags where needed.

Its behavior depends on the request:

- Definitions and conceptual questions may receive direct explanations.
- Problem-like requests receive questions, hints, reasoning steps, and feedback on attempts.
- Homework, assignment, practice, and exam-like requests must not receive the final solution.
- A different but analogous worked example may be solved fully.
- Short code fragments and conceptual code examples are allowed.
- The Student's assessed programming task must not be completed for them.
- Unsafe requests receive a refusal.

This policy applies to all problem-like requests even when Morshid cannot prove that the work is formally assessed. Morshid does not accuse Students of misconduct and does not determine whether academic misconduct occurred.

### 7.2 Code Diagnosis and Debugging Guidance

Morshid supports code-level tutoring for CS courses. When a Student submits code:

- Morshid identifies bugs, logic errors, or conceptual mistakes in the submitted code.
- Morshid explains the concept behind the mistake and provides a hint toward the fix.
- Morshid does not fix the code for the Student or provide the corrected version.
- The same Socratic policy applies: guide the Student's reasoning, do not replace it.

This capability is integral to the Tutor Agent and follows the same retrieval, citation, and flagging rules as text-based tutoring.

### 7.3 Course-Grounded Retrieval

Morshid primarily answers from uploaded materials associated with the active course. The MVP supports text-based PDF and DOCX sources.

For every course-grounded factual answer:

- Relevant course sources must be retrieved.

If course sources are insufficient, Morshid may provide clearly labeled general knowledge only for safe conceptual help. It must state that the explanation was not found in uploaded course material. Guidance affecting correctness or grading must be flagged for Instructor review.

If sources conflict, Morshid must show both sources, disclose the conflict, and create a review flag when the conflict is important.

Guidance labels must distinguish:

- Course-grounded AI guidance
- General knowledge not found in course sources
- Instructor-reviewed guidance
- Uncertain guidance awaiting Instructor review

### 7.4 Course Material Ingestion

The ingestion capability processes uploaded PDF and DOCX materials, extracts text, divides it into retrievable units, creates searchable representations, indexes the content within its course, and validates ingestion quality.

Each upload requires:

- Document title
- Course
- Version label

Section, week, and topic metadata are optional.

Source quality includes:

- Successful file parsing
- Successful indexing
- An acceptable retrieval sanity result; full MVP expands this into 3 generated test questions from document content that are run through the RAG pipeline to verify the document's chunks are retrievable
- Warnings for unreadable pages, scanned PDFs, missing pages, or weak text extraction

A source remains unavailable to Students and excluded from retrieval while it is processing, failed, archived, unavailable, or below the accepted quality threshold. An Instructor may fix the source or explicitly accept a warned source.

Duplicate uploads produce a warning and allow the Instructor to replace the existing source, keep both, or cancel. A citation to a deleted source must state that the source is no longer available.

### 7.5 Reviewed-Answer Library

The reviewed-answer library is a full-MVP capability. For P0, the system may simply store Instructor-reviewed outcomes and show them to the affected Student. Second-tier retrieval from the library is useful but not required until P1/P2.

In the full design, the reviewed-answer library serves as a second-tier retrieval source in the RAG pipeline:

- When the Tutor retrieves context, it first searches official course materials, then searches the reviewed-answer library (stored as separate tagged embeddings in the vector store).
- If a reviewed answer matches the student's question closely (above a similarity threshold), it is served directly with an "Instructor-reviewed" label.
- Official course material always outranks reviewed-answer guidance (BR-12).

Approved guidance enters the reviewed-answer library only when the Instructor explicitly selects that action. Instructors may also create entries manually. Every entry:

- Belongs to one course
- Is searched after official course material
- Identifies the approving Instructor and approval date
- Includes a source or reference when available
- Can be edited, withdrawn, or superseded
- Is flagged as possibly outdated when related official material changes

### 7.6 Instructor Review and Flagging

Automatic flags are created after an AI response when:

- Required source material is missing
- Retrieved sources conflict
- The system reports low confidence

Students may also flag incorrect, confusing, or unhelpful responses.

The response remains visible with an "Awaiting Instructor review" warning. The target review time is two working days, but it is not guaranteed.

The Instructor sees the relevant exchange with limited surrounding context and the Student's identity. Students must be told that flagged exchanges may be reviewed for academic support. The Instructor may approve, edit, reject, or replace the guidance and may add a better source. The original Student receives an in-app notification when review is completed.

### 7.7 Accounts, Access, and Session Management

The MVP uses email and password authentication with Student, Instructor, and Admin roles. It supports login, logout, password change, Admin password reset, account disablement, and account reactivation.

Role-based access control is enforced using NestJS Guards with custom role decorators. Guards check both role and resource ownership (e.g., an Instructor can only access their own courses).

Students may create, rename, archive, and delete their own sessions. Admins may delete any chat under the retention and audit policy. Instructors manage only flagged exchanges and their resulting review records.

### 7.8 Notifications

In-app notifications are sufficient for the MVP.

Students are notified when:

- A review is completed
- A manual review request is accepted or rejected
- An AI usage limit is reached

### 7.9 Language

The MVP supports English only. Arabic and mixed Arabic-English support are deferred to post-MVP.

### 7.10 Accessibility

The responsive web application must provide basic accessibility, including keyboard navigation, readable contrast, clear labels, and screen-reader-friendly controls.

### 7.11 Usage Limits and Service Failure

Admins configure AI request or token limits. When a Student reaches a limit, Morshid shows a clear message rather than failing silently.

If the AI provider or required service is unavailable, Morshid must:

- Preserve the Student's submitted message
- Show a clear temporary-unavailability notice
- Allow the Student to retry
- Avoid generating an ungrounded fallback answer

### 7.12 Chat Response Experience

The chat experience follows an optimistic UX pattern:

- The Student's message appears immediately in the chat upon sending.
- A typing indicator is displayed while the AI generates a response.
- The AI response is streamed in real time via Server-Sent Events (SSE), appearing token by token.
- If the request fails, an inline error is shown with a retry button.
- The chat input is disabled while a response is streaming.
- Message ordering is guaranteed by database timestamps.

### 7.13 Hint Ladder and Direct-Answer Boundary

"Socratic" must be implemented as a predictable tutoring pattern, not as vague prompt wording. For problem-like, homework-like, exam-like, or assessed-looking requests, Morshid should follow a hint ladder:

1. Ask the Student to share their attempt or current reasoning if they have not done so.
2. Identify what part of the problem is being tested.
3. Give the smallest useful hint.
4. Ask the Student to apply the hint.
5. If the Student responds with an attempt, diagnose the attempt and provide the next hint.
6. Provide a different analogous worked example when a full walkthrough is pedagogically useful.
7. Refuse to provide the final assessed solution or corrected code for the Student's submitted task.

The MVP should define direct-answer violations as any response that gives the final numeric answer, final prose answer, final query, final algorithm, or corrected submitted code for an assessed-looking task before the Student has done the required reasoning. Conceptual explanations, short syntax examples, and analogous examples are allowed when clearly separated from the Student's actual task.

The system should prefer a helpful refusal plus a next step over a bare refusal. For example, it can say that it cannot solve the assignment directly, then ask the Student to explain their first step or choose which concept is confusing.

## 8. Privacy, Security, and Ethical Principles

Morshid follows these high-level principles:

- Collect only the minimum personal data required: name, email, role, and course assignments.
- Limit access by role and course ownership.
- Keep Student chats private unless a response is automatically or manually flagged.
- Do not expose unflagged chat content through analytics.
- Explain review visibility to Students.
- Record security events, source changes, review decisions, role changes, and deletions in audit logs.
- Treat Student input and uploaded content as untrusted.
- Prevent instructions embedded in uploaded sources or prompts from overriding system policy or course boundaries.
- Retain chats and review records during the course and for 90 days after the course is marked ended by an Instructor or Admin.
- Preserve necessary review and audit records when a Student deletes a flagged chat; anonymize or delete retained records according to the final retention policy.

Morshid supports learning and Instructor oversight, but it does not make grading, disciplinary, or academic-misconduct decisions.

### 8.1 Prompt Injection Defense

Morshid employs layered prompt-injection defenses. These controls are not treated as perfect protection; they reduce risk and must be tested.

1. **Instruction hierarchy:** System and developer instructions define role, course boundary, citation policy, and academic-integrity behavior. User messages and retrieved documents are explicitly treated as untrusted content.
2. **Context isolation:** Every retrieval query includes course ID filters. Retrieved chunks include metadata and are injected only as quoted course context, never as instructions to follow.
3. **Tool and data boundary controls:** The AI service receives only the resources authorized for the active user and course. It cannot choose arbitrary courses, files, users, or review records.
4. **Request classification:** Student messages are classified as conceptual, problem-like, code-diagnosis, unsafe, off-topic, or ambiguous before selecting the response template.
5. **Output policy check:** Responses are checked for final-answer leakage, missing labels, missing citations for course-grounded claims, unsafe content, and cross-course references before being shown to the Student.
6. **Audit and evaluation:** Prompt-injection attempts are included in the security test suite and failed attempts are recorded as policy-relevant events.

The MVP should avoid destructive "sanitization" that removes arbitrary student text. Sanitization is still required for normal web security concerns such as HTML/script escaping, file validation, and log safety.

### 8.2 Security Test Scenarios

The following scenarios must be explicitly tested during acceptance testing:

- Course isolation boundaries — a Student in Course A tries to access material from Course B
- Role escalation — a Student tries to access Instructor or Admin endpoints
- Private chat access — an Instructor tries to view unflagged Student chats
- Disabled account access — a disabled user tries to use an existing session or token
- Cross-course retrieval — RAG returns chunks from a different course's knowledge base
- Prompt injection — Student tries to trick the AI into revealing system prompts or giving final answers
- File upload validation — malicious file types or oversized uploads

## 9. Core Workflows

### 9.1 Ask for Course Help

1. The Student selects an assigned course and session.
2. The Student asks a question.
3. Morshid classifies the request as conceptual, problem-like, code-diagnosis, or unsafe.
4. Morshid retrieves only from available sources in the selected course.
5. Morshid provides direct conceptual explanation, Socratic guidance, or code debugging hints as appropriate.
6. Morshid labels the guidance and includes citations when course material was used.
7. Morshid saves the exchange in the private session.

### 9.2 Diagnose a Student Attempt

1. The Student submits a problem and attempted solution (text or code).
2. Morshid identifies the Student's current reasoning or likely mistake.
3. Morshid explains the relevant concept or provides the next hint.
4. Morshid asks the Student to try the next step.
5. Morshid does not provide the assessed task's final solution or the corrected code.

### 9.3 Upload Course Material

1. The Instructor uploads a PDF or DOCX with required metadata.
2. Morshid warns about a likely duplicate when applicable.
3. The source is marked as processing and excluded from retrieval.
4. The ingestion capability parses, indexes, and tests the source with a retrieval sanity check; full MVP expands this to 3 generated retrieval-test questions.
5. The Instructor receives the status, quality result, test outcomes, and any warnings.
6. Only an accepted, available source becomes retrievable by Students.

### 9.4 Review Flagged Guidance

1. Morshid or the Student creates a review flag.
2. The Student sees that the response is awaiting review.
3. The Instructor receives a notification and opens the relevant exchange with limited context.
4. The Instructor approves, edits, rejects, or replaces the guidance.
5. The Student receives the outcome.
6. The Instructor may explicitly add the final guidance to the course's reviewed-answer library.

### 9.5 End a Course and Apply Retention

1. An Instructor or Admin marks the course as ended.
2. Chats and review records remain available under role restrictions for 90 days.
3. An Admin manually triggers retention cleanup through the dashboard when appropriate.
4. Required audit integrity is preserved without retaining unnecessary Student content.

### 9.6 Bulk Account Import (P2 / Full MVP)

1. An Admin uploads a CSV file with columns: name, email, role, course assignments.
2. The system validates the CSV format and content.
3. Accounts are created with temporary passwords.
4. Duplicate emails are skipped.
5. A results report is returned showing created accounts, skipped duplicates, and errors.

## 10. Technical Architecture Overview

This section documents agreed technical direction and deferred decisions. Detailed specifications belong in the architecture document.

### 10.1 Decided Technical Choices

| Area | Decision | Rationale |
|---|---|---|
| Primary backend | NestJS (TypeScript) | Preferred single backend for auth, RBAC, courses, sessions, file uploads, notifications, audit logs, AI/RAG orchestration, Tutor Agent, and Ingestion Agent |
| Conditional Python component | Internal Django service only if ITI requires Python | Fallback for the Python requirement; NestJS remains the only public API boundary |
| Frontend framework | TanStack Start (React-based) | Full-stack React framework with SSR capabilities |
| UI components | Shadcn/ui + Base UI primitives | Accessible, customizable, copy-paste components |
| CSS framework | TailwindCSS v4 | Utility-first, excellent Shadcn/ui integration |
| Database | PostgreSQL | Relational storage for users, courses, sessions, reviews, audit |
| Vector store | pgvector (PostgreSQL extension) | Course material embeddings for RAG, single-database simplicity |
| Caching / rate limiting | Redis | Usage tracking, rate limiting, pub/sub for notifications |
| AI framework | Provider SDKs and/or LangChain | Use TypeScript-first orchestration in NestJS where possible; use Python/LangChain only in the conditional Django fallback |
| LLM provider | Flexible — model provided or approved by ITI | Select by reasoning quality, latency, cost, availability, and policy approval |
| Embedding model | Gemini Embedding 2 or OpenAI text-embedding-3-small | Decision pending; both support multilingual and integrate with pgvector |
| Service communication | Internal NestJS modules by default; REST over HTTP only for conditional NestJS ↔ Django fallback | Keeps P0 simpler unless ITI forces a Python service |
| Response streaming | Server-Sent Events (SSE) | Streaming LLM token-by-token responses to the frontend |
| State management | TanStack Query (server state) + Zustand (client state) | Modern standard: don't mix server and client state |
| Validation | Zod | Runtime validation on frontend and NestJS; pending further investigation |
| API documentation | Swagger/OpenAPI auto-generated | @nestjs/swagger for NestJS; add drf-spectacular or drf-yasg only if Django is required |
| Error handling | Global middleware | NestJS ExceptionFilter; add Django middleware only if Django is required; consistent JSON error responses with error codes |
| RBAC | NestJS Guard-based with custom @Roles decorators | Guards check role + resource ownership |
| Reverse proxy | Caddy | Automatic HTTPS with Let's Encrypt, simple config |
| Containerization | Docker + docker-compose | All services in one docker-compose.yml for local dev and deployment |
| Theme | Dark default + light toggle | Modern AI product aesthetic |
| Language | English only | Arabic/RTL support deferred to post-MVP |

### 10.2 Deferred Technical Decisions

The following decisions have identified options but require further team discussion before finalizing.

#### 10.2.1 Authentication Mechanism

| Option | Description | Pros | Cons |
|---|---|---|---|
| **JWT with refresh tokens** | Stateless, short-lived access token (15 min) + long-lived refresh. @nestjs/jwt + @nestjs/passport. | Works great with SPAs and service boundaries when needed | Token revocation requires a blocklist |
| **Session-based with cookies** | Server-side sessions stored in Redis. | Simpler implementation, automatic revocation | Stateful, requires session store |
| **OAuth2/OIDC with Keycloak** | Self-hosted identity provider. | Most robust, enterprise-grade | Heavy infrastructure for MVP |
| **NestJS Passport local strategy** | Built-in session + Passport. | Minimal setup | Less flexible if a separate Python service is required |

#### 10.2.2 File Storage

| Option | Description | Pros | Cons |
|---|---|---|---|
| **MinIO (S3-compatible)** | Self-hosted object storage as a Docker container. | Free, S3-compatible API, production-like | Another container to manage |
| **Local filesystem (Docker volume)** | Store files in a mounted volume. | Simplest, no extra service | No API, harder to manage |
| **AWS S3 / Google Cloud Storage** | Managed cloud storage. | Reliable, scalable | Adds cloud cost and dependency |
| **PostgreSQL BLOBs** | Store files directly in the database. | Single-service simplicity | Bad for large files, bloats DB |

#### 10.2.3 ORM (NestJS)

| Option | Description |
|---|---|
| **Prisma** | Type-safe, auto-generated TypeScript types, excellent migrations, single source of truth for DB schema |
| **Drizzle** | Lightweight, SQL-like syntax, great TypeScript types, newer but growing |

#### 10.2.4 Repository Structure

| Option | Description |
|---|---|
| **Monorepo with Turborepo** | Single Git repo, shared TypeScript types between frontend and backend, unified CI/CD, team sees all code |
| **Simple monorepo (no tool)** | Single repo with folders for each service, npm workspaces for TypeScript, no build orchestrator |

#### 10.2.5 Git Branching Strategy

| Option | Description |
|---|---|
| **Practical GitFlow** | `dev` as the default integration branch, `main` as release-only, feature pull requests into `dev`, release pull requests from `dev` to `main`, and hotfixes from `main` back into `dev`. |
| **GitFlow** | main + develop + feature + release + hotfix branches. More structured but heavier for a small graduation team. |
| **GitHub Flow** | Single main branch + feature branches + Pull Requests. Simpler for small teams. |

#### 10.2.6 CI/CD Pipeline

| Option | Description |
|---|---|
| **Lightweight CI + manual deploy** | Lint + type-check + tests on PR, Docker build on merge. Deploy manually via SSH + docker-compose on VPS. |
| **Full CI/CD** | Automated build, test, and deploy to VPS on every merge to main. |
| **CI only** | Lint + test on PR, no automated deployment. |
| **Minimal** | Manual testing before merge, no CI pipeline. |

Note: GitHub Student Pack is available and may provide additional CI/CD minutes or hosting credits.

#### 10.2.7 Notification Delivery

| Option | Description |
|---|---|
| **Polling + notification center** | Frontend periodically checks for new notifications via TanStack Query. Bell icon with unread count + dropdown. |
| **SSE for real-time** | Push notifications instantly via SSE (infrastructure already exists for chat streaming). |
| **WebSocket-based** | Full-duplex push. Instant but adds complexity alongside SSE. |
| **Email (stretch)** | Listed as stretch scope; not primary for MVP. |

#### 10.2.8 Logging and Audit

| Option | Description |
|---|---|
| **Structured JSON logging + DB audit table** | Winston (NestJS), plus structlog only if Django is required, with dedicated audit_logs PostgreSQL table. No external aggregation for MVP. |
| **Console logging only** | Rely on Docker logs, no structured logging or DB audit table. |
| **Full observability (ELK, Grafana)** | Comprehensive but heavy for MVP. |

#### 10.2.9 Prompt Management

| Option | Description |
|---|---|
| **Prompt template library in backend codebase** | Versioned prompt templates stored as files, organized by function (classification, socratic_tutor, conceptual_explainer, attempt_diagnosis, safety_check). Template variables inject course context, retrieved passages, conversation history, and student message. |
| **Database-stored prompts** | Editable at runtime by Admins without redeployment. |
| **Hardcoded in Python** | Simplest, but harder to iterate and version. |

#### 10.2.10 Admin and Instructor Dashboard UX

| Option | Description |
|---|---|
| **Rich dashboards** | Data tables with filtering/sorting/pagination, form-based CRUD modals, dashboard cards for stats. Instructor: material management, upload progress, review queue, reviewed-answer library editor. |
| **Simple CRUD pages** | Basic tables, functional but minimal polish. |
| **Chat-integrated management** | Admin/Instructor actions embedded in the sidebar. |

#### 10.2.11 Document Chunking Strategy

| Option | Description |
|---|---|
| **Semantic chunking with overlap** | Split by headings/sections, then by token count (512-1024 tokens, 20% overlap). LangChain's RecursiveCharacterTextSplitter + MarkdownHeaderTextSplitter. |
| **Fixed-size chunking** | 500 tokens with overlap. Simplest, works reasonably well. |
| **Page-level chunks** | One chunk per PDF page. Simple but may split content awkwardly. |
| **Paragraph-level chunks** | Each paragraph as a chunk. Good for short passages but may lose context. |

#### 10.2.12 Request Classification Mechanism

| Option | Description |
|---|---|
| **Prompt-based classification + structured output** | LLM classifies into categories (conceptual, problem-like, code-help, unsafe, off-topic) via system prompt, returns structured JSON. Different prompt templates per category. |
| **Fine-tuned classifier** | Train a small model for classification. Better accuracy but requires training data. |
| **Rule-based heuristics** | Keyword matching. Fastest, cheapest, but fragile. |
| **Two-stage hybrid** | Fast keyword pre-filter + LLM classification for ambiguous cases. |

#### 10.2.13 RAG Retrieval Strategy

| Option | Description |
|---|---|
| **Two-stage: retrieve + re-rank** | Retrieve top-k chunks (k=5), re-rank with cross-encoder, feed top-3 to LLM. Similarity threshold for "not found in course materials" labeling. |
| **Simple top-k retrieval** | Nearest chunks by cosine similarity, feed all to LLM. Simpler but noisier. |
| **Hybrid search** | Vector similarity + BM25 keyword search. Better for technical terms and code identifiers. |

#### 10.2.14 Chat Message Rendering

| Option | Description |
|---|---|
| **Markdown + syntax highlighting** | react-markdown + rehype-highlight/shiki. Supports code blocks, lists, headings, LaTeX (rehype-katex). |
| **Plain text only** | Simpler but poor for code examples. |

#### 10.2.15 Internationalization (Future)

| Option | Description |
|---|---|
| **i18next + react-i18next** | Industry standard for React i18n, supports RTL, pluralization, namespaces. |
| **Custom React Context** | Lightweight key-value translation, built from scratch. |

Note: English-only for MVP. These options are documented for post-MVP Arabic support.

#### 10.2.16 UX Polish Features (Stretch)

| Feature | Description |
|---|---|
| Typing indicators | Visual feedback while AI generates |
| Message reactions/feedback | Thumbs up/down beyond flagging |
| Copy code button | One-click copy on code blocks |
| Session search | Search within chat history |
| Keyboard shortcuts | Power-user efficiency |

#### 10.2.17 Recommended MVP Defaults

To prevent architecture work from stalling, the recommended defaults for the 8-week build are:

| Decision | Recommended MVP default | Why |
|---|---|---|
| Authentication | JWT access tokens + refresh tokens, with disabled-account checks and refresh-token rotation | Fits SPA and service-to-service calls; lighter than Keycloak |
| File storage | Local Docker volume first; MinIO only if time allows | Minimizes infrastructure while preserving a migration path |
| ORM | Prisma for NestJS | Fast schema iteration and strong TypeScript types |
| Repository | Simple monorepo with `frontend/`, `backend/`, `ai-service/`, and `infra/` | Easier for a 5-person team to navigate |
| Branching | Practical GitFlow | Keeps `main` release-only while preserving a simple integration branch for a small team |
| CI/CD | Lightweight CI + manual deploy | Gives reviewer confidence without over-investing in deployment automation |
| Notifications | Polling + notification center | Enough for review completion and limits; avoids WebSocket complexity |
| Logging and audit | Structured logs + focused DB audit table for security and policy events | Keeps traceability without a full observability stack |
| Prompt management | Versioned prompt templates in the backend codebase | Easy to review, test, and change through Git |
| Dashboards | Simple CRUD pages with polished critical states | Prefer reliable workflows over analytics-heavy dashboards |
| Chunking | Recursive/fixed chunking with metadata, then improve only if eval fails | Good enough baseline; avoids premature retrieval complexity |
| Classification | Prompt-based structured output plus rule checks for obvious unsafe/problem-like requests | Practical balance of speed and control |
| Retrieval | Simple top-k vector retrieval with course filter and similarity threshold | Add hybrid/re-rank only if evaluation exposes a real gap |
| Message rendering | Markdown + syntax highlighting | Required for code tutoring quality |
| Citation UX | Inline citation tags plus right-panel source metadata | Demonstrable and less complex than a full document viewer |

The architecture document may override these defaults, but any heavier choice should explain what risk it reduces and what feature will be cut to pay for it.

### 10.3 Architecture Diagram (Conceptual)

```
┌──────────────────────────────────────────────────────────────────┐
│                          Caddy (Reverse Proxy)                   │
│                     HTTPS + Let's Encrypt                        │
└────────┬───────────────────┬───────────────────┬─────────────────┘
         │                   │                   │
         ▼                   ▼                   │
┌─────────────────┐  ┌──────────────┐            │
│  TanStack Start  │  │   NestJS     │            │
│   (Frontend)     │  │  (Backend +  │◄───────────┘
│                  │  │   AI/RAG)    │
│  - Shadcn/ui     │  │              │
│  - TailwindCSS   │  │  - Auth/RBAC │
│  - TanStack Query│  │  - Courses   │
│  - Zustand       │  │  - Sessions  │
│  - SSE client    │  │  - Uploads   │
│                  │  │  - Tutor Agent│
│                  │  │  - Ingestion │
│                  │  │  - Retrieval │
│                  │  │  - Reviews   │
│                  │  │  - Audit     │
│                  │  │  - Swagger   │
└─────────────────┘  └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
      ┌──────────┐  ┌───────────┐  ┌──────────┐
      │PostgreSQL│  │  pgvector │  │  Redis   │
      │(Relational│  │ (Vectors) │  │(Cache/   │
      │  Data)   │  │           │  │ Rate     │
      │          │  │           │  │ Limit)   │
      └──────────┘  └───────────┘  └──────────┘
```

If ITI requires Python, add an internal Django service behind NestJS for AI/RAG operations only. NestJS still remains the only public API boundary.

### 10.3.1 Service Boundary

NestJS should be the only public backend API for the web application. It owns authentication, RBAC, account status checks, course ownership checks, audit logging, request-level authorization, and the public SSE endpoint.

For streaming, the frontend opens an authorized SSE endpoint on NestJS. NestJS validates the user and course, runs the AI/RAG orchestration directly by default, and streams the response back to the frontend. If ITI requires Django, NestJS forwards only authorized internal AI/RAG requests to Django and proxies the stream back to the frontend.

### 10.4 Conversation Context Management

To prevent token costs from growing linearly with conversation length while maintaining Socratic tutoring coherence:

- Keep the last N messages (e.g., 20) in full.
- Summarize older messages into a condensed context.
- LangChain's ConversationSummaryBufferMemory (or equivalent) handles this automatically.

This is critical because Socratic tutoring requires remembering what hints were already given and what attempts the Student has made.

## 11. MVP Scope

The MVP is divided into priority bands. P0 is the graduation demo slice and must be protected. P1 completes the credible MVP. P2 is stretch and should not block the demo.

### 11.1 P0 Graduation Demo Slice

P0 must prove the product's core claim with one controlled pilot course and one seeded demonstration dataset:

- Polished landing page for first impressions
- Email/password authentication and role-based access for Student, Instructor, and Admin
- Admin-created users, one course, and course assignments
- One Instructor per course
- Mobile-responsive sidebar chat layout
- Shared course sources and private Student sessions
- PDF source ingestion with visible processing status and a retrieval sanity result for the demo source
- Course-isolated RAG with citations
- Socratic Tutor behavior for conceptual, problem-like, attempted-solution, and code-diagnosis requests
- Hint ladder and direct-answer boundary enforcement
- Real-time or near-real-time AI response experience, preferably SSE streaming
- Automatic and Student-created review flags
- Instructor review of a flagged exchange with approve/edit/reject/replace outcome
- Student notification or visible status update after review completion
- Usage-limit and provider-outage messages that preserve the Student's submitted message
- Explicit tests for cross-course retrieval, unauthorized access, and final-answer leakage
- Curated evaluation set for the demo scenarios

### 11.2 P1 Full MVP

P1 should be completed after P0 is stable:

- Dark theme default with light theme toggle
- Multiple courses and multiple sessions per Student per course
- Session creation, renaming, archiving, and deletion
- DOCX ingestion in addition to PDF
- Source metadata view for Students
- Generalized automated retrieval testing with 3 generated questions per document
- Ingestion warnings for unreadable pages, weak extraction, and likely duplicates
- Asynchronous in-app notifications
- Configurable usage limits
- Focused audit logging for security, source, review, role, and deletion events
- Manual retention cleanup for ended courses
- Basic accessible interaction
- Optimistic chat UX with inline retry
- Global error handling with consistent error codes
- API documentation through Swagger/OpenAPI
- Course-scoped reviewed-answer library as a manual Instructor feature

### 11.3 P2 Stretch Inside Original MVP

These items are valuable but should be cut first if schedule pressure appears:

- Bulk account import via CSV
- Second-tier RAG retrieval from the reviewed-answer library
- Automatic flagging for every low-confidence case beyond obvious missing/conflicting source cases
- Full Admin policy configuration screens
- Full retention workflow beyond a documented manual admin action
- Extensive dashboard analytics or activity counts
- Real-time notification delivery beyond polling
- DOCX edge cases and advanced file-replacement workflows
- Rich citation viewer with highlighted document passages
- Conversation summarization if token costs remain manageable during the pilot

The required intelligent components are a Tutor Agent (including code diagnosis) and a Course Material Ingestion Agent, supported by a human-in-the-loop Instructor review flow.

## 12. Stretch and Future Scope

The following items may be considered after the core MVP:

- Arabic, mixed Arabic-English language support, and RTL layout
- Multiple Instructors per course
- Instructor-managed Student enrollment
- Student preferred-language setting
- Email notifications
- Student dashboards
- Simple repeated-topic counts or weak-topic indicators
- Before/after learning exercises
- Quizzes and quiz generation
- Per-course guidance strictness and usage limits
- Broader higher-education subjects
- Additional source formats
- Basic aggregate course activity and review counts for Instructors
- In-app notifications for Instructors (flagged responses, student review requests, source-processing status)
- Student notifications for Instructor corrections
- Redirection of unrelated questions to the current course
- Detailed citations identifying document page, section, title, and excerpt
- Open cited passages at the relevant source passage (document viewer with highlighted passages)
- Typing indicators while AI is generating (if not in MVP)
- Message reactions/feedback (thumbs up/down)
- Copy code button on code blocks
- Search within chat history
- Keyboard shortcuts for power users

## 13. Explicit Exclusions

The MVP does not include:

- Public registration
- Student uploads to the official course knowledge base
- Native mobile applications
- WhatsApp or Telegram integration
- Quizzes as a required product feature
- OCR or reliable ingestion of scanned documents
- Images, screenshots, handwritten notes, or audio
- Advanced-mathematics support guarantees
- Unrestricted web search
- General file downloading by Students
- Google, Microsoft, or institutional SSO
- Grading
- Plagiarism or academic-misconduct detection
- Assignment submission
- Learning-management-system integration
- Video conferencing
- Live Instructor chat
- Exam proctoring
- Certificate generation
- Full Student performance prediction
- Guaranteed correctness for every response or subject
- Production-scale availability or capacity
- Arabic or RTL support (deferred to post-MVP)

## 14. High-Level User-Story Inventory

These stories define coverage for later requirements work. Detailed acceptance criteria belong in the SRS.

### 14.1 Student Stories

- As a Student, I want to see a polished landing page so that I understand what Morshid is before signing in.
- As a Student, I want to sign in with my assigned account so that I can access Morshid securely.
- As a Student, I want to sign out and change my password so that I can protect my account.
- As a Student, I want to see only my assigned courses so that I cannot access unrelated content.
- As a Student, I want to select a course before chatting so that guidance is grounded in the correct knowledge base.
- As a Student, I want to view available source metadata without unrestricted file downloads so that I know what material supports the course.
- As a Student, I want to create, rename, archive, and delete course sessions so that I can organize my learning.
- As a Student, I want to ask conceptual questions and receive clear explanations so that I can understand course material.
- As a Student, I want problem questions answered with hints and reasoning prompts so that I do the important thinking myself.
- As a Student, I want to submit my attempt and receive diagnosis and the next hint so that I can correct my reasoning.
- As a Student, I want to paste my code and receive debugging guidance without having the code fixed for me so that I learn to debug independently.
- As a Student, I want to see my message appear immediately and watch the AI response stream in real time so that the experience feels responsive.
- As a Student, I want to see a typing indicator while the AI is generating so that I know the system is working.
- As a Student, I want guidance clearly labeled by its source and review status so that I understand how much to trust it.
- As a Student, I want citations so that I can verify course-grounded guidance.
- As a Student, I want missing or conflicting evidence disclosed so that uncertainty is not hidden.
- As a Student, I want to flag an incorrect or confusing response so that an Instructor can review it.
- As a Student, I want to receive review decisions so that I do not continue learning from faulty guidance.
- As a Student, I want clear usage-limit and outage messages so that I know why Morshid cannot respond.
- As a Student, I want failed AI requests to show an inline error with a retry button so that I do not lose my message.
- As a Student, I want unsafe requests refused so that the assistant remains focused on safe course learning.
- As a Student, I want my unflagged chats kept private so that learning support does not become general surveillance.
- As a Student, I want to toggle between dark and light themes so that I can study comfortably.

### 14.2 Instructor Stories

- As an Instructor, I want to request a course that an Admin can create and assign so that course setup remains controlled.
- As an Instructor, I want to manage materials for my course so that Students receive current course-grounded guidance.
- As an Instructor, I want to provide source metadata so that retrieved passages remain understandable and traceable.
- As an Instructor, I want duplicate-upload warnings so that I can replace, retain, or cancel intentionally.
- As an Instructor, I want to see ingestion progress, quality results, automated retrieval-test outcomes, and extraction warnings so that poor sources do not silently affect guidance.
- As an Instructor, I want unavailable sources excluded from retrieval so that Students do not receive guidance from incomplete material.
- As an Instructor, I want to review only flagged exchanges with limited context so that I can provide oversight without browsing private chats.
- As an Instructor, I want to approve, edit, reject, or replace flagged guidance so that Students receive an authoritative correction.
- As an Instructor, I want to explain why a manual review request was rejected so that the Student receives a useful outcome.
- As an Instructor, I want to add selected guidance or a manual entry to a course library so that reviewed help can support future Students.
- As an Instructor, I want reviewed guidance linked to my identity and approval date so that its authority is transparent.
- As an Instructor, I want to edit, withdraw, or supersede reviewed guidance so that outdated advice does not remain trusted.
- As an Instructor, I want reviewed guidance flagged when official material changes so that I can revalidate it.
- As an Instructor, I want to mark my course as ended so that retention rules can begin.

### 14.3 Admin Stories

- As an Admin, I want to create accounts individually so that onboarding can happen for the P0 pilot.
- As an Admin, I want to import accounts via CSV upload in P2/full MVP scope so that onboarding a full class is efficient.
- As an Admin, I want CSV import to validate data, skip duplicates, and return a results report in P2/full MVP scope so that I can verify the import was correct.
- As an Admin, I want to disable, reactivate, and reset accounts so that access can be managed safely.
- As an Admin, I want to create courses and assign Students and Instructors so that enrollment remains controlled.
- As an Admin, I want to manage permissions so that each role has only the required access.
- As an Admin, I want to manage materials across all courses so that I can support course operations.
- As an Admin, I want to configure file, retention, usage, flagging, and enrollment policies so that the pilot can operate within its constraints.
- As an Admin, I want to view audit and security events so that important changes are traceable.
- As an Admin, I want to delete chats under policy controls so that data can be managed responsibly.
- As an Admin, I want to mark courses as ended so that retention processing can start.
- As an Admin, I want to manually trigger retention cleanup for ended courses so that data is managed per policy.

### 14.4 System Stories

- As the System, I must enforce email/password authentication, role permissions, account status, and course assignments.
- As the System, I must scope every chat, source retrieval, and reviewed answer to one course.
- As the System, I must prevent unauthorized access to courses, sources, citations, and private chats.
- As the System, I must apply Socratic guidance to problem-like requests and avoid final assessed solutions.
- As the System, I must provide code diagnosis guidance without fixing the student's code.
- As the System, I must cite course materials used for factual guidance.
- As the System, I must label unsupported general knowledge and uncertainty.
- As the System, I must disclose conflicts between retrieved sources.
- As the System, I must create flags for missing, conflicting, or low-confidence evidence.
- As the System, I must preserve review state and notify affected users.
- As the System, I must prioritize official course sources over reviewed guidance.
- As the System, I must store reviewed outcomes and, when reviewed-answer retrieval is enabled, search the reviewed-answer library as a second-tier retrieval source.
- As the System, I must exclude processing, failed, archived, unavailable, and unaccepted low-quality sources from retrieval.
- As the System, I must handle citations for deleted sources.
- As the System, I must provide keyboard-accessible, readable, and screen-reader-friendly core interactions.
- As the System, I must protect system policy and course boundaries from instructions in user input or uploaded content using layered prompt-injection controls.
- As the System, I must log security-sensitive and policy-relevant actions.
- As the System, I must apply retention rules and preserve necessary audit records.
- As the System, I must fail clearly and safely when usage limits or provider outages prevent a response, preserving the student's message and offering retry.
- As the System, I must stream AI responses via SSE and display optimistic chat UX.
- As the System, I must manage conversation context with summarization to control token costs.
- As the System, I must validate ingestion quality with a retrieval sanity check, expanding to 3 generated test questions per document in full MVP scope.
- As the System, I must return consistent JSON error responses with error codes across all services.

## 15. Business Rules

| ID | Rule |
|---|---|
| BR-01 | Every chat, source, citation, and reviewed-answer entry belongs to exactly one course. |
| BR-02 | Only assigned users may access a course and its authorized content. |
| BR-03 | Admin creates courses and assigns users in the MVP. |
| BR-04 | Students cannot upload official course sources. |
| BR-05 | Definitions and concepts may be explained directly; problem-like requests receive Socratic guidance. |
| BR-06 | Morshid must not provide the final solution to homework, assignments, practice, or exam-like questions. |
| BR-07 | A different analogous example may be solved fully. |
| BR-08 | Course-grounded factual guidance requires citations. |
| BR-09 | Unsupported general knowledge must be labeled as absent from uploaded course material. |
| BR-10 | Missing, conflicting, or low-confidence evidence creates a review flag when correctness may be affected. |
| BR-11 | Instructors may access only flagged exchanges for their own courses. |
| BR-12 | Official course material outranks reviewed-answer guidance. |
| BR-13 | Reviewed guidance enters the library only through explicit Instructor action. |
| BR-14 | Sources not accepted as available are excluded from retrieval. |
| BR-15 | Instructors cannot access unflagged private student chats. |
| BR-16 | A Student's deletion of a flagged chat does not remove the required review or audit record. |
| BR-17 | Chats and review records are retained until 90 days after course end, then handled by Admin-triggered cleanup. |
| BR-18 | Morshid does not grade, accuse, discipline, or decide academic misconduct. |
| BR-19 | Students may view source metadata and citations but cannot generally download source files in the MVP. |
| BR-20 | Accounts are created by an Admin; CSV import is optional P2/full MVP scope; public registration is unavailable in the MVP. |
| BR-21 | Code diagnosis provides debugging guidance without fixing the student's code. |
| BR-22 | When reviewed-answer retrieval is enabled, the reviewed-answer library is searched as a second-tier source after official course materials. |
| BR-23 | Each ingested document must pass a retrieval sanity check before becoming available; full MVP uses 3 generated retrieval-test questions per document. |
| BR-24 | Prompt injection defenses must prevent user or document content from overriding system policy. |

## 16. Pilot Success Criteria

The following are graduation-pilot targets, not production guarantees:

| Area | Target |
|---|---|
| Course isolation and authorization | Zero cross-course retrieval or unauthorized-access failures in acceptance testing |
| Citation correctness | At least 90% correct citations on a curated test set |
| Retrieval relevance | At least 80% of test questions retrieve material judged relevant by an Instructor |
| Socratic compliance | No more than 5% direct-answer violations on an assessed-problem test set |
| Guidance quality | At least 80% of sampled guidance rated acceptable by Instructors, with or without minor edits |
| Usability | At least 80% of pilot Students complete the core chat-and-citation journey without assistance |
| Code diagnosis | Code debugging hints are educational and do not provide corrected code |
| Security scenarios | All defined security test scenarios pass (course isolation, role escalation, prompt injection, etc.) |

### 16.1 Evaluation Strategy

The evaluation must use:

- **Curated evaluation dataset:** Build a P0 test suite of ~30-60 question-answer pairs for the demo course, then expand toward ~50-100 pairs per pilot course if time allows. The set should cover conceptual questions (should get direct answers), problem-like questions (should get Socratic hints), code diagnosis requests (should get debugging guidance without fixes), unsafe requests (should be refused), and questions with known source material (should cite correctly).
- **Automated LLM-as-judge benchmarking:** Use a separate LLM to score responses automatically for scalability, supplemented by human review.
- **Instructor scoring** of guidance quality on a sample.
- **Direct-answer violation measurement** on the problem test set.
- **Citation correctness checks** against known source material.
- **Retrieval relevance judgments** by an Instructor.
- **Student usability feedback** during the pilot.
- **Security test execution** for all defined scenarios.

Run the evaluation suite as a batch before each milestone and the graduation demo.

A before/after learning exercise is useful but optional. Exact formulas, sample sizes, rubrics, and test procedures belong in the evaluation plan and SRS.

### 16.2 Golden Demo Dataset

The team should create a small locked dataset by the end of Week 2. This dataset is not for broad measurement; it protects demo reliability.

The golden demo dataset should include:

- 3 conceptual questions with known citations
- 3 problem-like questions where final answers must not be given
- 3 Student attempts with common mistakes
- 3 code snippets with known bugs
- 2 unsupported questions that require a "not found in course material" label
- 2 conflicting-source cases if the selected course materials can support them
- 3 prompt-injection attempts
- 2 authorization tests for cross-course access

Each item should include the expected classification, expected citation behavior, expected refusal or hint behavior, and pass/fail notes. The graduation demo should use scenarios drawn from this set, but the team should still test with unseen examples to avoid overfitting the prompts.

The graduation demonstration must show:

- Course-grounded Socratic guidance with citations
- Hints rather than a final answer for a problem-like request
- Code diagnosis that identifies a bug and guides the student without fixing the code
- Clear handling and flagging of unsupported or conflicting guidance
- Instructor resolution of a flag
- Student notification of the review completion
- Successful source upload with visible processing status and retrieval sanity result
- Prevention of cross-course retrieval
- Prevention of unauthorized course and private-chat access
- Real-time response streaming
- Landing page and polished UI with dark/light theme

## 17. Development Plan

### 17.1 Sprint Schedule

| Week | Focus | Key Deliverables |
|---|---|---|
| 1-2 | Project setup and infrastructure | Docker-compose, database schema, CI pipeline, auth system, RBAC, user/course CRUD, landing page |
| 3-4 | Document and AI pipeline | Document upload/ingestion pipeline, RAG pipeline, basic chat with retrieval, SSE streaming |
| 5-6 | Core tutoring and review | Socratic tutor behavior, citations, code diagnosis, review/flagging workflow, golden demo dataset |
| 7 | Polish and features | Notifications/status updates, usage limits, simple dashboards, UI polish, theme toggle, security tests |
| 8 | Evaluation and demo prep | Evaluation dataset execution, security testing, bug fixes, demo preparation |

### 17.2 Testing Strategy

- **Frontend:** Vitest + React Testing Library
- **NestJS backend:** Jest or Vitest
- **Conditional Django AI service:** pytest only if ITI requires Django
- **Focus:** Integration tests for critical paths (auth, chat, RAG, course isolation) rather than 100% unit test coverage
- **AI evaluation:** Curated test dataset + LLM-as-judge benchmarking
- **Security:** Explicit test scenarios for all defined security cases

### 17.3 Scope Gates

The team should use weekly gates to prevent polished but incomplete infrastructure from crowding out the core learning loop:

| Gate | Latest date | Required proof |
|---|---|---|
| Gate 1 | End of Week 2 | Users, roles, one course, login, and a seeded chat shell work end to end |
| Gate 2 | End of Week 4 | One PDF can be ingested, retrieved, cited, and used in a streamed or near-streamed Student response |
| Gate 3 | End of Week 6 | Socratic policy, code diagnosis, and Instructor review work on the golden demo dataset |
| Gate 4 | End of Week 7 | Security tests, cross-course isolation, usage-limit handling, and demo data are stable |
| Gate 5 | Week 8 | Evaluation report, bug fixes, backup demo path, and final presentation assets are ready |

If a gate fails, the team should cut from P2 first, then P1. P0 scope should only be reduced by replacing implementation depth with a controlled demo path, not by removing the core Socratic + RAG + review loop.

## 18. Assumptions

- Instructors provide usable digital PDF or DOCX materials.
- The institution accepts a controlled pilot rather than requiring a production deployment.
- Paid AI API access remains available during development and demonstration (model provided or approved by ITI).
- Students have suitable web access and a modern browser.
- Instructors have enough time to review important flags.
- The selected pilot courses are suitable for text-grounded Socratic assistance.
- System-wide guidance policy is sufficient for the MVP.
- GitHub Student Pack provides additional CI/CD or hosting benefits.

## 19. Risks and High-Level Responses

| Risk | Consequence | High-level response |
|---|---|---|
| Unreliable or overly direct AI guidance | Students may learn incorrect material or receive assessed solutions | Course grounding, labels, Socratic policy, curated evaluation, review flags, and Instructor correction |
| Weak extraction or retrieval | Relevant course content may be missed or cited incorrectly | Source-quality checks, retrieval sanity testing, unreadable-page warnings, unavailable-source states, and citation evaluation |
| Limited schedule and API budget | Core workflows may be incomplete or demonstration costs may become excessive | Strict MVP boundaries, system-wide policy, configurable usage limits, and focus on a reliable controlled pilot |
| AI provider or model changes | Runtime model quality may drop if the approved model changes, becomes expensive, or is unavailable | Provider abstraction, approved fallback model, seeded demo data, locked golden dataset, and tests that do not depend on a single model |
| Scope creep from overbuilt admin features | The team may ship dashboards and configuration screens while the learning loop remains weak | Protect P0, cut P2 first, and require weekly scope gates |
| Conditional dual-backend complexity | If ITI requires Django, NestJS-Django boundaries may create auth, streaming, and error-handling bugs | Keep NestJS as the public API boundary, keep Django internal, define contracts early, and test service failure paths |
| Instructor review overload | Too many low-value flags may make review unrealistic | Limit manual requests, flag only correctness-affecting uncertainty in P0, prioritize missing/conflicting source cases, and show persistent warnings |
| Evaluation overfitting | Prompts may pass demo examples but fail natural Student questions | Use a locked golden demo set plus unseen evaluation cases and Instructor review |
| Instructor review delay | Uncertain guidance may remain unresolved | Persistent warning, in-app notifications, and a two-working-day target without claiming a guarantee |
| Privacy or unauthorized access failure | Student trust and course confidentiality may be harmed | Course isolation, role-limited access, transparent review, audit logs, retention controls, and explicit security testing |
| Prompt injection through chat or sources | Product policy or course boundaries may be bypassed | Instruction hierarchy, quoted context, course filters, tool/data boundary controls, request classification, output policy checks, and explicit injection tests |
| AI provider outage | Students may lose access during critical use | Preserve messages, communicate unavailability, allow retry, and avoid ungrounded fallback answers |
| Conditional NestJS-Django communication failure | If ITI requires Django, AI features may become unavailable when service communication fails | Global error handling, consistent error codes, graceful degradation with clear user messaging |
| Deferred decisions block progress | Team stalls waiting for technical choices | Document options now, decide by sprint start, use recommended defaults when deadlines approach |

## 20. Open Questions

The following decisions remain intentionally open for the SRS or related policy documents:

1. Which specific courses, Instructors, and Student group will participate in the pilot?
2. What exact daily request or token limits will be configured?
3. What maximum upload size and related file constraints will apply?
4. What measurable thresholds will trigger automatic low-confidence flags?
5. After the 90-day post-course period, which record classes will be deleted and which will be anonymized?
6. What detailed academic-integrity wording will Students accept before using Morshid?
7. Which deployment hosting provider will be used? (Budget-constrained decision)
8. Which authentication mechanism will be implemented? (See Section 10.2.1)
9. Which file storage approach will be used? (See Section 10.2.2)
10. Which ORM will be used — Prisma or Drizzle? (See Section 10.2.3)
11. Which repository structure — Turborepo or simple monorepo? (See Section 10.2.4)
12. Which Git branching strategy — Practical GitFlow, GitFlow, or GitHub Flow? (See Section 10.2.5)
13. What CI/CD pipeline scope? (See Section 10.2.6)
14. How will notifications be delivered? (See Section 10.2.7)
15. What logging and audit implementation? (See Section 10.2.8)
16. How will prompts be managed and versioned? (See Section 10.2.9)
17. What level of dashboard polish for Admin and Instructor? (See Section 10.2.10)
18. What document chunking strategy? (See Section 10.2.11)
19. How will requests be classified? (See Section 10.2.12)
20. What RAG retrieval strategy? (See Section 10.2.13)
21. What chat message rendering approach? (See Section 10.2.14)
22. What citation UX format? (Under discussion — inline citation tags is the current direction)
23. Which P0/P1/P2 scope commitment will the team formally accept before implementation starts?
24. Which AI models and embedding providers are approved by ITI for development, pilot data, and public demonstration?
25. What course-material permissions are required before uploading ITI or Instructor-owned PDFs/DOCX files?
26. What is the backup demo path if the AI provider is unavailable during the graduation presentation?
27. What minimum review workload is realistic for the Instructor during the pilot?

## 21. Required Follow-on Documents

This description should be used to produce:

- A requirements checklist that traces every scope item, workflow, story, rule, target, risk, and open question
- An SRS containing detailed functional and non-functional requirements with acceptance criteria
- An architecture document selecting technologies, data boundaries, AI orchestration, security controls, and deployment design — resolving all deferred technical decisions in Section 10.2
- An evaluation plan defining datasets, rubrics, formulas, sample sizes, and pilot procedures — building on the evaluation strategy in Section 16.1
- An academic-integrity and privacy policy defining Student notices, review boundaries, retention handling, and acceptable use

## 22. Findings

This section captures the hard critique of the idea after pressure-testing it against an 8-week schedule and a 5-member team.

### 22.1 Core Thesis That Should Stay

The strongest version of Morshid is not "AI tutor for everything." It is:

> A course-grounded Socratic assistant for computing courses that guides Students through reasoning, cites Instructor-provided materials, and gives Instructors a narrow review path for uncertain or disputed guidance.

That thesis is specific, demoable, and defensible. Everything that does not help prove it should be treated as secondary.

### 22.2 Missing or Underdefined Pieces

- **Pilot definition:** The project needs a named pilot course, sample source documents, expected number of Students, expected Instructor, and demo user accounts.
- **Golden demo dataset:** The team needs fixed examples by Week 2 for conceptual questions, problem-like requests, attempts, code bugs, unsupported questions, injection attempts, and authorization tests.
- **Provider fallback:** The plan must work if the approved model is unavailable, expensive, or replaced.
- **Attempt policy:** The product must define when to ask for an attempt, how many hints to give, and when to switch to an analogous worked example.
- **Review triage:** Not every uncertain answer can become Instructor work. P0 should flag missing/conflicting evidence and Student-created flags first.
- **Data rights:** The team needs permission rules for uploading course PDFs/DOCX files and showing cited excerpts.
- **Service boundary:** NestJS should be the public API boundary. If Django is required by ITI, it should remain internal so auth, course ownership, and streaming permissions do not split across two public services.
- **Backup demo path:** The team needs seeded data, preloaded documents, and a fallback model or recorded-but-honest demo route for provider outages.
- **Evaluation rubric:** "Good Socratic answer" needs scoring dimensions: no final-answer leak, correct classification, useful next hint, citation accuracy, tone, and source-grounding label.

### 22.3 Refinements Needed

- Narrow the first pilot to one or two computing courses rather than "higher education" broadly.
- Treat project agents as implementation detail, not product promise. Reviewers care about behavior: ingestion, retrieval, tutoring, review, and evaluation.
- Make P0 small enough to finish: one course, one Instructor, one source set, one Student journey, one review workflow.
- Prefer simple defaults: Practical GitFlow, simple monorepo, local file storage, polling notifications, top-k retrieval, prompt templates in Git, focused audit table.
- Make "Socratic" testable through the hint ladder and direct-answer violation definition.
- Keep Instructor privacy boundaries precise: only flagged exchanges plus limited surrounding context.
- Shift from "AI correctness" claims to "transparent, evaluated, reviewable guidance" claims.
- Demonstrate security with a few strong acceptance tests instead of broad claims about production-grade protection.
- Preserve product polish where it affects trust: landing page, chat responsiveness, citations, labels, and review status.

### 22.4 Overkill or Cut-First Items

The following are useful, but too expensive for P0 unless the core loop is already stable:

- Bulk CSV import
- Full Admin policy configuration UI
- Full reviewed-answer library as second-tier RAG
- Multiple courses with many Instructors
- Rich analytics dashboards
- Full retention automation
- Real-time notification infrastructure beyond polling
- Full document viewer with highlighted citations
- Hybrid search, cross-encoder re-ranking, or advanced semantic chunking before simple retrieval is measured
- Keycloak or institutional SSO
- Full CI/CD deployment automation
- Arabic/RTL support
- Quiz generation or learning analytics

### 22.5 Hard Recommendation

Build the P0 loop first:

1. Student logs in and selects one assigned course.
2. Instructor/Admin uploads one good PDF.
3. Student asks conceptual, problem-like, attempted-solution, and code-diagnosis questions.
4. Morshid retrieves from the course only, cites sources, and applies the hint ladder.
5. Unsupported or conflicting guidance is labeled and flagged.
6. Instructor reviews one flagged exchange.
7. Student sees the correction/status.
8. Security tests prove course isolation and role boundaries.

If that loop is reliable, Morshid is a strong graduation project. If that loop is weak, no amount of dashboards, CSV import, or architecture sophistication will save the demo.

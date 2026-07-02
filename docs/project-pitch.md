# Morshid — Project Pitch

**Project Title:** Morshid (مرشد)  
**Team Name:** ThinkFirst
**Target Industry:** EdTech — ITI and higher education  
**Team Members:** 5 full-stack developers

## 1. The Core Problem — The "Why"

Students increasingly use general-purpose AI to complete assignments and solve problems without doing the reasoning themselves. This can produce copied answers, shallow understanding, and less practice in independent thinking, while instructors struggle with repeated questions and unverifiable AI guidance.

## 2. The Solution and Value Proposition — The "What"

Morshid is a course-grounded, AI-powered Socratic teaching assistant. It helps students understand course material through questions, hints, reasoning steps, code debugging guidance, similar worked examples, and citations instead of giving away final solutions to problem-like or assessed tasks.

Each course has an isolated knowledge base containing instructor-approved materials and private chat sessions for each student. When guidance is unsupported, conflicting, or uncertain, Morshid labels it and sends the relevant exchange for instructor review.

**Primary value:** Morshid makes students think and learn while giving them source-grounded support they can verify.

## 3. The AI Trinity Strategy — The "How"

### LLM — Intelligence

The large language model powers conversation, recognizes conceptual versus problem-like versus code-diagnosis requests, explains concepts, evaluates student attempts, diagnoses code bugs, and generates the next useful question or hint.

The specific foundation model will be provided or approved by ITI. It will be selected based on reasoning quality, latency, reliability, and API cost.

### RAG — Knowledge

Retrieval-augmented generation grounds responses in PDF and DOCX materials uploaded by the Instructor or Admin for the selected course. These materials may cover ITI computing subjects such as programming, software engineering, databases, networks, artificial intelligence, and theoretical computing.

Retrieval is isolated by course. Course-grounded factual guidance includes citations. When the uploaded material does not support an answer, Morshid says so rather than presenting unsupported information as course truth.

A reviewed-answer library can serve as a second-tier retrieval source after official course materials. For the protected P0 demo, Instructor review and correction are mandatory; second-tier retrieval from the reviewed library is optional.

### Agents — Action

- **Tutor Agent:** Retrieves course context, applies the Socratic teaching policy, evaluates student attempts, diagnoses code bugs, provides guided help, cites sources, and flags uncertain or conflicting guidance.
- **Course Material Ingestion Agent:** Parses uploaded files, prepares and indexes their content, validates retrieval quality with a sanity check that can expand to 3 generated test questions per document, and reports processing problems to the Instructor.
- **Instructor Review Flow:** Allows the Instructor to approve, edit, reject, or replace flagged guidance and optionally add reviewed guidance to a course-specific answer library.

Together, these components create a controlled learning loop: course material grounds the response, the Tutor guides the student, and the Instructor resolves important uncertainty.

## 4. Market and Competition

**Primary User:** ITI students studying computing courses. Instructors and ITI are secondary beneficiaries.

**The Advantage:** General-purpose AI assistants provide broad answers, while source-centered notebook tools focus on working with supplied documents. Morshid combines three controls specifically for education:

- Enforced Socratic guidance instead of unrestricted final answers
- Strict course-scoped retrieval with verifiable citations
- Instructor oversight for flagged or uncertain guidance

This makes Morshid a guided course assistant rather than another answer-generating chatbot.

## 5. Execution Plan — High Level

**Delivery context:** An 8-week graduation project (July-August 2026) implemented by a team of 5 full-stack developers. The project should keep a tested fallback path using the model approved by ITI.

**Core Stack:**

- **Frontend:** TanStack Start (React) + Shadcn/ui + TailwindCSS v4 — mobile-responsive, sidebar-driven layout, dark/light theme, SSE streaming, TanStack Query + Zustand
- **Primary Backend:** NestJS (TypeScript) — auth, RBAC (Guard-based), courses, sessions, file uploads, notifications, audit logs, RAG pipeline, Tutor Agent, Ingestion Agent, LLM orchestration, Swagger/OpenAPI
- **Conditional Python Component:** Internal Django service only if ITI requires Python; NestJS remains the public API boundary
- **Data:** PostgreSQL + pgvector (relational + vector store in one database), Redis (caching, rate limiting)
- **Infrastructure:** Docker + docker-compose, Caddy reverse proxy, lightweight GitHub Actions CI with manual deploy
- **Communication:** Internal NestJS modules by default; REST to Django only if the Python fallback is required; SSE to the frontend through an authorized NestJS endpoint

**Sprint Plan and Scope Guardrail:**

| Week | Focus |
|---|---|
| 1-2 | Project setup, Docker, DB, CI, auth, RBAC, user/course CRUD, landing page |
| 3-4 | Document ingestion, RAG pipeline, basic chat with retrieval, SSE streaming |
| 5-6 | Socratic tutor, citations, code diagnosis, review/flagging, golden demo evaluation |
| 7 | Notifications/status updates, usage limits, simple dashboards, UI polish, security tests |
| 8 | Evaluation, security testing, bug fixes, demo prep |

The protected P0 demo loop is: one course, one source set, Student chat, course-grounded citations, Socratic hints, code diagnosis, flagging, Instructor review, Student correction/status, and course-isolation tests. CSV import, second-tier reviewed-answer RAG, rich analytics, full retention automation, and advanced retrieval should be cut first if schedule pressure appears.

**Primary Risk Factor:** The largest challenge is producing reliable Socratic guidance from imperfect course documents without leaking final assessed solutions or unsupported answers.

The MVP reduces this risk through course isolation, ingestion-quality checks, citations, explicit uncertainty labels, direct-answer testing, layered prompt-injection defenses, Instructor review, and a locked golden demo dataset.

## Pilot Proof

The graduation demonstration should prove that:

- A Student receives course-grounded Socratic guidance with citations, streamed in real time.
- A problem-like request receives hints rather than a final solution.
- A code diagnosis request identifies bugs and guides the student without fixing the code.
- Unsupported or conflicting guidance is labeled and flagged.
- An Instructor can resolve a flag and send a correction to the Student.
- A document upload completes with visible processing status and a retrieval sanity result.
- Course sources and private chats cannot be accessed across authorization boundaries.
- The UI feels like a modern AI product with dark/light theme and polished landing page.

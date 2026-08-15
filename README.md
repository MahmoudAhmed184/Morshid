# Morshid

Morshid (مرشد, Arabic for guide or advisor) is an AI tutoring platform that guides students using the Socratic method within course-specific boundaries and instructor oversight.

Instead of generating direct answers or assignment code, Morshid guides students through questions, hints, and cited course materials. If model confidence drops or a response risks revealing a solution, the turn enters an instructor review queue.

## Pedagogical invariants

1. **No direct solutions.** The platform enforces a `NO_FINAL_ANSWER` reveal policy. It never outputs copy-paste assignment solutions or complete function implementations.
2. **Grounded in course materials.** Factual explanations cite instructor-uploaded PDFs from the student's enrolled course.
3. **No code execution.** When students submit broken code, the tutor spots misunderstandings and asks guiding questions. The server does not execute student code in a sandbox or virtual machine.
4. **Instructor fallback.** If confidence falls below threshold, guardrails trigger, or a student requests help, the exchange routes to the instructor review queue.

## Roles and workspaces

The application separates user workflows into three role workspaces:

- **Student.** Chats with the AI tutor in enrolled courses, views citations tied to PDF excerpts, steps through progressive hint levels, and flags turns for instructor review.
- **Instructor.** Manages course materials, uploads PDFs, monitors processing states, inspects course readiness reports, and resolves flagged student exchanges in the review queue.
- **Admin.** Manages tenant accounts, creates and updates users, assigns course memberships, runs bulk imports, inspects audit logs, and monitors service health.

## System stack

| Layer | Technology | Details |
|---|---|---|
| Client | TanStack Start, React 19, Vite, TanStack Router, TanStack Query | Single-page application with file-based routing, role workspaces, and domain features |
| Server | NestJS, TypeScript, Node.js 24 | Capability-first modules (`identity`, `courses`, `materials`, `tutoring`, `conversations`, `reviews`, `audit`, `health`) |
| Database | PostgreSQL 18, `pgvector` (0.8.4) | Multi-file Prisma schema, initial baseline migration, and custom triggers |
| Cache & Quota | Redis 8.4 | Token-bucket rate limits and round-robin Gemini project pools |
| Storage | Local filesystem | PDF document storage keyed by UUID (`<uuid>.pdf`) |
| AI Integration | OpenAI-compatible LLMs, Gemini Embeddings | Multi-model orchestration for analysis, tutor generation, embeddings, and semantic guardrails |
| Boundary Checks | `dependency-cruiser` | Enforces acyclic module boundaries and layer isolation |

## Socratic tutoring runtime

Every student message passes through a seven-phase pipeline managed by `TutoringRuntime.run`:

1. **Admission and locking.** Acquires row locks on chat sessions and memberships, validates idempotency keys, and records a received attempt.
2. **Topic resolution.** Maps the message to a curriculum topic node and loads student topic mastery state.
3. **Educational analysis.** Assesses student intent, prior knowledge, misconceptions, and effort evidence using an analysis model.
4. **Policy selection.** Selects the pedagogical strategy (guided explanation, Socratic questioning, misconception repair, or debugging guidance) and sets disclosure limits.
5. **Evidence retrieval.** Runs vector similarity search (`<=>` cosine distance) against verified course PDF chunks after confirming course readiness.
6. **Candidate generation and validation.** Generates a candidate response and runs it through a three-stage validation loop (structural JSON checks, deterministic regex guards, and semantic policy guards). Falls back to a deterministic probe if three generation attempts fail.
7. **Atomic finalization.** Commits message updates, citations, topic state progressions, guard results, and audit logs in a single database transaction.

## Local development setup

### Prerequisites

- Node.js `>=24.7 <25`
- npm `>=11` (`npm@11.18.0`)
- Docker and Docker Compose

### Quick start

```bash
# 1. Clone the repository and install dependencies
git clone <repo-url> morshid
cd morshid
npm install

# 2. Copy environment templates
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start local PostgreSQL and Redis containers
npm run infra:up

# 4. Apply database migrations
npm run db:migrate:deploy

# 5. Populate seed data
npm run db:seed

# 6. Start development servers (client on :3000, server on :4000)
npm run dev
```

### Local endpoints

- Client application: `http://localhost:3000`
- REST API: `http://localhost:4000/api/v1`
- Health live check: `http://localhost:4000/health/live`
- Health ready check: `http://localhost:4000/health/ready`
- Swagger UI (development and test only): `http://localhost:4000/docs`

## Seed credentials

Running `npm run db:seed` provisions demo accounts. All seed accounts use the password `MorshidDemoP0!`.

| Account email | Role | Description |
|---|---|---|
| `admin@morshid.demo` | `ADMIN` | Full administrative access, tenant user management, audit logs |
| `instructor@morshid.demo` | `INSTRUCTOR` | Instructor for `PYTHON-PROG-P0`, PDF uploads, review queue |
| `student1@morshid.demo` | `STUDENT` | Enrolled student in `PYTHON-PROG-P0`, Socratic chat, inbox |
| `student2@morshid.demo` | `STUDENT` | Enrolled student in `PYTHON-PROG-P0`, Socratic chat, inbox |
| `student3@morshid.demo` | `STUDENT` | Enrolled student in `PYTHON-PROG-P0`, Socratic chat, inbox |

Seeded courses:
- `PYTHON-PROG-P0` (Python Programming): Contains chunked syllabus material and sample conversations.
- `HIDDEN-ISOLATION` (Hidden Isolation Test Course): Empty course for testing access policy boundaries.

## Testing and verification

Morshid verifies code quality, contracts, and system boundaries through layered suites:

```bash
# Full quality gate: formatting, linting, type checks, boundary rules, unit tests, and production builds
npm run check

# Unit tests across scripts, client, and server
npm run test

# Server integration tests with disposable PostgreSQL databases
npm run test:e2e

# Browser acceptance tests with Playwright
npm run test:acceptance

# Architectural boundary verification
npm run test:architecture

# Database catalog semantic hash verification
npm run db:assert-catalog

# Five-stage clean-slate demo verification pipeline
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```

## Common commands

| Command | Description |
|---|---|
| `npm run dev` | Runs client and server concurrently with live reload |
| `npm run dev:client` | Starts Vite dev server on port 3000 |
| `npm run dev:server` | Starts NestJS dev server on port 4000 |
| `npm run infra:up` | Starts local PostgreSQL and Redis containers |
| `npm run infra:down` | Stops local containers |
| `npm run check` | Runs full static analysis and verification pipeline |
| `npm run test` | Runs unit tests across all workspaces |
| `npm run test:e2e` | Runs server E2E test suites with disposable databases |
| `npm run test:acceptance` | Runs Playwright browser acceptance journeys |
| `npm run db:reset` | Drops and recreates local database tables (requires `MORSHID_RESET_CONFIRM=reset-local`) |
| `npm run reviews:clear-local` | Clears review cases and inbox items (requires `MORSHID_REVIEW_CLEANUP_CONFIRM=clear-local-reviews`) |
| `npm run embedding:migrate -- <provider>` | Migrates chunk embeddings between vector providers |

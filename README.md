# Morshid (مرشد)

A Socratic AI teaching assistant for ITI computing courses. Students get hints, questions, and cited explanations. They don't get final answers.

Instructors upload course PDFs. Every response is grounded in those materials. When Morshid isn't sure, or when a response might be leaking a solution, it flags the exchange for the instructor to review.

---

## How it works

**Students** chat inside their enrolled course. The request type determines what happens:

- **Conceptual question** → explanation with citations from the course PDFs
- **Assignment or problem** → hint ladder (4 levels), no solution given
- **Buggy code** → bug identification and pointers, not a rewrite
- **Outside the course material** → labeled as general knowledge; flagged if the question is grade-sensitive

**Instructors** get a review queue. They can approve, edit, or replace any flagged response. The student sees the outcome in their chat.

**Admins** handle user accounts, course assignments, and materials.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start · React · Shadcn/ui · TailwindCSS v4 · TanStack Query · Zustand |
| Backend | NestJS (TypeScript) — auth, RBAC, RAG pipeline, AI orchestration, SSE streaming |
| AI | LLM via provider abstraction · RAG with pgvector |
| Database | PostgreSQL + pgvector · Redis |
| Infrastructure | Docker Compose · Caddy · GitHub Actions CI |

If ITI requires a Python component, a Django service handles AI/RAG internally. NestJS stays the only public API either way.

---

## What makes it different from a chatbot

- Retrieval is scoped per course. A student can't pull material from a course they're not in.
- If the PDFs don't support a claim, Morshid says so instead of making something up.
- Problem-like requests get hints, not solutions. The constraint is enforced in the prompt policy and tested against a locked evaluation set.
- Instructors are the last line of defense on uncertain or risky responses.

---

Graduation project, July–August 2026. Team ThinkFirst, 5 developers. More detail in [`docs/`](./docs/).

---

## Local Setup

Prerequisites:

- Node.js 24 LTS with npm 11 or newer.
- Docker with Docker Compose.

Happy-path preparation:

```bash
npm install
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Configure the copied environment files, then use the guarded fresh-seed
workflow below before starting the application.

Local URLs:

- Client: http://localhost:3000
- Server health: http://localhost:4000/health/live
- Server readiness: http://localhost:4000/health/ready
- Swagger UI: http://localhost:4000/docs
- OpenAPI JSON: http://localhost:4000/docs-json
- OpenAPI YAML: http://localhost:4000/docs-yaml

Swagger is registered only when the server runs with `NODE_ENV=development` or
`NODE_ENV=test`; all three documentation URLs return `404` in production while
the API routes remain available. In Swagger UI, authorize with the
`access-token` bearer scheme using a JWT returned by sign-in or refresh.
Browser refresh sessions use the HttpOnly `morshid_refresh` cookie. Non-browser
clients can instead send the optional `refreshToken` JSON field to the refresh
and logout endpoints.

### Fresh-seed demo acceptance workflow

> [!WARNING]
> This workflow permanently deletes all data in the development database named
> by `server/.env`. Confirm that it is a disposable local database before
> continuing. Never run it against a shared, staging, or production database.

Before running the gate, install the locked dependencies, copy the three local
environment files shown above, configure the required server secrets, and make
sure Docker with Docker Compose is running. Then run the guarded command from
the repository root:

```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```

The command stops at the first failure and runs these stages in order:

1. `npm run infra:up` starts the local PostgreSQL and Redis infrastructure.
2. `npm run db:reset` resets the development database and reapplies every
   Prisma migration.
3. `npm run db:seed` seeds the deterministic P0 demo data.
4. `npm run check` runs formatting, linting, typechecking, root and workspace
   tests, and builds.
5. `npm run test:e2e --workspace server` runs every server E2E acceptance test.

A successful run recreates the five demo accounts and the `PYTHON-PROG-P0` and
`HIDDEN-ISOLATION` courses described below. It leaves infrastructure running
for the demo; start the application with `npm run dev`.

If a stage fails, later stages do not run. The command preserves a child
process's non-zero exit status and prints the failed stage, its recovery
command or advice, and the full guarded command to rerun. Use the individual
commands in [Troubleshooting](#troubleshooting) only to diagnose and repair the
reported stage before rerunning the complete gate.

### PDF storage runtimes

`PDF_STORAGE_PATH` is required and validated when NestJS starts. The copied
`server/.env` points host-run development at `../storage/pdfs`, which resolves
to the repository's git-ignored `storage/pdfs/` directory when the server runs
from its workspace. The adapter creates this directory when it first stores a
file.

The database stores only generated relative keys such as
`550e8400-e29b-41d4-a716-446655440000.pdf` in `materials.storage_path`. Do not
store host paths or Compose container paths in that column. PDF validation,
upload limits, and ingestion are handled by the upload workflow, not by the
storage adapter.

To run the built server in Compose as well as PostgreSQL and Redis:

```bash
docker compose --profile app up -d --build --wait server
```

The profile runs `prisma migrate deploy` as a one-shot `migrate` service. The
server starts only after PostgreSQL and Redis are healthy and that migration
job succeeds. Compose injects `PDF_STORAGE_PATH=/workspace/storage/pdfs` and
mounts `morshid-pdf-storage` at exactly that path. `npm run infra:up` remains
the faster infrastructure-only command and does not build or start the server.

The host directory and Compose volume are separate storage backends. The named
volume survives `docker compose down`; `docker compose down -v` deliberately
removes both database and PDF volumes. Replace every placeholder secret in the
copied environment files before starting either server runtime.

Failed writes remove any partial file automatically. Application workflows
should call the idempotent storage `delete` operation when later persistence or
processing fails; deleting a missing key is safe.

### P0 demo seed

The fresh-seed gate runs `npm run db:seed` to load deterministic local demo
data. For troubleshooting after migrations have been applied, the seed command
is safe to rerun by itself: it resets the demo users, keeps their known roles
and password hashes, restores the P0 course titles, removes demo
instructor/student memberships outside the Python course, and clears all
memberships from the isolation course.

Shared local-only password for every seeded account: `MorshidDemoP0!`
Set `AUTH_ACCESS_TOKEN_SECRET` and `AUTH_REFRESH_TOKEN_HASH_SECRET` in
`server/.env` to local random strings with at least 32 characters before
starting the server. Token lifetimes and signing/hash configuration are
documented in [`server/README.md`](./server/README.md#auth-environment-configuration).

| Email | Role |
|---|---|
| `admin@morshid.demo` | Admin |
| `instructor@morshid.demo` | Instructor |
| `student1@morshid.demo` | Student |
| `student2@morshid.demo` | Student |
| `student3@morshid.demo` | Student |

Seeded courses:

| Code | Title | Memberships |
|---|---|---|
| `PYTHON-PROG-P0` | Python Programming | Instructor plus all three students |
| `HIDDEN-ISOLATION` | Hidden Isolation Test Course | None |

Useful checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

### Sprint 1 acceptance tests

Install the Chromium browser once after `npm install`:

```bash
npx playwright install chromium
```

The acceptance suite exercises the live client and API against the deterministic
P0 demo seed. Start infrastructure, migrate, seed, and run it in that order:

```bash
npm run infra:up
npm run db:migrate
npm run db:seed
npm run test:acceptance
```

## Troubleshooting

Port conflicts:

```bash
lsof -i :3000
lsof -i :4000
lsof -i :5432
lsof -i :6379
```

Docker not running:

```bash
docker info
docker compose ps
```

PostgreSQL or Redis not healthy:

```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
```

Profiled server or migration not healthy:

```bash
docker compose --profile app ps -a
docker compose --profile app logs migrate
docker compose --profile app logs server
```

Prisma migration issues:

```bash
npm run db:migrate
```

The fresh-seed gate is the supported path for a clean demo. For troubleshooting
only, its stages can be run individually:

```bash
npm run infra:up
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
npm run db:seed
npm run check
npm run test:e2e --workspace server
```

The reset command is destructive and guarded. It reapplies all migrations but
does not seed; run `npm run db:seed` explicitly afterward when repairing a
partial fresh-seed run.

Environment precedence:

- Docker Compose reads root `.env` for infrastructure variables.
- Host-run NestJS reads `server/.env` first and can fall back to root `.env`; its required PDF root should remain `../storage/pdfs`.
- The Compose server receives `/workspace/storage/pdfs` directly from `docker-compose.yml`, matching its named-volume mount.
- TanStack Start reads `client/.env` for `VITE_API_BASE_URL`.

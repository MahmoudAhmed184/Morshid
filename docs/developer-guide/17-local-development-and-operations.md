# 17. Local Development & Operational Workflows

This guide provides practical instructions for setting up, running, debugging, and maintaining the Morshid platform locally.

---

## 1. Prerequisites & Environment Setup

### Required Tools:
- **Node.js**: `>=24.7 <25` (Enforced via `.node-version` and `.nvmrc`)
- **npm**: `>=11` (`npm@11.18.0`)
- **Docker & Docker Compose**: For local PostgreSQL (`pgvector`) and Redis instances

### Initial Setup Steps:
```bash
# 1. Clone repository and install all monorepo dependencies
git clone <repo-url> morshid
cd morshid
npm install

# 2. Prepare environment configuration files
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start local container infrastructure (PostgreSQL & Redis)
npm run infra:up

# 4. Deploy initial database schema migrations
npm run db:migrate:deploy

# 5. Populate database with deterministic P0 seed data
npm run db:seed

# 6. Start full-stack local development servers (Client on :3000, Server on :4000)
npm run dev
```

---

## 2. Daily Development Commands Reference

| Command | Action Performed | Underlying Tooling |
|---|---|---|
| `npm run dev` | Runs client and server concurrently with live reload | `concurrently "npm run dev:client" "npm run dev:server"` |
| `npm run dev:client` | Starts Vite dev server on `http://localhost:3000` | `vite dev --port 3000` (workspace: `client`) |
| `npm run dev:server` | Starts NestJS dev server on `http://localhost:4000` | `nest start --watch` (workspace: `server`) |
| `npm run infra:up` | Starts Docker containers for PostgreSQL and Redis | `docker compose up -d --wait postgres redis` |
| `npm run infra:down` | Stops and tears down Docker containers | `docker compose down` |
| `npm run check` | Runs full quality gate (format, lint, types, arch, build) | Canonical CI verification gate |
| `npm run test` | Runs unit tests across scripts, client, and server | Node test runner + Vitest + Jest |
| `npm run test:e2e` | Runs server integration tests with disposable databases | Jest E2E runner (`server/test/`) |
| `npm run test:acceptance` | Runs Playwright browser journey tests | Playwright (`tests/acceptance/`) |

---

## 3. Seed Accounts & Pre-configured Data

Running `npm run db:seed` provisions deterministic testing accounts. The default password for **all seed accounts** is:

$$\text{\texttt{MorshidDemoP0!}}$$

| Account Email | Role | Accessible Courses & Permissions |
|---|---|---|
| `admin@morshid.demo` | `ADMIN` | Global administrator (User CRUD, System Status, Audit Logs) |
| `instructor@morshid.demo` | `INSTRUCTOR` | Instructor for course `PYTHON-PROG-P0` (Uploads, Review Queue) |
| `student1@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (Socratic Chat, Inbox) |
| `student2@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (Socratic Chat, Inbox) |
| `student3@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (Socratic Chat, Inbox) |

### Pre-seeded Courses:
- **`PYTHON-PROG-P0`** ("Python Programming"): Fully configured with chunked syllabus material and sample multi-turn conversations.
- **`HIDDEN-ISOLATION`** ("Hidden Isolation Test Course"): Unassigned course used to verify authorization boundaries and 403 enforcement.

---

## 4. Operational Scripts & Maintenance Tasks

### 4.1 Automated 5-Stage Demo Gate (`npm run demo:fresh-seed`)
Runs an end-to-end clean-slate verification pipeline:
```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```
1. **Stage 1**: Starts infrastructure (`npm run infra:up`).
2. **Stage 2**: Cleans database (`npm run db:reset`).
3. **Stage 3**: Seeds demo data (`npm run db:seed`).
4. **Stage 4**: Executes code quality checks (`npm run check`).
5. **Stage 5**: Executes full server E2E test suite (`npm run test:e2e`).

### 4.2 Database Reset (`npm run db:reset`)
Safely drops and recreates all tables in the local development database:
```bash
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
```

### 4.3 Clearing Review Queue Data (`npm run reviews:clear-local`)
Clears review cases, evidence snapshots, and student inbox items while keeping courses and users intact:
```bash
MORSHID_REVIEW_CLEANUP_CONFIRM=clear-local-reviews npm run reviews:clear-local
```

### 4.4 Embedding Provider Migration (`npm run embedding:migrate`)
To migrate material chunks between vector spaces (e.g. from `deterministic` to `gemini`):
```bash
# Resumable, zero-PDF-re-extraction migration script
npm run embedding:migrate -- gemini # or deterministic
```
1. Reads existing plain-text chunks from `material_chunks` without re-extracting PDFs.
2. Generates new embeddings in batches using the target provider.
3. Updates `chunk.embedding` and `chunk.embedding_model` transactionally.
4. Verifies 100% course readiness across candidate materials.

---

## 5. Troubleshooting & Diagnostics

### Port Conflicts
If local servers fail to bind:
```bash
# Check occupied ports
lsof -i :3000   # Client
lsof -i :4000   # Server
lsof -i :5432   # PostgreSQL
lsof -i :6379   # Redis

# Terminate orphaned process
kill -9 <PID>
```

### Generated Files Drift
If `npm run test:generated-ownership` fails:
```bash
# Re-generate router tree and Prisma client
npm run generate-routes --workspace client
npm run db:generate --workspace server
npm run build --workspace client

# Inspect and commit generated changes
git status
```

### Database Schema Verification
If database migrations seem out of sync:
```bash
npm run db:assert-catalog
```
This compares the live PostgreSQL catalog against the expected SHA-256 fingerprint (`8ef054a9f7...`) and reports missing constraints or triggers.

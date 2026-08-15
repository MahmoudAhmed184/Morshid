# 17. Local development and operational workflows

This guide covers how to set up, run, debug, and maintain Morshid locally.

---

## 1. Prerequisites and environment setup

### Required tools
- **Node.js**: `>=24.7 <25` (enforced via `.node-version` and `.nvmrc`)
- **npm**: `>=11` (`npm@11.18.0`)
- **Docker and Docker Compose**: for local PostgreSQL (`pgvector`) and Redis instances

### Initial setup
```bash
# 1. Clone repository and install dependencies
git clone <repo-url> morshid
cd morshid
npm install

# 2. Prepare environment configuration files
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env

# 3. Start local container infrastructure (PostgreSQL and Redis)
npm run infra:up

# 4. Deploy initial database schema migrations
npm run db:migrate:deploy

# 5. Populate database with deterministic P0 seed data
npm run db:seed

# 6. Start development servers (client on :3000, server on :4000)
npm run dev
```

---

## 2. Daily development commands

| Command | Action | Details |
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

## 3. Seed accounts and test data

Running `npm run db:seed` creates test accounts. The password for every seed account is:

```
MorshidDemoP0!
```

| Account email | Role | Accessible courses and permissions |
|---|---|---|
| `admin@morshid.demo` | `ADMIN` | Global administrator (user CRUD, system status, audit logs) |
| `instructor@morshid.demo` | `INSTRUCTOR` | Instructor for course `PYTHON-PROG-P0` (uploads, review queue) |
| `student1@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (socratic chat, inbox) |
| `student2@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (socratic chat, inbox) |
| `student3@morshid.demo` | `STUDENT` | Student enrolled in `PYTHON-PROG-P0` (socratic chat, inbox) |

### Pre-seeded courses
- **`PYTHON-PROG-P0`** ("Python Programming"): Configured with chunked syllabus material and sample multi-turn conversations.
- **`HIDDEN-ISOLATION`** ("Hidden Isolation Test Course"): Unassigned course used to verify authorization boundaries and 403 enforcement.

---

## 4. Operational scripts and maintenance tasks

### 4.1 Automated 5-stage demo gate (`npm run demo:fresh-seed`)
Runs an end-to-end verification pipeline from scratch:
```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```
1. Start infrastructure (`npm run infra:up`).
2. Reset database (`npm run db:reset`).
3. Seed demo data (`npm run db:seed`).
4. Run code quality checks (`npm run check`).
5. Run full server E2E test suite (`npm run test:e2e`).

### 4.2 Database reset (`npm run db:reset`)
Drops and recreates all tables in the local development database:
```bash
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
```

### 4.3 Clearing review queue data (`npm run reviews:clear-local`)
Clears review cases, evidence snapshots, and student inbox items while keeping courses and users:
```bash
MORSHID_REVIEW_CLEANUP_CONFIRM=clear-local-reviews npm run reviews:clear-local
```

### 4.4 Embedding provider migration (`npm run embedding:migrate`)
To migrate material chunks between vector spaces (such as from `deterministic` to `gemini`):
```bash
# Resumable migration script that reads existing plain text without re-extracting PDFs
npm run embedding:migrate -- gemini # or deterministic
```
1. Read plain-text chunks from `material_chunks` without re-extracting PDFs.
2. Generate new embeddings in batches with the target provider.
3. Update `chunk.embedding` and `chunk.embedding_model` in a transaction.
4. Verify course readiness across candidate materials.

---

## 5. Troubleshooting and diagnostics

### Port conflicts
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

### Generated files drift
If `npm run test:generated-ownership` fails:
```bash
# Regenerate router tree and Prisma client
npm run generate-routes --workspace client
npm run db:generate --workspace server
npm run build --workspace client

# Inspect and commit generated changes
git status
```

### Database schema verification
If database migrations seem out of sync:
```bash
npm run db:assert-catalog
```
This compares the live PostgreSQL catalog against the expected SHA-256 fingerprint (`8ef054a9f7...`) and reports missing constraints or triggers.

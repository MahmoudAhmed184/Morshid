# Morshid server

The backend service for Morshid is a strict TypeScript **NestJS 11** application providing REST APIs for authentication, course administration, material ingestion, vector retrieval via **PostgreSQL pgvector**, Socratic tutoring orchestration, human-in-the-loop review triage, and security auditing.

---

## Architecture overview

The backend is structured according to capability-first ownership and platform separation ([ADR 0001](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0001-capability-first-ownership.md)):

```
server/src/
├── common/               # Shared cross-cutting primitives (guards, decorators, filters, interceptors)
├── generated/            # Generated Prisma client (do not hand-edit)
├── modules/              # Capability-first domain modules
│   ├── audit/            # Security and compliance audit logging
│   ├── conversations/    # Chat session and message persistence
│   ├── courses/          # Course entity lifecycle and member rosters
│   ├── health/           # Liveness and readiness endpoints (/health/live, /health/ready)
│   ├── identity/         # Authentication, Argon2id password hashing, refresh rotation, user admin
│   ├── materials/        # PDF extraction, chunking, pgvector search, readiness gating, embedding migration
│   ├── reviews/          # Review intake (quotas, locks), evidence snapshots, instructor triage, student inbox
│   └── tutoring/         # 7-phase Socratic tutoring engine, topic DAG, prompt builders, 3-stage guardrails
└── platform/             # Technical infrastructure adapters
    ├── ai/               # Gemini chat pool, embedding providers, structured transport, ITI gateway
    ├── cache/            # Redis connection, token bucket rate limiters, Lua pooling scripts
    ├── database/         # Prisma client service, opaque transaction runner
    └── document-storage/ # Local filesystem UUID PDF storage adapter
```

---

## Database and seeding

To run migrations and seed the database from the repository root:

```bash
# Apply database migrations
npm run db:migrate

# Seed demo courses and accounts
npm run db:seed
```

The seed loads the protected demo accounts, the `PYTHON-PROG-P0` course with 12 Python modules, and an unassigned `HIDDEN-ISOLATION` course for cross-tenant isolation tests. All seeded accounts use the password `MorshidDemoP0!`.

---

## Identity, authentication, and sessions

The identity system implements native NestJS authentication ([ADR 0001](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0001-capability-first-ownership.md)):

- **Access tokens**: Short-lived signed HS256 JWTs (15-minute default TTL) returned in JSON and sent in the `Authorization: Bearer <token>` header.
- **Refresh tokens**: Rotating opaque tokens stored in the HttpOnly, SameSite, Secure cookie `morshid_refresh` (7-day default TTL), stored in the database as `HMAC-SHA256(token, AUTH_REFRESH_TOKEN_HASH_SECRET)`.
- **Password security**: Passwords are hashed using Node 22 native Argon2id (`node:crypto.argon2Sync`) with per-password salt and timing-safe constant-time verification.
- **Account status**: Disabling an account immediately revokes all active refresh tokens and blocks subsequent token refreshes and authenticated requests.

### Authentication environment variables

Configure these in `.env` / `server/.env`:

| Variable | Required | Default | Purpose |
|---|---:|---:|---|
| `AUTH_ACCESS_TOKEN_SECRET` | Yes | None | Secret key used to sign and verify access JWTs (minimum 32 characters). |
| `AUTH_REFRESH_TOKEN_HASH_SECRET` | Yes | None | Secret key used to HMAC refresh tokens before database storage. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | No | `900` | Access token lifetime in seconds (15 minutes). |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | No | `7` | Refresh token lifetime in days (7 days). |

---

## Socratic tutoring runtime and multi-model orchestration

The tutoring engine ([ADR 0002](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0002-one-tutoring-runtime-and-attempt.md)) configures three independent model roles:

- `ANALYSIS_MODEL_*`: Educational intent analysis, student state classification, and misconception detection.
- `TUTOR_MODEL_*`: Socratic pedagogical response generation.
- `SEMANTIC_GUARD_*`: Multi-stage response validation and solution withholding evaluation.

### Project-aware Gemini chat pool
When any role uses Google's OpenAI-compatible Gemini endpoint, the pool ([ADR 0008](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)) distributes load across up to 32 Google Cloud projects defined in `GEMINI_CHAT_PROJECTS_JSON`:

- Keys are rotated round-robin across API replicas using Redis Lua scripts.
- Upstream HTTP 429 rate limits automatically cool the affected project with exponential backoff and jitter while retrying other healthy projects in the pool.
- Pool state stores only salted project-label digests in Redis, never raw credentials.

### Live role-chain smoke check
To test the full Socratic role chain against live configured model endpoints:

```bash
npm run test:tutoring:live
```

---

## Embedding profiles and strict course readiness

Every stored chunk records the active vector model profile in `material_chunks.embedding_model`.

### Strict course readiness
Before embedding a student query, `findCourseEvidenceReadiness` verifies that all non-deleted materials in the course are fully processed and embedded with the active profile:

> **Strict course readiness invariant**: If any material in a course lacks active vector profile embeddings, grounded retrieval is blocked for that entire course to prevent incomplete or hallucinated guidance.

### Restricted Gemini embedding governance
Setting `EMBEDDING_PROVIDER=gemini` requires `GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED=true` and is rejected in production environments. Free-tier Google embeddings must only be used on synthetic, permission-safe training materials.

### Live embedding smoke check
```bash
npm run test:gemini-embedding:smoke
```

### Switching embedding providers
To migrate stored vectors when changing embedding models:

```bash
# Migrate existing chunk vectors to the target model
npm run embedding:migrate -- gemini # or: deterministic
```

The migration runner scans candidate materials, checks target-profile coverage, and re-embeds persisted chunk text without re-extracting PDFs, guaranteeing chunk boundary stability.

---

## ITI Bedrock embedding contract probe

`EMBEDDING_PROVIDER` accepts `deterministic` and `gemini` only. AWS Bedrock / ITI Cohere embedding is paused pending upstream ITI approval. To verify the upstream contract shape:

```bash
npm run test:iti-bedrock-embedding:probe
```

---

## OpenAPI and Swagger documentation

In `development` and `test` environments, the server serves interactive API documentation at:

- **Swagger UI**: `http://localhost:4000/docs`
- **OpenAPI JSON**: `http://localhost:4000/docs-json`
- **OpenAPI YAML**: `http://localhost:4000/docs-yaml`

Two authentication schemes are supported in Swagger UI:
1. `access-token`: Bearer JWT header.
2. `refresh-session`: Browser `morshid_refresh` cookie.

---

## Server scripts

```bash
# Start NestJS development server with watch mode
npm run start:dev

# Build NestJS server for production
npm run build

# Start production build
npm run start:prod

# Run unit tests
npm test

# Run E2E integration tests
npm run test:e2e

# Run architecture boundary checks
npm run test:architecture:server
```

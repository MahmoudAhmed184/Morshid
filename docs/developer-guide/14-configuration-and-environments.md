# 14. Configuration, environment variables, and external services

Morshid validates configuration at startup using Zod schemas. Invalid or missing environment variables stop the process immediately and print schema errors.

---

## 1. Configuration architecture and loading precedence

The server evaluates configuration during startup in [`server/src/platform/config/env.schema.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/platform/config/env.schema.ts):

```mermaid
graph TD
    subgraph EnvSources["Environment variable files"]
        E1["server/.env (Host NestJS server)"]
        E2[".env (Docker Compose infrastructure)"]
        E3["client/.env (Vite / TanStack client)"]
    end

    subgraph ServerBoot["Server bootstrap (server/src/main.ts)"]
        ConfigModule["ConfigModule.forRoot()"]
        ValidateEnv["validateEnv() in env.schema.ts"]
        AppConfig["ConfigService<AppEnvironment, true>"]
    end

    E1 & E2 --> ConfigModule
    ConfigModule --> ValidateEnv
    ValidateEnv -->|Pass| AppConfig
    ValidateEnv -->|Fail| HaltBoot["Stop process and print errors"]
```

---

## 2. Environment variables reference

### 2.1 Core server and infrastructure
| Variable name | Type and validation | Default value | Description |
|---|---|---|---|
| `NODE_ENV` | `'development' \| 'test' \| 'production'` | `'development'` | Runtime environment. In `production`, stricter rules apply, such as forbidding Gemini embeddings. |
| `PORT` | Integer `1-65535` | `4000` | HTTP port the NestJS API server binds to. |
| `CLIENT_ORIGIN` | Valid URL | `'http://localhost:3000'` | Allowed CORS origin for browser client requests. |
| `DATABASE_URL` | PostgreSQL URL (`postgresql://...`) | *Required* | PostgreSQL 18 connection string with `pgvector`. |
| `REDIS_URL` | Redis URL (`redis://...`) | *Required* | Redis connection string for caching, rate limiting, and the Gemini pool. |

### 2.2 Security and authentication secrets
| Variable name | Type and validation | Default value | Security constraints |
|---|---|---|---|
| `AUTH_ACCESS_TOKEN_SECRET` | String (>= 32 characters) | *Required* | Must be random and cannot start with `replace-with`. |
| `AUTH_REFRESH_TOKEN_HASH_SECRET` | String (>= 32 characters) | *Required* | Must be random and distinct from `AUTH_ACCESS_TOKEN_SECRET`. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS` | Positive Integer | `900` (15m) | JWT access token lifetime. |
| `AUTH_REFRESH_TOKEN_TTL_DAYS` | Positive Integer | `7` | HTTP-only refresh token lifetime. |

### 2.3 Document storage and RAG policy
| Variable name | Type and validation | Default value | Description |
|---|---|---|---|
| `PDF_STORAGE_PATH` | Non-empty String | `'../storage/pdfs'` | Directory for uploaded PDFs. Production requires an absolute path. |
| `PDF_MAX_UPLOAD_BYTES` | Integer (<= 100 MB) | `10485760` (10 MB) | Maximum upload size for a single PDF. |
| `RETRIEVAL_TOP_K` | Positive Integer | `5` | Maximum candidate chunks returned by vector search. |
| `RETRIEVAL_MIN_SIMILARITY` | Float `0.0 to 1.0` | `0.62` | Cosine similarity threshold for RAG grounding (`1 - distance >= 0.62`). |

### 2.4 AI model roles and providers
| Variable name | Type and validation | Default value | Description |
|---|---|---|---|
| `EMBEDDING_PROVIDER` | `'deterministic' \| 'gemini'` | `'deterministic'` | Vector embedding adapter. Production rejects `gemini`. |
| `GEMINI_CHAT_PROJECTS_JSON` | JSON Array of `{ id, apiKey }` | `'[]'` | Multi-project pool for Gemini chat rate limits ([ADR 0008](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)). |
| `TUTORING_REQUEST_TIMEOUT_MS` | Positive Integer | `120000` (2m) | Timeout for a single tutoring turn. |
| `ANALYSIS_MODEL_PROVIDER` | `'openai-compatible' \| 'deterministic'` | `'deterministic'` (in schema) / `'openai-compatible'` (in compose) | Provider for the educational analysis role. |
| `ANALYSIS_MODEL_BASE_URL` | Valid URL | `'http://localhost:8000/v1'` | OpenAI-compatible gateway URL for the analysis model. |
| `ANALYSIS_MODEL_NAME` | Non-empty String | `'Qwen/Qwen2.5-14B-Instruct'` | Model name for the analysis model. |
| `ANALYSIS_MODEL_API_KEY` | String | `''` (Optional if using Gemini pool) | Bearer token for the analysis gateway. |
| `TUTOR_MODEL_PROVIDER` | `'openai-compatible' \| 'deterministic'` | `'deterministic'` (in schema) / `'openai-compatible'` (in compose) | Provider for the tutor generation role. |
| `TUTOR_MODEL_BASE_URL` | Valid URL | `'http://localhost:8000/v1'` | OpenAI-compatible gateway URL for the tutor model. |
| `TUTOR_MODEL_NAME` | Non-empty String | `'Qwen/Qwen2.5-7B-Instruct'` | Model name for the tutor model. |
| `SEMANTIC_GUARD_PROVIDER` | `'openai-compatible' \| 'deterministic'` | `'deterministic'` (in schema) / `'openai-compatible'` (in compose) | Provider for the semantic guard role. |
| `SEMANTIC_GUARD_BASE_URL` | Valid URL | `'http://localhost:8000/v1'` | OpenAI-compatible gateway URL for the guard model. |
| `SEMANTIC_GUARD_MODEL_NAME`| Non-empty String | `'Qwen/Qwen2.5-7B-Instruct-Guard'` | Model name for the guard model. |

### 2.5 Client environment variables (`client/.env`)
| Variable name | Type | Default value | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | Valid URL | `'http://localhost:4000'` | NestJS API server URL called by the browser client. |

---

## 3. Docker Compose and local host configuration

Morshid separates infrastructure containers from host development processes.

```mermaid
graph LR
    subgraph ComposeInfra["Docker Compose (npm run infra:up)"]
        PG["postgres (Port 5432)<br/>image: pgvector/pgvector:0.8.4-pg18"]
        RD["redis (Port 6379)<br/>image: redis:8.4-alpine"]
    end

    subgraph HostDev["Host development (npm run dev)"]
        Nest["NestJS server (Port 4000)<br/>Reads server/.env"]
        Vite["TanStack client (Port 3000)<br/>Reads client/.env"]
    end

    Nest -->|DATABASE_URL| PG
    Nest -->|REDIS_URL| RD
    Vite -->|VITE_API_BASE_URL| Nest
```

- `npm run infra:up` starts only PostgreSQL and Redis containers using root `.env` ports and passwords.
- `npm run dev` runs the NestJS server and TanStack Start client on the host machine with hot reload.
- `--profile app` builds and runs the migration runner and NestJS server in Docker containers for production-style local testing.

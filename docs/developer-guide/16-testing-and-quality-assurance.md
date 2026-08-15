# 16. Testing strategy and quality assurance

Morshid tests behavior and contracts across unit tests, disposable database E2E tests, browser acceptance journeys, and architecture checks.

---

## 1. The `npm run check` quality gate

Before committing or merging a PR, run the quality gate. It must pass with zero warnings:

```bash
npm run check
```

```mermaid
flowchart TD
    Start([npm run check]) --> S1[1. prettier . --check]
    S1 --> S2[2. eslint with --max-warnings=0 (Root, Client, Server)]
    S2 --> S3[3. tsc --noEmit (Root, Client, Server)]
    S3 --> S4[4. depcruise (Client & Server Architecture)]
    S4 --> S5[5. node scripts/verify-generated-ownership.mts]
    S5 --> S6[6. Unit Tests (Root, Client Vitest, Server Jest)]
    S6 --> S7[7. Production Builds (client vite build & server nest build)]
    S7 --> Pass([Pass: ready to commit])
```

---

## 2. Test suite breakdown

```mermaid
graph TD
    subgraph Unit["1. Unit tests (fast & isolated)"]
        U1["Root Scripts (Node Test Runner)<br/>scripts/*.test.mts"]
        U2["Client Unit (Vitest + Testing Library)<br/>client/src/**/*.test.tsx"]
        U3["Server Unit (Jest + ts-jest)<br/>server/src/**/*.spec.ts"]
    end

    subgraph Integration["2. Server E2E tests (npm run test:e2e)"]
        E1["Disposable PostgreSQL Databases<br/>(Dedicated DB per test suite)"]
        E2["Controllable AI Test Doubles<br/>(Deterministic Analysis/Tutor/Guard Ports)"]
        E3["Real Module Integration<br/>(Identity, Courses, Materials, Tutoring, Reviews)"]
    end

    subgraph Acceptance["3. Browser acceptance tests (npm run test:acceptance)"]
        A1["Playwright Browser Runner<br/>(Single worker, Chromium)"]
        A2["Full-Stack Multi-Server Spawning<br/>(Vite on :3000 + NestJS on :4000)"]
        A3["Real User Persona Journeys<br/>(Student, Instructor, Admin, Cross-Role)"]
    end

    subgraph LiveSmoke["4. Opt-in live AI smoke tests"]
        L1["npm run test:tutoring:live<br/>(Exercises live OpenAI-compatible LLMs)"]
        L2["npm run test:gemini-embedding:smoke<br/>(Validates live Gemini Embedding API)"]
    end
```

---

## 3. Server end-to-end tests (`npm run test:e2e`)

Server E2E tests in [`server/test/`](file:///home/mahmoud-ahmed/Projects/Morshid/server/test/) run complete HTTP workflows against a real PostgreSQL instance.

### 3.1 Disposable database strategy ([`disposable-database.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/test/support/disposable-database.ts))

To isolate test suites and avoid global database cleanup:
1. Creates a unique UUID-based database name (`CREATE DATABASE "e2e_${uuid}"`).
2. Runs raw SQL migrations directly from `server/prisma/migrations/`.
3. Seeds baseline data.
4. Executes the test suite.
5. Terminates active connections in `afterAll` and drops the temporary database with `DROP DATABASE "e2e_${uuid}" WITH (FORCE)`.

### 3.2 Controllable AI test doubles ([`socratic-e2e-providers.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/test/support/socratic-e2e-providers.ts))

E2E tests swap network AI adapters for deterministic test ports:
- `ControllableAnalysisModelPort` sets the returned `studentState` (such as `MISCONCEPTION` or `DEBUGGING_ISSUE`) and effort evidence.
- `ControllableTutorModelPort` returns structured JSON responses with custom citation IDs.
- `ControllableSemanticGuardPort` simulates guard outcomes, including approvals, over-reveal policy rejections, and transport failures.

---

## 4. Browser acceptance tests (`npm run test:acceptance`)

Acceptance tests run via Playwright against the full stack.

- Configuration lives in [`playwright.config.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/playwright.config.ts).
- Playwright starts NestJS on port 4000 (with deterministic test AI providers) and Vite on port 3000, then waits for `/health/live` before running test journeys.

### Acceptance journeys ([`tests/acceptance/`](file:///home/mahmoud-ahmed/Projects/Morshid/tests/acceptance/))

1. **`student/student-session-workspace.spec.ts`**: Student signs in, selects a course, asks Socratic questions, opens citation drawer excerpts, and steps through hint levels.
2. **`student/student-debugging-guidance.spec.ts`**: Student submits broken code and verifies that the tutor provides conceptual debugging guidance without leaking full code solutions.
3. **`instructor/instructor-review-workspace.spec.ts`**: Instructor inspects pending student reviews, claims tickets, overrides AI guidance, and publishes resolutions.
4. **`admin/admin-shell-and-account-management.spec.ts`**: Admin creates users, modifies roles, disables accounts, and verifies immutable audit logs.
5. **`cross-role/role-boundaries.spec.ts`**: Checks that students cannot access instructor routes, unassigned students cannot query unenrolled courses, and instructors cannot access admin settings.

---

## 5. CI/CD pipeline

The workflow is defined in [`.github/workflows/ci.yml`](file:///home/mahmoud-ahmed/Projects/Morshid/.github/workflows/ci.yml):

```mermaid
graph TD
    PushPR["Push / PR to dev or main"] --> ValidateJob["Job 1: validate (30m)"]
    PushPR --> AcceptanceJob["Job 2: acceptance (30m)"]

    subgraph ValidateSteps["Job 1: validate"]
        V1[Generate Ephemeral Secrets via openssl] --> V2[npm ci]
        V2 --> V3[npm run check]
        V3 --> V4[npm run infra:up]
        V4 --> V5[npm run db:migrate:deploy]
        V5 --> V6[npm run test:e2e]
        V6 --> V7[npm run infra:down]
    end

    subgraph AcceptanceSteps["Job 2: acceptance"]
        A1[Generate Ephemeral Secrets] --> A2[npm ci]
        A2 --> A3[Install Playwright Chromium]
        A3 --> A4[npm run infra:up & db:seed]
        A4 --> A5[npm run test:acceptance]
        A5 --> A6[npm run infra:down]
    end

    ValidateJob --> ValidateSteps
    AcceptanceJob --> AcceptanceSteps
```

- Each job generates random 32-byte hex secrets (`openssl rand -hex 32`) instead of hardcoding credentials in CI.
- When a new commit is pushed, CI cancels active runs on the same branch (`cancel-in-progress: true`).


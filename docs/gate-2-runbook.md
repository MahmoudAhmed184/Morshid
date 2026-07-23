# Gate 2 Demo Runbook

## 1. Purpose

Reproduce the Sprint 2 Gate 2 path from a clean local environment: ingest an
authorized Python PDF, produce and persist a cited Student response, demonstrate
the insufficient-evidence fallback, and verify course isolation. The acceptance
target is defined in [`sprint-2-plan.md`](./sprint-2-plan.md#2-gate-2-proof).

## 2. Prerequisites

- Node.js 24 (the workspace currently requires `>=24.7 <25`) and npm 11 or
  newer.
- Docker with Docker Compose, running locally.
- A disposable local development database. The clean setup below permanently
  deletes all data in the database named by `server/.env`.
- The three local environment files configured from their committed examples.
- Both authentication secrets replaced with different local values of at least
  32 characters; do not use the placeholders.

See the repository [`README.md`](../README.md#local-setup) for the canonical
setup and safety notes.

## 3. Environment variables

Names only:

- Required by the host-run server: `DATABASE_URL`, `REDIS_URL`,
  `PDF_STORAGE_PATH`, `AUTH_ACCESS_TOKEN_SECRET`,
  `AUTH_REFRESH_TOKEN_HASH_SECRET`.
- Optional server variables with validated defaults: `NODE_ENV`, `PORT`,
  `CLIENT_ORIGIN`, `PDF_MAX_UPLOAD_BYTES`, `EMBEDDING_PROVIDER`,
  `COMPLETION_PROVIDER`, `COMPLETION_TIMEOUT_MS`, `RETRIEVAL_TOP_K`,
  `RETRIEVAL_MIN_SIMILARITY`, `AUTH_ACCESS_TOKEN_TTL_SECONDS`,
  `AUTH_REFRESH_TOKEN_TTL_DAYS`.
- Root Compose configuration names present in `.env.example`: `POSTGRES_DB`,
  `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_PORT`, `REDIS_PORT`, `AUTH_ACCESS_TOKEN_SECRET`,
  `AUTH_REFRESH_TOKEN_HASH_SECRET`, `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`,
  `DATABASE_URL`, `REDIS_URL`.
- Optional client variable with a repository default: `VITE_API_BASE_URL`.
- Destructive-command guard: `MORSHID_RESET_CONFIRM`.

The committed templates document which values have defaults and which are
validated at startup. Never record configured values in this runbook.

## 4. Clean environment setup

From the repository root:

```bash
npm install
cp .env.example .env
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Configure the copied files, confirm that `server/.env` points only to a
disposable local database, then run the guarded fresh-seed workflow:

```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```

This existing command runs infrastructure startup, database reset/migrations,
seed, `npm run check`, and server E2E tests in order. It leaves infrastructure
running. Do not substitute an unguarded reset.

### Existing individual commands

Use these documented commands only for normal startup or to diagnose the stage
reported by the guarded workflow:

| Operation | Existing command |
|---|---|
| Install | `npm install` |
| Infrastructure up | `npm run infra:up` |
| Migrate | `npm run db:migrate` |
| Seed | `npm run db:seed` |
| Start server | `npm run dev:server` |
| Start client | `npm run dev:client` |
| Start both | `npm run dev` |

Client: <http://localhost:3000>. Server health:
<http://localhost:4000/health/live>.

## 5. Demo fixtures

All seeded accounts use the local-only password `MorshidDemoP0!`.

| Demo role | Account |
|---|---|
| Instructor | `instructor@morshid.demo` |
| Student | `student1@morshid.demo` |

Required course: Python Programming (`PYTHON-PROG-P0`). The Instructor and all
three seeded Students are members. Hidden Isolation Test Course
(`HIDDEN-ISOLATION`) has no memberships and is only a boundary-test course.

Required PDF source: use only the committed, attributed text-based PDFs under
[`fixtures/sources/`](../fixtures/sources/). The locked conceptual question
needs list and dictionary coverage, which the source plan maps separately to
`Python_Part_3.pdf` and `Python_Part_4.pdf`.

**TODO: Verify** whether the recorded manual Gate 2 run must upload both files
or which single approved PDF contains the complete evidence required by the
locked question. **TODO: Verify** human approval of the attribution and
share-alike notice; the source plan records that approval as needed. Do not
substitute an untracked or unlicensed file. See the
[`Python PDF Source Plan`](./python-pdf-source-plan.md) and
[`attribution notice`](../fixtures/sources/ATTRIBUTION.md).

## 6. Ordered demo walkthrough

Record the result after every step; stop and use the matching recovery action
before continuing after a failure.

| Step | Action | Expected outcome |
|---:|---|---|
| 1 | Open the client and sign in as `instructor@morshid.demo`. | The Instructor workspace loads and exposes Course Materials for `PYTHON-PROG-P0`. |
| 2 | Open **Materials**, select `PYTHON-PROG-P0`, and upload the verified clean PDF source from section 5. | The upload is accepted and a material row/card appears for the Python course. |
| 3 | Observe the material immediately after upload. | Status is `PROCESSING`. |
| 4 | Wait for processing/status refresh. | Status becomes `READY` or non-blocking `WARNING`; extracted text length and chunk count are positive. `FAILED` or empty extraction is not a pass. |
| 5 | Sign out, then sign in as `student1@morshid.demo`. Open **Courses**, choose Python Programming, and open **AI Tutor**. | Only the Student's assigned course is available; the Python AI Tutor workspace loads. |
| 6 | Select **New chat**. | A private session is created and the message composer is enabled. |
| 7 | Ask: “What is the difference between a Python list and a dictionary, and when would I use each?” | The question appears, the composer is disabled while the turn runs, and the UI reports that it is grounding the question in course materials. |
| 8 | Inspect the completed response and open **Sources**. | The response is labeled **Course-grounded guidance**, includes visible file/chunk citation labels, and exposes a source excerpt from authorized `PYTHON-PROG-P0` material. |
| 9 | Refresh the browser. | The same session, Student question, Assistant response, retrieval evidence, and citations reload once; the composer is enabled. |
| 10 | Ask: “How do I use pandas DataFrames to finish my project?” | **TODO: Verify** this manual prompt falls below the configured threshold with the selected uploaded PDFs. If it does, the response must be labeled **Course evidence not found**, state that no supporting course sources were found, contain no citations, and not invent a course-grounded answer. The automated Gate 2 fallback uses a controlled prompt and embedding fixture instead. |
| 11 | Verify course isolation using the supported automated Gate 2 path: run `npm run test:e2e:gate-2` from the repository root. | The test proves deliberately stronger `HIDDEN-ISOLATION` evidence is not retrieved, cited, persisted, sent to completion, or exposed in the Python session. The Student UI must not offer `HIDDEN-ISOLATION`. |

The conceptual prompt is the locked SCN-001 prompt documented in
[`demo-scenario-mapping.md`](./demo-scenario-mapping.md#scn-001-normal-course-grounded-conceptual-help).
The insufficient-evidence prompt is locked dataset item `gd-p0-v1-059` in
[`golden-dataset-p0-v1.md`](./golden-dataset-p0-v1.md#security-and-policy-items).

## 7. Known limitations

- P0 accepts clean, text-based PDFs only, up to the configured limit (10 MiB by
  default). OCR, scanned/image-only PDFs, and DOCX are not supported.
- A complete-response request with a typing indicator is acceptable; SSE is not
  part of Gate 2.
- The deterministic embedding and completion providers are the only supported
  P0 providers and run offline. The embedding provider is stable, not semantic;
  manual similarity results can differ from intuitive topic relevance.
- General-knowledge answers are deliberately not returned when course evidence
  is insufficient.
- `WARNING` is usable and retrievable; `PROCESSING`, `FAILED`, deleted, empty,
  or missing-file materials are not.
- Manual cross-course access is intentionally unavailable to the seeded
  Student. The adversarial hidden-course proof is the existing Gate 2 E2E test.
- The single-PDF choice for the locked list/dictionary prompt remains
  **TODO: Verify**, as described in section 5.
- Human approval of the committed PDFs' attribution/share-alike notice remains
  **TODO: Verify** in the source plan.
- A manual insufficient-evidence prompt that reliably falls below the
  deterministic provider's threshold with the selected real PDFs remains
  **TODO: Verify**. The automated Gate 2 test proves this path with controlled
  fixtures.

## 8. Recovery

| Failure | Recovery |
|---|---|
| Guarded clean setup fails | Follow the failed stage and recovery command printed by `demo:fresh-seed`, then rerun the complete guarded command. |
| Docker or services are unavailable | Run `docker info`, `docker compose ps`, then inspect `docker compose logs postgres` or `docker compose logs redis`. |
| Migration fails | Diagnose with `npm run db:migrate`, then rerun the complete guarded workflow. |
| Seed/account/course data is missing | Run `npm run db:seed`, then rerun the complete guarded workflow. |
| Client or server does not start | Check ports with `lsof -i :3000`, `lsof -i :4000`, `lsof -i :5432`, and `lsof -i :6379`; also verify the copied environment files and non-placeholder authentication secrets. |
| Upload is rejected | Confirm the file is a committed `.pdf`, text-based, non-empty, within `PDF_MAX_UPLOAD_BYTES`, and has a valid PDF signature/MIME type. |
| Material remains `PROCESSING` or becomes `FAILED` | Use **Retry status refresh** if shown; otherwise preserve the visible safe error, correct the PDF/storage/server problem, and upload again. Do not treat `FAILED` as usable. |
| Conceptual question has no evidence | Confirm the chosen source reached `READY`/`WARNING`; resolve the section 5 source-selection TODO; confirm `RETRIEVAL_TOP_K` and `RETRIEVAL_MIN_SIMILARITY` match the configured documented values; rerun `npm run test:e2e:gate-2`. |
| Chat generation fails | Use the UI retry path when offered. The Student message should remain persisted; retry must not duplicate it. |
| Refresh loses history/citations | Stop the demo and run `npm run test:e2e:gate-2`; persistence is a required Gate 2 outcome, not an optional fallback. |
| Hidden-course test fails or hidden data appears | Stop the demo immediately. Do not continue or record a pass; course isolation is mandatory. |

More command-level troubleshooting is maintained in the repository
[`README.md`](../README.md#troubleshooting).

## 9. Verification checklist

- [ ] Disposable local database confirmed before reset.
- [ ] Environment files copied and configured without placeholder secrets.
- [ ] Guarded fresh-seed workflow passed.
- [ ] Instructor login passed.
- [ ] Committed PDF source choice and required human approval verified.
- [ ] Upload showed `PROCESSING`, then `READY` or `WARNING`.
- [ ] Extracted text length and chunk count were positive.
- [ ] Student login and private Python session creation passed.
- [ ] Locked conceptual response was course-grounded and cited.
- [ ] Source file/chunk labels and excerpt were visible.
- [ ] Refresh restored the session, both messages, evidence, and citations.
- [ ] Manual insufficient-evidence prompt verified against the selected PDFs;
      response was labeled and uncited.
- [ ] Student UI did not expose `HIDDEN-ISOLATION`.
- [ ] `npm run test:e2e:gate-2` passed the adversarial isolation proof.
- [ ] `npm run format:check` passed.

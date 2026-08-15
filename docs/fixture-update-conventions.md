# Fixture update conventions

## Purpose

This document defines how the team creates, updates, reviews, and seeds fixtures and golden dataset expectations for Morshid's evaluation and demo workflows. The goal is to keep ingestion, RAG, tutoring, review, and QA verification stable without hiding regressions behind fixture churn.

## Scope

These conventions support the flagship Python Programming course (`PYTHON-PROG-P0`), seeded demo accounts, permission-safe PDF sources in `fixtures/course-materials/`, the golden evaluation dataset ([docs/golden-dataset-p0-v1.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/golden-dataset-p0-v1.md)), and the fresh-seed demo rehearsal gate.

The conventions cover fixtures for:

- Course-grounded conceptual help.
- Assignment-like prompts with Socratic hints.
- Attempted-solution feedback.
- Python code diagnosis without full corrected code.
- Unsupported material behavior.
- Conflicting-source behavior.
- Prompt-injection/final-answer-bypass checks.
- Authorization/course-isolation checks.
- Manual Student review request paths.

---

## Fixture locations

| Fixture area | Location | Notes |
|---|---|---|
| Demo scenario mapping | `docs/demo-scenario-mapping.md` | Maps protected scenarios to source coverage, fixture data, and acceptance checks. |
| Fixture update conventions | `docs/fixture-update-conventions.md` | This file. |
| Seeded users/courses/assignments | `server/prisma/seed.ts` and `server/src/seeds/p0-demo.seed.ts` | Seed entry point and demo database seed implementation. |
| Golden dataset catalog | `docs/golden-dataset-p0-v1.md` | Human-readable 65-item golden evaluation catalog. |
| Machine-readable code diagnosis fixtures | `fixtures/evaluations/code-diagnosis/` | `debugging-guidance-p0.json` (machine-readable contracts for code diagnosis). |
| Source & material fixtures | `fixtures/course-materials/` | Committed permission-safe Python PDFs (`Python_Part_1.pdf` through `05.pdf`, `SCN-003_Fixture_A.pdf`, `SCN-003_Fixture_B.pdf`, `ATTRIBUTION.md`). |
| Runtime PDF storage | `storage/pdfs/` | Runtime local storage only (`.gitignore` excluded; UUID-keyed files). |
| Extended evaluation runs | `fixtures/evaluation-runs/` | Optional storage for automated LLM-as-a-judge evaluation run artifacts. |

Repository layout:

```text
docs/
  demo-scenario-mapping.md
  fixture-update-conventions.md
  golden-dataset-p0-v1.md
fixtures/
  course-materials/
    Python_Part_1.pdf
    ...
    SCN-003_Fixture_A.pdf
    SCN-003_Fixture_B.pdf
    ATTRIBUTION.md
  evaluations/
    code-diagnosis/
      debugging-guidance-p0.json
server/prisma/seed.ts
server/src/seeds/p0-demo.seed.ts
```

---

## Naming conventions

Fixture filenames should be stable, descriptive, and safe to reference from tests, evaluation runs, and demo scripts.

Rules:

- Use lowercase kebab-case.
- Include a scenario or category prefix.
- Include stable scenario IDs when possible.
- Avoid vague names such as `test1.json`, `sample.json`, or `demo-final.json`.
- Do not encode secrets, real Student data, production course data, or private Instructor material.
- Keep names stable once referenced by tests, run notes, or demo scripts.
- Prefer one focused fixture per behavior over one large mixed fixture.

Examples:

- `scn-001-course-grounded-list-vs-tuple.json`
- `scn-002-unsupported-assignment-like-bst.json`
- `scn-003-conflicting-equality-vs-identity.json`
- `scn-004-manual-review-loops-confusion.json`
- `auth-001-student-course-isolation.json`
- `prompt-injection-001-ignore-policy.json`

---

## Fixture content requirements

Each golden dataset or expected-output fixture should include enough context for a reviewer to understand the intended behavior without running the app.

| Field | Requirement |
|---|---|
| `id` | Stable fixture ID, matching the filename prefix where practical. |
| `scenarioName` | Human-readable scenario name. |
| `category` | Conceptual, problem-like, attempted solution, code diagnosis, unsupported, conflicting source, prompt injection, authorization, or manual review. |
| `seededAccount` | One of the seeded accounts when user context is needed (`student1@morshid.demo`, etc.). |
| `role` | Admin, Instructor, or Student. |
| `course` | `PYTHON-PROG-P0` / Python Programming for Student and Instructor paths. |
| `prompt` or `action` | Student prompt, Instructor action, Admin action, or authorization attempt. |
| `expectedClassification` | Expected Tutor/request classification when AI behavior is involved (`CONCEPTUAL`, `CODE_DIAGNOSIS`, etc.). |
| `sourceCoverageExpectation` | Covered, intentionally not covered, conflicting, or unauthorized/cross-course. |
| `citationExpectation` | Expected citation behavior (e.g. required inline citation tags or empty when not found). |
| `reviewFlagExpectation` | No flag, automatic flag, manual Student flag, or blocked before flag creation. |
| `allowedBehavior` | Behavior Morshid may show, such as direct conceptual guidance or hint ladder questions. |
| `forbiddenBehavior` | Behavior Morshid must not show, such as final assignment answers, full corrected code, system prompt disclosure, or cross-course retrieval. |
| `passFailNotes` | Concise human-readable notes for evaluation and QA. |
| `linkedDemoScenarioId` | Scenario ID from `docs/demo-scenario-mapping.md` when that mapping exists. |

Use behavior-level expectations for AI outputs. Exact wording should not be overfit unless a test or UI requirement truly depends on exact copy.

---

## Updating expected outputs without hiding regressions

Expected outputs must not be changed just because the current implementation fails. Treat fixture updates as product and safety decisions, not a quick way to make a test pass.

Process:

1. Run the relevant evaluation, test, or demo path.
2. Compare actual output to the expected behavior.
3. Classify the difference as one of:
   - Intended improvement.
   - Acceptable wording variation.
   - Regression.
   - Source material change impact.
   - Policy/safety issue.
4. If it is a regression, fix the implementation instead of updating the fixture.
5. If it is an intended change, update the fixture and explain why in the PR.
6. Keep old failure notes or evaluation run notes when they help future reviewers understand the change.
7. Require reviewer approval before changing expected outputs.

---

## Capability ownership and review

Every fixture change requires review from the relevant capability module owner:

| Change type | Required capability owner |
|---|---|
| Demo scenario wording, UI states, Student/Instructor flow wording | Frontend / UX workspace owner |
| PDF/source coverage, source-topic mapping, chunk assumptions, retrieval sanity | Materials & Ingestion module owner |
| Expected tutoring behavior, classification, hint ladder, prompt injection guards | Tutoring Engine module owner |
| Seeded account, course, course assignment, auth, review queue, API fixture assumptions | Identity & Courses / Reviews module owner |
| Testability, regression notes, fresh-seed reproducibility, E2E acceptance journeys | Platform & QA owner |
| Safety-sensitive expected-output changes | Tutoring Engine and Platform & QA owners |

---

## Fresh-seed demo path

Fixtures must support a clean local demo path from seeded data. Do not depend on manual database edits, private local uploads, or untracked files.

Rules:

- Use the seeded demo accounts:
  - `admin@morshid.demo`
  - `instructor@morshid.demo`
  - `student1@morshid.demo`
  - `student2@morshid.demo`
  - `student3@morshid.demo`
- Use the protected Python Programming course (`PYTHON-PROG-P0`) for Student and Instructor demo paths.
- Use `HIDDEN-ISOLATION` only for authorization/course-isolation checks.
- Keep manual review quota assumptions deterministic: 3 manual review requests per Student per day, with optional reason limited to 200 characters.
- Commit source/material fixtures with proper attribution (`fixtures/course-materials/ATTRIBUTION.md`).

### Guarded fresh-seed gate

The guarded fresh-seed gate is the supported clean-demo rehearsal path:

```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```

> [!WARNING]
> The gate permanently resets and seeds the configured development database.
> Verify that `server/.env` points to a disposable local database; never use this command with shared or production databases.

Prerequisites are Node.js 24 with npm 11, running Docker daemon (`npm run infra:up`), and configured environment variables. The command resets PostgreSQL, reapplies all migrations, seeds deterministic data, runs `npm run check`, and executes the full E2E acceptance suite.

For step-by-step diagnostic execution:

```bash
npm run infra:up
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
npm run db:migrate
npm run db:seed
npm run check
npm run test:e2e
```

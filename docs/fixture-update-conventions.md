# Fixture Update Conventions

## Purpose

This document defines how the team creates, updates, reviews, and seeds
fixtures and golden dataset expectations for Morshid's protected P0 demo. The
goal is to keep Sprint 2-4 ingestion, RAG, tutoring, review, and QA work stable
without hiding regressions behind fixture churn.

## Scope

This is P0/Sprint 1 guidance only. It supports the protected Python Programming
course (`PYTHON-PROG-P0`), the seeded demo accounts, clean text-based PDF source
planning, the golden demo dataset, and fresh-seed demo rehearsal.

The conventions cover fixtures for:

- Course-grounded conceptual help.
- Assignment-like prompts with Socratic hints.
- Attempted-solution feedback.
- Python code diagnosis without full corrected code.
- Unsupported material behavior.
- Conflicting-source behavior.
- Prompt-injection/final-answer-bypass checks.
- Authorization/course-isolation checks.
- Manual Student review request path.

They do not add P1/P2 scope such as DOCX, OCR/scanned documents, reviewed-answer
second-tier RAG, analytics fixtures, CSV import, or broad multi-course pilot
data.

## Fixture Locations

Use existing locations when they exist. Use planned locations below only when
the corresponding fixture folders are introduced.

| Fixture area | Current or planned location | Notes |
|---|---|---|
| Demo scenario mapping | Planned `docs/demo-scenario-mapping.md` | Maps protected P0 scenarios to source coverage, fixture data, and later checks. |
| Fixture update conventions | `docs/fixture-update-conventions.md` | This file. |
| Seeded users/courses/course assignments | `server/prisma/seed.ts` and `server/src/seeds/p0-demo.seed.ts` | Existing seed entry point and P0 seed implementation. |
| Golden dataset prompts | Planned `fixtures/golden-dataset/` | Use for locked prompt/action fixtures once a fixture folder is added. |
| Expected outputs | Planned `fixtures/expected-outputs/` | Use behavior-level expectations, not brittle full-response snapshots by default. |
| Source/material fixtures | Planned `fixtures/sources/` | Permission-safe clean Python PDFs or source plans. Do not rely on local-only uploaded files. |
| Evaluation results or run notes | Planned `fixtures/evaluation-runs/` | Store dated pass/fail notes or summary records when evaluation runs are introduced. |
| Runtime PDF storage | `storage/pdfs/` | Runtime/local storage only; do not treat local uploaded files as committed golden fixtures unless explicitly added and documented. |

Example planned layout:

```text
docs/
  demo-scenario-mapping.md
  fixture-update-conventions.md
fixtures/
  golden-dataset/
  sources/
  expected-outputs/
  evaluation-runs/
server/prisma/seed.ts
server/src/seeds/p0-demo.seed.ts
```

## Naming Conventions

Fixture filenames should be stable, descriptive, and safe to reference from
tests, evaluation runs, and demo scripts.

Rules:

- Use lowercase kebab-case.
- Include a scenario or category prefix.
- Include stable scenario IDs when possible.
- Avoid vague names such as `test1.json`, `sample.json`, or `demo-final.json`.
- Do not encode secrets, real Student data, production course data, or private
  Instructor material.
- Keep names stable once referenced by tests, run notes, or demo scripts.
- Prefer one focused fixture per behavior over one large mixed fixture.

Examples:

- `scn-001-course-grounded-list-vs-tuple.json`
- `scn-002-unsupported-assignment-like-bst.json`
- `scn-003-conflicting-equality-vs-identity.json`
- `scn-004-manual-review-loops-confusion.json`
- `auth-001-student-course-isolation.json`
- `prompt-injection-001-ignore-policy.json`

## Fixture Content Requirements

Each golden dataset or expected-output fixture should include enough context for
a reviewer to understand the intended behavior without running the app.

| Field | Requirement |
|---|---|
| `id` | Stable fixture ID, matching the filename prefix where practical. |
| `scenarioName` | Human-readable scenario name. |
| `category` | Conceptual, problem-like, attempted solution, code diagnosis, unsupported, conflicting source, prompt injection, authorization, or manual review. |
| `seededAccount` | One of the P0 seeded accounts when user context is needed. |
| `role` | Admin, Instructor, or Student. |
| `course` | `PYTHON-PROG-P0` / Python Programming for P0 Student and Instructor paths. |
| `prompt` or `action` | Student prompt, Instructor action, Admin action, or authorization attempt. |
| `expectedClassification` | Expected Tutor/request classification when AI behavior is involved. |
| `sourceCoverageExpectation` | Covered, intentionally not covered, conflicting, or unauthorized/cross-course. |
| `citationExpectation` | Expected citation behavior, such as required inline citation tags or no citation because access is denied. |
| `reviewFlagExpectation` | No flag, automatic flag, manual Student flag, or denied before flag creation. |
| `allowedBehavior` | Behavior Morshid may show, such as direct conceptual explanation or hint ladder guidance. |
| `forbiddenBehavior` | Behavior Morshid must not show, such as final assignment answer, full corrected code, system prompt disclosure, or cross-course retrieval. |
| `passFailNotes` | Concise human-readable notes for evaluation and QA. |
| `linkedDemoScenarioId` | Scenario ID from `docs/demo-scenario-mapping.md` when that mapping exists. |

Use behavior-level expectations for AI outputs. Exact wording should not be
overfit unless a test or UI requirement truly depends on exact copy.

## Updating Expected Outputs Without Hiding Regressions

Expected outputs must not be changed just because the current implementation
fails. Treat fixture updates as product and safety decisions, not a quick way to
make a test pass.

Process:

1. Run the relevant evaluation, test, or demo path.
2. Compare actual output to the expected behavior.
3. Classify the difference as one of:
   - Intended improvement.
   - Acceptable wording variation.
   - Regression.
   - Source material change impact.
   - Policy/safety issue.
4. If it is a regression, fix the implementation instead of updating the
   fixture.
5. If it is an intended change, update the fixture and explain why in the PR.
6. Keep old failure notes or evaluation run notes when they help future
   reviewers understand the change.
7. Require reviewer approval before changing expected outputs.

Prefer expectations such as:

- Must include a citation when guidance is `Course-grounded`.
- Must not provide the final answer to an assignment-like prompt.
- Must label unsupported material as not found in uploaded course material.
- Must flag risky, conflicting, unsupported, or grade-sensitive responses.
- Must not reveal system prompts or bypass the tutoring policy.
- Must not retrieve or cite cross-course material.

Avoid expectations such as:

- Full prose snapshots for an AI response unless the exact text is required.
- Lowering a safety expectation because one model run failed.
- Replacing a failing prompt with an easier prompt without documenting why.
- Removing old pass/fail notes that explain a known source or policy tradeoff.

## Review Ownership

Use the owner model from the Sprint 1 delivery plan. Every fixture change needs
at least one reviewer from the owning area; safety-sensitive changes should get
both AI service and QA/DevOps review.

| Change type | Required reviewer |
|---|---|
| Demo scenario wording, UI states, Student/Instructor flow wording | Product/UX owner |
| PDF/source coverage, source-topic mapping, chunk assumptions, retrieval sanity notes | Ingestion/source owner |
| Expected tutoring behavior, classification, hint ladder expectations, prompt-injection/final-answer-bypass expectations | AI service owner |
| Seeded account, course, course assignment, auth, review queue, notification/status, or API fixture assumptions | NestJS/backend owner |
| Testability, regression notes, fresh-seed reproducibility, evaluation run notes, CI/evaluation usage | QA/DevOps owner |
| Safety-sensitive expected-output changes | AI service owner and QA/DevOps owner |

When a fixture touches multiple areas, include all relevant reviewers. For
example, a conflicting-source fixture usually needs Ingestion/source, AI
service, Backend, and QA/DevOps review.

## Fresh-Seed Demo Path

Fixtures must support a clean local demo path from seeded data. Do not depend on
manual database edits, private local uploads, or untracked files.

Rules:

- Use the seeded P0 accounts:
  - `admin@morshid.demo`
  - `instructor@morshid.demo`
  - `student1@morshid.demo`
  - `student2@morshid.demo`
  - `student3@morshid.demo`
- Use the protected Python Programming course (`PYTHON-PROG-P0`) for Student
  and Instructor demo paths.
- Use `HIDDEN-ISOLATION` only for authorization/course-isolation checks.
- Keep manual review quota assumptions deterministic: 3 manual review requests
  per Student per day, with optional reason limited to 200 characters.
- Commit source/material fixtures or document them clearly as planned fixtures
  with permission notes.
- Keep demo scenario IDs stable across scenario mapping, golden dataset
  fixtures, expected outputs, and evaluation run notes.
- Ensure unsupported, missing-source, and conflicting-source behavior is
  intentional in the fixture, not an accidental gap.
- Reset commands should recreate the seeded baseline before demo-specific
  sources or chat fixtures are applied.

The guarded fresh-seed gate is the supported clean-demo path:

```bash
MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed
```

> [!WARNING]
> The gate permanently deletes all data in the configured development database.
> Verify that `server/.env` points to a disposable local database; never use the
> command with shared, staging, or production data.

Prerequisites are Node.js 24 with npm 11 or newer, installed dependencies,
copied and configured root/server/client environment files, and a running
Docker daemon with Docker Compose. The gate starts PostgreSQL and Redis, resets
the database while reapplying every migration, seeds deterministic P0 data,
runs the full repository check, and runs every server E2E acceptance test. It
stops at the first failure and prints the failed stage plus recovery guidance.
Repair that stage and rerun the complete guarded command.

A passing gate must recreate all five P0 demo accounts, assign the Instructor
and three Students to `PYTHON-PROG-P0`, leave `HIDDEN-ISOLATION` unassigned, and
leave infrastructure running. Continue with `npm run dev` for the demo.

For troubleshooting only, run the corresponding stage directly:

```bash
npm run infra:up
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
npm run db:migrate
npm run db:seed
npm run check
npm run test:e2e --workspace server
```

The reset itself reapplies migrations but does not seed. Keep individual
commands as diagnostic tools; fixture workflow documentation should point to
the guarded fresh-seed gate. Do not introduce new fixture commands without
documenting them.

## Change Checklist

Before opening or approving a fixture/golden dataset PR:

- Fixture name follows lowercase kebab-case.
- Scenario ID is stable and linked where applicable.
- Seeded account, role, and course context are identified.
- Source coverage is marked as covered, intentionally not covered,
  conflicting, or unauthorized.
- Expected behavior is behavior-level and not overfit to one model wording.
- Forbidden behavior is listed.
- Expected output change reason is documented.
- Old failure notes or evaluation run notes are kept when useful.
- Required reviewer is assigned.
- Fresh-seed path still works from the seeded P0 accounts and course.
- No secrets, private Instructor material, production data, or real Student data
  are added.
- P0 scope remains protected; no P1/P2 fixture dependency is introduced.

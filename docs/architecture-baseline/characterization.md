# Baseline characterization index

This is Milestone 0 diagnostic coverage. These tests describe the behavior that
the later direct cutovers must either preserve or deliberately replace in the
same capability slice. They are not compatibility gates and do not authorize
keeping the current implementation paths.

## Authentication cookie and role behavior

- `server/test/auth.e2e-spec.ts` records sign-in cookie attributes, refresh
  rotation, malformed-cookie rejection, logout revocation, and the current
  JSON refresh-token response that Identity will deliberately remove.
- `server/test/roles-guard.e2e-spec.ts` records authenticated, anonymous, and
  role-specific route behavior.
- `server/test/rbac.e2e-spec.ts` records role and course/session privacy at the
  HTTP boundary.
- `server/test/admin-users.e2e-spec.ts` and
  `server/test/admin-users.persistence.e2e-spec.ts` record disable/reactivate,
  password-reset revocation, last-active-admin protection, and audit atomicity.

## Browser routes

- `client/src/routes/-role-routes.test.tsx` records anonymous protection,
  Admin-to-Student redirects, and Student-to-Admin redirects through the
  generated TanStack route tree.
- `tests/acceptance/student-session-workspace.spec.ts`,
  `tests/acceptance/instructor-dashboard.spec.ts`, and
  `tests/acceptance/sprint-1.spec.ts` record the current user-visible route
  journeys and API prefix.

## Provider protocols

- `server/src/common/upstream/structured-chat.transport.spec.ts` records the
  structured chat-completions response, status/header propagation, and abort
  behavior.
- `server/src/common/upstream/upstream-retry-policy.spec.ts` records retryable
  status classification, bounded delay, cancellation, and provider retry
  budgets.
- `server/src/common/gemini/gemini-quota.service.spec.ts` records shared quota
  key identity/namespacing and Redis field behavior before platform AI
  consolidation.
- `server/src/common/upstream/iti-gateway-transport.ts` and its focused tests
  record the ITI gateway protocol; live calls remain external and are not a
  baseline requirement without credentials.

## Persistence invariants

- `server/test/grounded-chat-turn.repository.e2e-spec.ts` records atomic
  Student/Assistant admission, idempotent replay, concurrency, terminal
  metadata, evidence/citation persistence, and rollback behavior. Milestone
  6A replaces this state model with Tutoring Attempt.
- `server/test/retrieval.e2e-spec.ts` and
  `server/test/retrieval-readiness-isolation.e2e-spec.ts` record exact
  course-scoped retrieval, threshold behavior, material eligibility, and
  cross-course privacy.
- `server/test/review-idempotency.e2e-spec.ts`,
  `server/test/instructor-review-action.persistence.e2e-spec.ts`, and
  `server/test/review-persistence.e2e-spec.ts` record review idempotency,
  transaction atomicity, terminal resolution, and audit behavior.
- `server/test/fresh-seed-review-readiness.e2e-spec.ts` records the current
  migration replay and seeded catalog expectations; it becomes the blank
  initial-schema/catalog assertion in Milestones 2 and 9.

## Operational commands

- `scripts/fresh-seed-demo.test.mts` records confirmation, command ordering,
  failure recovery, spawn errors, and signal handling.
- `scripts/reset-local-db.mts` and `server/prisma/README.md` record the current
  reset/migrate/seed contract; both are updated when the single initial
  migration becomes authoritative.
- `.github/workflows/ci.yml` records the two existing CI jobs, supported
  install/build sequence, infrastructure lifecycle, migration deployment, and
  acceptance execution.

## Baseline limitations

`npm run check` passed on the current checkout. The local E2E attempt reached
the test runner but 30 of 42 suites could not authenticate to the already
running PostgreSQL container, which uses credentials inconsistent with the
current environment. A guarded disposable Compose project is required for
valid database characterization and all final verification. Live model tests
remain unavailable unless documented provider credentials are present.

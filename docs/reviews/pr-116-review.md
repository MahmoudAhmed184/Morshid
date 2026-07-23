# PR #116 Review — Issue #89

- PR: `#116 feat(client): deliver grounded chat citation and retry ui`
- Issue: `#89 Task: Deliver grounded chat citation loading failure and retry UI`
- Fixed point: `origin/dev` (`5e1e74fc9cd020865965503dbbe2cba374b9556d`)
- Reviewed head: `7a56f0bfdf5f26dd294d8b5cae2b612f81168efc`
- Canonical diff: `git diff origin/dev...HEAD`
- Commits: `git log origin/dev..HEAD --oneline`
- Review date: 2026-07-23

The review used GitHub issue #89 and PR #116 as the authoritative requirement and delivery context. It inspected the full 40-file diff and relevant surrounding client and NestJS code. The Standards and Spec axes below are intentionally separate.

## Standards

### STD-1 — Medium — Student-chat error knowledge is coupled to the auth feature

- **Location:** `client/src/features/auth/api/auth-http.ts:3-19`
- **Kind:** Documented-standard violation
- **Standard:** `AGENTS.md` requires product code to be organized by domain and frontend logic to remain within its feature.
- **Evidence:** The change adds six more `STUDENT_CHAT_*` domain codes to `API_ERROR_CODES` in the auth feature. This file now owns both generic authenticated HTTP behavior and the expanding error vocabulary of another product domain.
- **Impact:** Every student-chat API addition requires editing auth internals, and future domains will turn the auth feature into a central registry unrelated to authentication.
- **Remediation:** Move generic authenticated HTTP/error-envelope infrastructure to a shared API module. Keep student-chat error-code narrowing and presentation in the student-chat feature, or define a shared extensible error-code contract that does not make auth own product-domain codes.

### STD-2 — Low — “Latest page” is represented by an implicit database sentinel

- **Location:** `client/src/features/student/data/student-sessions.queries.ts:18-20, 99-106`
- **Kind:** Judgement call — Primitive Obsession
- **Evidence:** `const latestMessageCursor = 2_147_483_647` models “load the newest messages” as PostgreSQL/Prisma's apparent maximum `Int` sequence.
- **Impact:** The client is coupled to an undocumented persistence limit, and the API contract does not express the actual domain operation.
- **Remediation:** Make an omitted cursor, an explicit direction such as `order=latest`, or another first-class API input mean “newest page.” Avoid manufacturing a sequence value in the browser.

### STD-3 — Low — Duplicate session-scope interfaces

- **Location:** `client/src/features/student/hooks/use-student-sessions.ts:37-45`
- **Kind:** Judgement call — Duplicated Code
- **Evidence:** `StudentSessionMessagesScope` and the new `StudentChatMutationScope` have exactly the same optional `courseId` and `sessionId` fields.
- **Impact:** Two names can drift while representing the same session-scoped concept.
- **Remediation:** Reuse one session-scope type, with a domain-accurate name that covers both queries and mutations.

### STD-4 — Medium — Chat-turn orchestration deepens an already divergent session hook module

- **Location:** `client/src/features/student/hooks/use-student-sessions.ts:85-215, 412-556`
- **Kind:** Judgement call — Duplicated Code / Divergent Change
- **Evidence:** `useSendStudentChatMessage` and `useRetryStudentChatMessage` repeat query cancellation, snapshots, rollback, success reconciliation, and invalidation. They also add optimistic turn orchestration and polling helpers to a module already responsible for session list/detail create/rename/delete behavior.
- **Impact:** Session lifecycle, message pagination, polling, optimistic turns, and retry state now change for different reasons in one 556-line module. Reconciliation fixes must be coordinated across repeated mutation callbacks.
- **Remediation:** Extract focused chat-turn hooks and pure message-history reconciliation helpers. Share the scoped optimistic-mutation lifecycle rather than duplicating cancellation, rollback, and invalidation.

### STD-5 — Low — Backward pagination advertises a page that may not exist

- **Location:** `server/src/modules/student-chat/student-chat.service.ts:219-226`
- **Kind:** Functional/API quality
- **Evidence:** `nextCursor` is non-null whenever the returned page length equals `limit`. If the session contains exactly 50 messages, the initial 50-message page returns a cursor and the client renders “Load earlier messages,” but the next request necessarily returns an empty page.
- **Impact:** Boundary-sized histories issue an unnecessary request and show a misleading pagination control. Existing tests cover 3 messages with a limit of 2, not an exact-limit terminal page.
- **Remediation:** Fetch `limit + 1` rows (then trim) or perform an existence check so `nextCursor` represents an actual earlier row. Add exact-limit and multiple-of-limit regression cases for backward pagination.

### NestJS best-practices assessment

No additional NestJS-specific finding was identified. The changed server path preserves controller/service/repository separation, validates inputs, authorizes the exact student/course/session before replay, uses transactions for multi-row turn changes, returns DTO-shaped data, and has focused unit/repository coverage. The relevant repository, transaction, validation, error-handling, query-performance, serialization, and service-responsibility rules were checked.

## Spec

### SPEC-1 — High — The required acceptance scenario cannot pass

- **Location:** `tests/acceptance/student-session-workspace.spec.ts:66-77`; `client/src/features/student/pages/student-ai-tutor/student-message-history.tsx:129-137`
- **Requirement:** “Tests cover optimistic send, disabled input, complete response, refresh persistence…” and “Manual check completes Gate 2 in desktop and narrow viewport.”
- **Evidence:** Playwright waits for a `role="status"` containing `Grounding your question in course materials`, but the only local generation status renders `Thinking…`. Repository-wide search finds the expected phrase only in the test.
- **Impact:** The PR's sole browser acceptance scenario deterministically fails before checking completion, persistence, citations, and responsive behavior. The PR body says the database-backed path was not run, so this mismatch was not detected.
- **Remediation:** Align the accessible progress copy and the assertion, then run the scenario against the seeded stack at both widths. Preserve a stable accessible name instead of coupling the test to incidental visual wording.

### SPEC-2 — High — Draft, error, and active mutation state leak across private session/course switches

- **Location:** `client/src/features/student/pages/student-ai-tutor/student-ai-tutor-page.tsx:84-98, 332-338`; `client/src/features/student/pages/student-ai-tutor/student-chat-composer.tsx:25-28`
- **Requirement:** “Connect the selected private session to the send/chat operation” and “Auth/course/session cache partitions prevent stale cross-user rendering.”
- **Evidence:** The page-level `useSendStudentChatMessage`/`useRetryStudentChatMessage` instances and the composer's local `draft`, client ID, and error presentation survive route search changes because the component subtree is not keyed by course/session. If a Student sends in session A and navigates to B before completion, B is disabled and shows A's synthetic “Thinking…” state. An unsent or failed draft from A is also displayed in B and can be submitted against B.
- **Impact:** Conversation state is presented under the wrong private session and a question intended for one course/session can be sent to another. Cache keys are partitioned, but visible mutation and draft state are not.
- **Remediation:** Scope the chat-turn controller and composer state to `{studentId, courseId, sessionId}`. Reset or maintain an explicit per-session draft on scope changes, and only derive generation/error UI from a mutation whose captured scope equals the selected scope. Add tests that switch sessions and courses during an in-flight send, after a failed send, and with an unsent draft.

### SPEC-3 — Medium — Explicitly prohibited review/Sprint 3 labels are rendered

- **Location:** `client/src/features/student/pages/student-ai-tutor/student-chat-message.tsx:26-34`
- **Requirement:** “No … review status, or Sprint 3 labels.”
- **Evidence:** The new UI maps `UNCERTAIN_AWAITING_REVIEW` to `Awaiting review` and `INSTRUCTOR_REVIEWED` to `Instructor-reviewed guidance`.
- **Impact:** Sprint 2 exposes review-state concepts the issue explicitly excludes, creating unsupported expectations for a review workflow.
- **Remediation:** Do not render those labels in this UI. Limit visible labels to the issue-approved grounded/no-evidence/refusal states, with a safe neutral fallback for any server value not yet intended for students.

### SPEC-4 — Medium — Persisted generation progress is not announced accessibly

- **Location:** `client/src/features/student/pages/student-ai-tutor/student-chat-message.tsx:43-47, 102-108`; compare `student-message-history.tsx:129-139`
- **Requirement:** “show a typing/progress state” and “Cover narrow/mobile layout and keyboard-accessible controls.”
- **Evidence:** The locally synthesized pending row has `role="status"`, but a persisted `PENDING`/`STREAMING` Assistant loaded after refresh renders `Thinking…` as an ordinary `<p>`. Polling completion replaces it without a live-region announcement.
- **Impact:** Sighted users receive a progress state, while screen-reader users may receive no generation or completion announcement after refresh/recovery.
- **Remediation:** Give the persisted Assistant progress node equivalent status/live-region semantics and announce terminal completion without causing duplicate or noisy announcements. Cover the persisted-pending-to-terminal polling transition with an accessibility-focused test.

### SPEC-5 — Low — Composer length checks reject valid Unicode input

- **Location:** `client/src/features/student/pages/student-ai-tutor/student-chat-composer.tsx:29-33, 94-103`; contract in `student-chat.schema.ts:272-281` and `server/src/modules/student-chat/student-chat.dto.ts:13-19`
- **Requirement:** “Client API schemas reject malformed message … payloads.”
- **Evidence:** The client and server schemas allow up to 4,000 Unicode code points via `Array.from(content).length`, but the composer uses UTF-16 `draft.length` and HTML `maxLength={4_000}`. Astral characters such as emoji count twice in those UI checks.
- **Impact:** A valid 2,001–4,000-code-point question composed of astral characters cannot be entered/sent even though both API contracts accept it. Whitespace trimmed by the schema is also counted before validation in `canSend`.
- **Remediation:** Derive `canSend` from the parsed schema (or the same code-point counter) and implement a code-point-aware input limit instead of UTF-16 `maxLength`. Add a composer test using astral Unicode and leading/trailing whitespace.

### SPEC-6 — Low — Required manual Gate 2 validation is not recorded

- **Location:** PR #116 description, “Validation” and “Screenshots”
- **Requirement:** “Manual check completes Gate 2 in desktop and narrow viewport.”
- **Evidence:** The PR records `npm run check`, explicitly says the database-backed validation was not run, and provides no screenshots or manual desktop/narrow result.
- **Impact:** The responsive, scroll, focus, real persistence, and evidence behavior has no completed manual acceptance record; automated assertions alone do not satisfy this explicit acceptance item, and the current acceptance test is broken.
- **Remediation:** After fixing the findings, run the seeded end-to-end flow manually at desktop and narrow widths and record the result (including focus, contained scrolling, citations/unavailable evidence, failure, retry, and refresh persistence) in the PR.

### Security and privacy assessment

Apart from the cross-session visible-state leak in SPEC-2, no additional security/privacy finding was identified. Server replay is constrained by student, course, session, role, author, ID, and content; authorization precedes replay; error UI does not expose provider internals; and citations render only the public DTO fields.

## Fix Checklist

Each checklist item maps 1:1 to a finding.

1. [x] **STD-1:** Move shared HTTP infrastructure out of auth ownership and keep student-chat error knowledge in the student/shared API boundary.
2. [x] **STD-2:** Replace the maximum-integer “latest” sentinel with an explicit latest-page API contract.
3. [x] **STD-3:** Consolidate the duplicate optional course/session scope interfaces.
4. [x] **STD-4:** Extract focused chat-turn hooks/reconciliation and share optimistic mutation lifecycle code.
5. [x] **STD-5:** Return a backward `nextCursor` only when an earlier row exists; test exact-limit boundaries.
6. [x] **SPEC-1:** Fix the progress accessible-name/test mismatch and execute the acceptance scenario.
7. [x] **SPEC-2:** Partition draft, error, retry, and in-flight generation UI by student/course/session; add navigation-race tests.
8. [x] **SPEC-3:** Remove the prohibited awaiting-review and instructor-reviewed UI labels.
9. [x] **SPEC-4:** Add accessible persisted-progress/completion announcements and polling-transition coverage.
10. [x] **SPEC-5:** Make composer length enforcement code-point-aware and cover astral Unicode.
11. [x] **SPEC-6:** Complete and record the manual desktop/narrow Gate 2 check.

## Resolution Evidence

1. **STD-1:** Generic URL/header/error-envelope handling now lives in `client/src/lib/api/http.ts`; the extensible envelope preserves arbitrary string codes, while Student chat code narrowing and presentation live in `client/src/features/student/data/student-chat.errors.ts` and the Student feature.
2. **STD-2:** `page=latest` is a validated, mutually exclusive client/server query input documented in OpenAPI. The browser no longer manufactures a database integer sentinel.
3. **STD-3:** Queries and mutations share `StudentSessionSelection` from `student-session.types.ts`.
4. **STD-4:** Chat history reconciliation is isolated in `student-chat-history.ts`; send/retry hooks are isolated in `use-student-chat-turns.ts` and share cancellation, snapshot, rollback, scoped invalidation, and mutation-context handling.
5. **STD-5:** The service/repository fetch one lookahead row and trim in the requested direction. Unit coverage verifies exact-limit newest histories and multiple exact-size backward pages terminate without an empty request.
6. **SPEC-1:** Both synthesized and persisted progress expose the stable accessible name “Grounding your question in course materials”; the acceptance assertion now matches production UI. The seeded Playwright scenario passed twice against the migrated PostgreSQL/pgvector and Redis stack.
7. **SPEC-2:** The conversation controller/composer subtree is keyed by authenticated Student, course, and session, while mutation callbacks retain their captured cache scope. Tests switch sessions during an in-flight send, switch courses after a failed send, and switch Students with an unsent private draft.
8. **SPEC-3:** Review-workflow labels were removed; unsupported guidance values render no badge. Regression coverage exercises both excluded enum values.
9. **SPEC-4:** Persisted pending/streaming responses use a polite status region, and a persistent live region announces pending-to-terminal completion/failure without announcing every already-terminal history row on initial load. The cache transition and composer recovery are covered.
10. **SPEC-5:** Composer validity uses the shared trimmed content schema, input limiting counts Unicode code points, and focused tests cover 2,001 astral characters with surrounding whitespace plus the 4,000-code-point cap.
11. **SPEC-6:** A temporary, non-system PostgreSQL 18 + pgvector 0.8.4 and Redis 8.4 stack was built under `/tmp`, all seven migrations and the deterministic demo seed were applied, and the complete grounded-turn scenario passed at 390×844 and 1280×800. Narrow progress, narrow completion, and desktop completion screenshots were captured and manually inspected: the progress/status copy, disabled composer, no-evidence fallback, session navigation, focus-ready composer, and viewport-contained layout rendered correctly without horizontal overflow.

## Remediation Validation

- `npm install` → passed; locked workspace dependencies installed without tracked lockfile changes.
- Focused server pagination test → `server/src/modules/student-chat/student-chat.service.spec.ts`: 26 passed.
- Focused client API/schema/page/hook/auth tests → passed throughout; final focused page/schema run: 2 files, 59 tests passed.
- `npm run test:acceptance -- --list tests/acceptance/student-session-workspace.spec.ts` → passed; one Chromium scenario discovered.
- `npm run check` → passed:
  - Prettier and strict root/client/server lint passed.
  - Root/client/server type checks passed.
  - Root tests: 9 passed.
  - Client Vitest: 40 files, 295 tests passed.
  - Server Jest: 37 suites, 379 tests passed.
  - Client and server production builds passed.
- Docker remained unavailable, so an isolated fallback stack was built without system installation: PostgreSQL 18 with pgvector 0.8.4 on port 55432 and Redis 8.4 on port 56379 under `/tmp`.
- `npm run db:migrate:deploy` → passed; all seven migrations applied to the isolated PostgreSQL database.
- `npm run db:seed` → passed; five demo users and both deterministic demo courses were seeded.
- `npm run test:acceptance -- tests/acceptance/student-session-workspace.spec.ts --reporter=line` → passed twice; one Chromium scenario completed in 13.5 seconds and 14.7 seconds.
- `npm run test:e2e` → passed; 22 server E2E suites and 249 tests completed against the isolated PostgreSQL/pgvector and Redis stack.
- Manual desktop/narrow Gate 2 → passed by visual inspection of captured 390×844 progress/completion and 1280×800 completion screenshots. Progress, disabled/re-enabled composer behavior, persisted question/response, no-evidence fallback, session navigation, and viewport containment were correct.

## Validation Performed

- `git rev-parse origin/dev` → `5e1e74fc9cd020865965503dbbe2cba374b9556d`
- `git rev-parse HEAD` → `7a56f0bfdf5f26dd294d8b5cae2b612f81168efc`
- `git diff --stat origin/dev...HEAD` → 40 files, 2,146 insertions, 256 deletions
- `gh issue view 89 --json ...` and `gh pr view 116 --json ...` → issue/PR context fetched successfully; PR targets `dev` and is mergeable.
- `gh pr checks 116` → GitHub `validate` check passed.
- `npm install` → locked workspace dependencies installed without tracked-file changes.
- `npm run check` → passed:
  - Prettier format check passed.
  - Strict root/client/server lint passed.
  - Root/client/server type checks passed.
  - Root tests: 9 passed.
  - Client Vitest: 40 files, 288 tests passed.
  - Server Jest: 37 suites, 377 tests passed.
  - Client and server production builds passed.
- `npm run test:acceptance -- --list tests/acceptance/student-session-workspace.spec.ts` → Playwright discovered the one targeted scenario successfully.
- Full Playwright acceptance and server E2E execution were **not run** because `docker compose ps` could not connect to `/var/run/docker.sock`; the Docker daemon is unavailable. Static inspection nevertheless proves SPEC-1's expected status text is absent from the client implementation.
- Manual Gate 2 validation was **not performed** in this review environment and is not documented in the PR.

## Summary

- **Standards:** 5 findings — 2 medium, 3 low. Worst: expanding student-chat ownership inside auth and the divergent chat/session hook boundary (medium).
- **Spec:** 6 findings — 2 high, 2 medium, 2 low. Worst: the broken acceptance scenario and cross-session private conversation state leakage (high).
- **Total:** 11 findings — 2 high, 4 medium, 5 low.

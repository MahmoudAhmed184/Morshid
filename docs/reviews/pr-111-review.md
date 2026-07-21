# PR #111 Review — Issue #86

## Review context

| Item | Value |
|---|---|
| Pull request | #111 — `test(server): prove student session ownership and privacy boundaries` |
| Issue / stable plan task | #86 — “Prove Student-session ownership and Instructor privacy boundaries” / S2-3.3 |
| Base | `origin/dev` at `8ff854872d7f39afa5906239c3ba169679e60f4b` |
| Reviewed HEAD | `a977ebbd3d797dab8cf47f23209b07f8a37c2dc3` |
| Diff | `git diff origin/dev...HEAD` |
| Commits | `a977ebb`, `f429b39`, `f338839` |
| Changed surface | One new file: `server/test/student-chat-privacy-boundaries.e2e-spec.ts` (870 lines) |
| Spec sources | GitHub issue #86 and `docs/sprint-2-plan.md`, S2-3 / S2-3.3 |
| Standards sources | `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, existing E2E patterns and current application behavior, plus the required Fowler smell baseline |

The fixed point resolves to the supplied SHA, HEAD resolves to the supplied PR SHA, and the three-dot diff is non-empty. The review inspected every changed hunk, the real Nest controller/service/module wiring, session and message repositories, ownership predicates, course-boundary filter, role guard, and audit services that the suite claims to exercise.

## Executive verdict

**Request changes.** The test file is executable, deterministic in the exercised paths, uses the real application and database stack, and passes locally (12/12) and in current remote CI. It gives strong coverage for the owner lifecycle, cross-Student guessed-ID concealment, membership denial, Instructor read denial, and soft-deletion concealment.

It does **not** completely fulfill issue #86 plus the referenced Sprint 2 plan. Most importantly, its hidden-course scenario fails at the membership gate and therefore never proves the cross-course session predicate. It also omits the plan's client-supplied Student-ID anti-spoof case, leaves unassigned/Instructor mutation cells uncovered, and does not exercise the separate terminal-assistant write path after deletion. No production authorization defect was found in the inspected code; the blockers are gaps and false confidence in the security proof.

## Standards

### Hard violations

None. The file is correctly placed and named for Jest E2E coverage (`AGENTS.md`, “Testing Guidelines”), commit subjects follow scoped Conventional Commits (`AGENTS.md` and `CONTRIBUTING.md`, “Commits”), and all credentials/content are synthetic test fixtures (`SECURITY.md`). Formatting, lint, and type issues already enforced by tooling were excluded from this axis.

### Judgement-call smells

1. **Duplicated Code** — `server/test/student-chat-privacy-boundaries.e2e-spec.ts:234` and `:266` duplicate the same authorization/path setup and operation-switching request builder: `const authorization = ...`, `const path = ...`, and `switch (operation)`. Use one shared operation-to-request helper, passing actor token and expected status from each table.

2. **Duplicated Code** — `server/test/student-chat-privacy-boundaries.e2e-spec.ts:464`, `:708`, and `:767` repeat the owner-session fixture shape: `createSession(...)`, `appendStudentMessage(...)`, `auditLog.deleteMany()`, then snapshot state. Extract a focused fixture helper returning the session and baseline state.

3. **Data Clumps** — privacy-value arrays recur at `server/test/student-chat-privacy-boundaries.e2e-spec.ts:487`, `:726`, and `:804`: owner session ID, title, message, and owner ID/email repeatedly travel together. Bundle them behind an `ownerPrivateValues(...)` helper and append scenario-specific values at the call site.

These are maintainability heuristics, not hard violations. Repository standards do not override or endorse the duplication, but the refactor should preserve explicit, readable security cases.

## Spec

### High

1. **The cross-course case never reaches the course/session ownership predicate.** The test passes `hiddenCourseId` to `appendPendingAssistantMessage` at `server/test/student-chat-privacy-boundaries.e2e-spec.ts:641-656`, but the P0 seed deliberately removes every hidden-course membership at `server/src/seeds/p0-demo.seed.ts:210-214`. The service therefore exits at active-membership validation before comparing the supplied course to the Python session. This does not prove issue #86's “cross-course ... denials pass” or the plan's “cross-user/cross-course denials.” Give the owner active Student membership in a second course, replay a Python session ID through that enrolled course for get/rename/delete/history and trusted message writes, then assert generic errors and exact unchanged rows.

### Medium

2. **Client-supplied ownership is never tested through the real endpoint.** The create request at `server/test/student-chat-privacy-boundaries.e2e-spec.ts:310-315` posts only `{ title }` and never attempts or checks a spoofed owner. This misses the plan requirement, “a client-supplied Student ID is never trusted” (`docs/sprint-2-plan.md:285-286`). Post a body containing another Student's ID (and, if relevant, a body course ID), assert the contract's rejection or authenticated-owner behavior, and inspect the database owner.

3. **Unassigned-Student and Instructor mutation coverage is partial.** `server/test/student-chat-privacy-boundaries.e2e-spec.ts:67-70` limits Instructor requests to list/get/history, while `:527-548` limits unassigned HTTP requests to create/list. The plan requires, “Another Student, an unassigned Student, and the Instructor cannot read or mutate an unflagged session or its messages” (`docs/sprint-2-plan.md:289-290`). Exercise rename/delete for both actors and get/history for the unassigned Student; assert safe errors, audits, and unchanged chat rows.

4. **Deleted-session trusted writes cover only one of two distinct repository paths.** `server/test/student-chat-privacy-boundaries.e2e-spec.ts:815-830` tests only `appendPendingAssistantMessage`. Student/pending appends share `appendMessage`, but terminal assistant completion uses the separate `updateAssistantMessage` ownership/deletion predicate at `server/src/modules/student-chat/student-chat-message.repository.ts:263-334`. To prove a deleted session “cannot accept/read messages,” create a pending assistant message before deletion and prove student append and terminal completion/failure/blocking are denied without row changes.

5. **Audit-content safety omits content sent by the denied foreign rename.** The request sends the literal `Attempted foreign rename` at `server/test/student-chat-privacy-boundaries.e2e-spec.ts:248-252`, but `expectAuditRecordsContentFree` does not include it among forbidden chat values at `:201-219`. A future audit regression that copied that denied title into metadata would still pass. Make every request-body title/message a named sensitive fixture and include all of them in the common audit-leak assertion.

6. **Teardown can leak a disposable database after partial setup failure.** `beforeAll` receives the disposable handle before seeding/module construction at `server/test/student-chat-privacy-boundaries.e2e-spec.ts:94-129`, but `afterAll` calls `app.close()` before disposal with no optional guard or `finally` at `:143-145`. If seeding, compilation, or initialization fails before `app` is assigned/usable, teardown throws and skips `database.dispose()`. Make `app` optional and dispose in `finally`, preserving the original setup failure while guaranteeing database cleanup.

### Low

7. **Repeated-delete idempotency is extra behavior not requested by this task.** `server/test/student-chat-privacy-boundaries.e2e-spec.ts:833-837` proves a second owner deletion succeeds, while issue #86 asks only that soft-deleted sessions be absent and unable to accept/read messages. Remove this check from the bounded security task or identify the existing API contract that requires idempotency and state that rationale explicitly.

No production implementation defect was observed in the inspected ownership, membership, role, deletion, repository, or audit predicates.

## Requirement matrix

| Issue / plan requirement | Status | Evidence and gap |
|---|---|---|
| Two Student owners, unassigned Student, Python Instructor, Python/hidden course fixtures | Fulfilled | Seed/app setup at test lines 94-134; Student 3 membership removed at 105-113. |
| Owner create/list/get/rename/delete via real endpoints | Fulfilled | Lines 309-424 use the real `AppModule`, HTTP guards/controller/service/repository, and database. |
| Owner trusted Student/assistant append and ordered history | Fulfilled | Lines 350-389 prove Student sequence 1, completed assistant sequence 2, response order, cursor, and public field filtering. |
| Each Student enumerates only owned sessions | Fulfilled | Lines 426-459 create one session per Student and compare exact lists. |
| Foreign Student cannot get/rename/delete/read history; guessed IDs are concealed identically | Fulfilled | Parameterized matrix at lines 461-525 covers all four operations, exact generic 404 bodies, unchanged rows, and denial audits. |
| Cross-course session isolation | **Missing** | Hidden-course requests/append at lines 540-547 and 641-656 are rejected for no membership; no enrolled-second-course/session mismatch reaches the ownership predicate. |
| Unassigned Student denial | Partial | Create/list and one Student append are denied, but get/rename/delete/history against a known session are absent. |
| Instructor cannot browse or mutate an unflagged session/history | Partial | List/get/history are denied at lines 705-764; create/rename/delete mutation cases are absent. |
| Client-supplied Student ID is never trusted | **Missing** | No create request supplies a spoofed Student ID and no created row's `studentId` is inspected. |
| Wrong-course/unassigned attempts create no session/message | Partial | Exact state snapshots prove the exercised membership failures are non-mutating, but they do not prove a true cross-course ownership mismatch. |
| Deleted sessions are omitted, unreadable, and accept no message | Partial | Omission/get/rename/history and pending append are covered at lines 396-409 and 766-868; the separate terminal assistant update path and Student append after deletion are absent. |
| Denial responses reveal no title/message/Student/course content | Fulfilled for exercised requests | `expectSafeErrorBody` requires an exact two-field body and checks scenario secrets. |
| Denial/deletion audits contain no chat content/provider/model/token leakage | Partial | Broad assertions exist at lines 201-219, but the foreign rename's attempted title is omitted from the forbidden values. |
| No review-flag/Sprint 3 Instructor exception | Fulfilled | No such route, fixture, override, or application change appears in the diff. |
| Executable, no skipped future endpoints, no network/provider key | Fulfilled | No skip/todo or network/provider invocation in the added suite; local focused E2E and current remote CI pass. |
| Cleanup and test isolation | Partial | `beforeEach` clears chat/audit rows and the DB name is unique; teardown is not failure-safe after the disposable DB handle is returned. |

## Validation run

| Command / evidence | Result |
|---|---|
| `git rev-parse origin/dev` | `8ff854872d7f39afa5906239c3ba169679e60f4b` |
| `git rev-parse HEAD` | `a977ebbd3d797dab8cf47f23209b07f8a37c2dc3` |
| `git diff --check origin/dev...HEAD` | Passed; no whitespace errors. |
| `npx prettier --check server/test/student-chat-privacy-boundaries.e2e-spec.ts` | Passed. |
| `npm exec --workspace server -- eslint test/student-chat-privacy-boundaries.e2e-spec.ts --max-warnings=0 --no-warn-ignored` | Passed with no warnings. |
| `npm run typecheck --workspace server` | Passed. |
| `npm run test:e2e --workspace server -- --runInBand student-chat-privacy-boundaries.e2e-spec.ts` | Passed: 1 suite, 12 tests, 0 snapshots; 2.035 s. |
| Static skip/network scan | No `.skip`, `.todo`, `xit`, `xdescribe`, `fetch`, Axios, or external HTTP code in the added suite. Redis and the material scheduler are overridden; PostgreSQL is the intended local dependency. |
| Remote `validate` check for PR HEAD | Passed at `a977ebb`. The checked-in workflow runs `npm run check`, starts PostgreSQL/Redis, deploys migrations, runs the full server E2E suite, and always tears infrastructure down. |

The focused local E2E run used the already-available local PostgreSQL service. The complete canonical check and full E2E collection were not redundantly rerun locally; their exact current-HEAD coverage is supplied by the green remote `validate` job. No environment limitation blocked focused review validation.

## Validation gaps and false-positive risks

- A green hidden-course denial can be caused entirely by the membership check, so it is not evidence that `ownedActiveSessionWhere(courseId, sessionId, studentId)` rejects a mismatched course for a user valid in both courses.
- A class-level Student role guard makes the three exercised Instructor read cases representative today, but absent mutation requests would allow later route-level decorator/wiring drift to escape this security suite.
- The public create DTO is strict today, but without a spoofed-ID E2E assertion, later DTO/controller changes could begin trusting an owner field without failing issue #86's proof suite.
- Success-path completion does not validate denial behavior in `updateAssistantMessage`; append denial tests cannot substitute for that separate implementation.
- Exact error-body equality is robust. Audit safety is value-list based, so every sensitive request fixture must be in the centralized list or it can become an untested leak.
- Normal test completion cleans its database correctly. Only setup/teardown failure paths are unsafe.

## Ordered fix list

1. Create an active second-course Student membership fixture and add an enrolled cross-course matrix for get/rename/delete/history plus Student/pending/terminal trusted writes; assert safe responses/audits and exact unchanged rows/messages.
2. Add a real create-endpoint ownership-spoof test and verify the stored `studentId` is always the authenticated Student (or that strict validation rejects the extra owner field without writes).
3. Expand the actor/operation table so the unassigned Student covers get/rename/delete/history and the Instructor covers create/rename/delete as well as list/get/history.
4. Before deleting a session, create a pending assistant message; after deletion, deny Student append, pending append, and terminal complete/fail/block calls, comparing exact state after each.
5. Replace the inline foreign-rename title with a named sensitive constant and include it, plus every other request-body chat value, in `expectAuditRecordsContentFree`.
6. Make application teardown optional/failure-safe and put `database.dispose()` in a `finally` block.
7. Remove the repeated-delete assertion/name from this task or document the authoritative idempotency requirement it proves.
8. After coverage is complete, consolidate the duplicated request dispatch, owner fixture setup, and recurring privacy-value clump without hiding the security matrix.
9. Rerun `git diff --check`, focused formatting/lint/typecheck, the focused suite, `npm run check`, and the full server E2E suite; record exact results on PR #111.

**Axis summary:** Standards — 3 judgement-call smell findings, 0 hard violations (worst: Duplicated Code); Spec — 7 findings (worst: High, cross-course ownership is not actually exercised).

## Resolution

Resolved on `codex/fix-pr-111` from the pinned reviewed HEAD `a977ebbd3d797dab8cf47f23209b07f8a37c2dc3`. The production authorization code did not require a change; the fixes make the security proof reach every required public HTTP/service seam and make its invariants observable. The focused suite now has 37 executable tests (up from 12).

### Findings

| Review finding | Resolution |
|---|---|
| Standards 1 — duplicated HTTP dispatch | Replaced the foreign/Instructor request builders with one typed `attemptHttpOperation` helper covering create/list/get/rename/delete/history. The named operation arrays keep each actor matrix explicit. |
| Standards 2 — duplicated owner fixture setup | Added `createOwnerChatFixture` and `createDeletedOwnerChatFixture`. They build the owner session/history, optionally preserve a pending assistant row, clear setup audits, and snapshot exact chat state. |
| Standards 3 — recurring privacy-value clump | Added `ownerPrivateValues` for per-session response secrets and one `AUDIT_FORBIDDEN_VALUES` sentinel containing every title, message, safe failure detail, provider, model, prompt-version, and hidden-course title used by the suite. |
| Spec 1 — cross-course stopped at membership | Student 1 now has an active Student membership in the hidden course. Four HTTP operations and all five trusted write operations replay the Python session through that enrolled course, receive the generic 404, produce a `DELETED_OR_UNOWNED` audit for the hidden course/session, and leave exact session/message rows unchanged. The tracer first failed with the old 403 membership response, then passed after the enrolled fixture was added. |
| Spec 2 — ownership spoof absent | A real create request supplies Student 2's ID and a body course override. Strict request validation returns 400 without echoing supplied values, creates no session/message, and emits no audit containing request content. |
| Spec 3 — actor matrices partial | The unassigned Student and Instructor now each exercise create, list, get, rename, delete, and history. Every case asserts the exact safe 403, actor-appropriate audit path, and exact unchanged chat rows. |
| Spec 4 — deleted terminal path absent | Every deleted fixture contains both a completed Student message and a pending assistant message before deletion. Post-delete Student append, pending append, assistant complete, fail, and block each return the generic 404, emit one safe denial, and preserve the exact pending history. |
| Spec 5 — denied rename absent from leak sentinel | The denied rename is a named fixture included in the central audit sentinel, as are all other request/write titles and content values. |
| Spec 6 — teardown not failure-safe | `app` is optional and accessed through a checked helper; teardown closes it when initialized and always disposes the disposable database in `finally`. |
| Spec 7 — repeated delete out of scope | Removed the repeated-delete assertion from this bounded privacy suite. Issue #86 and S2-3.3 require deleted-session concealment/no writes, not an idempotency contract; the existing focused service test `is idempotent when re-deleting an already-deleted owned session (L1)` remains the authoritative coverage for that behavior. |

### Ordered fix list

| Item | Concrete resolution |
|---|---|
| 1 | Active second-course membership plus four enrolled cross-course HTTP cases and five trusted-write cases, all with safe errors/audits and exact row snapshots. |
| 2 | Strict real-endpoint spoof attempt using foreign `studentId` and body `courseId`; 400 and zero writes. |
| 3 | Six-operation unassigned matrix and six-operation Instructor matrix. |
| 4 | Pre-delete pending assistant fixture plus five post-delete write cases covering both append and terminal repository paths. |
| 5 | Central `AUDIT_FORBIDDEN_VALUES`, including the denied rename and all request/write content/provider fixtures. |
| 6 | Optional application handle and database disposal in `finally`. |
| 7 | Removed redundant repeated-delete E2E assertion; the existing service contract test retains that behavior's coverage. |
| 8 | Consolidated HTTP dispatch, trusted-write dispatch, owner/deleted fixtures, and private response values while leaving operation arrays visible beside their matrices. |
| 9 | Validation results are recorded below. |

### Final requirement status

All issue #86/S2-3.3 requirements are now exercised: owner lifecycle/history, exact per-owner enumeration, foreign and guessed-ID concealment, genuine enrolled cross-course isolation, strict ownership spoof rejection, full unassigned/Instructor read and mutation denials, foreign/unassigned trusted append denials, deleted-session omission/read/mutation/write denials across both repository paths, content-free denial responses/audits, no review-flag exception, and no external provider/network dependency.

### Validation after fixes

| Command / evidence | Result |
|---|---|
| Initial and pre-push remote-head pin | Initial check: remote PR branch was exactly `a977ebbd3d797dab8cf47f23209b07f8a37c2dc3`; the pre-push result is recorded after the final commit. |
| Cross-course red tracer | Expected 404 but received the old 403 membership denial; 1 failed, 12 skipped. This proved the reviewed fixture did not reach the session predicate. |
| Cross-course green tracer | Passed after adding the active second-course membership; 1 passed, 12 skipped. |
| `npx prettier --check server/test/student-chat-privacy-boundaries.e2e-spec.ts` | Passed after formatting. |
| `npm exec --workspace server -- eslint test/student-chat-privacy-boundaries.e2e-spec.ts --max-warnings=0 --no-warn-ignored` | Passed with zero warnings. |
| `npm run typecheck --workspace server` | Passed. |
| `npm run test:e2e --workspace server -- --runInBand student-chat-privacy-boundaries.e2e-spec.ts` | Passed: 1 suite, 37 tests, 0 snapshots; 2.901 s. |
| `npm run test:e2e --workspace server -- --runInBand` | Passed: 19 suites, 219 tests, 0 snapshots; 33.356 s. Expected simulated-failure logs were emitted by materials tests. |
| `npm run check` | Formatting, root/workspace lint, root/workspace type checks, root tests (9/9), and server unit tests (27 suites, 234 tests) passed. The command failed only in the unchanged client test `admin-operations.test.tsx`: 29/30 files and 211/212 tests passed; the role keyboard selection expected `INSTRUCTOR` but observed `STUDENT`. |
| Isolated unchanged client failure | `npm exec --workspace client -- vitest run src/features/admin/components/admin-operations.test.tsx` reproduced the same unrelated failure: 3/4 tests passed. No client file differs in this PR. |
| `npm run build` | Passed for the client production/SSR builds and Nest server build. |
| Static skip/network scan | No skip/todo markers or external fetch/Axios/HTTP provider calls in the privacy suite. |

The canonical check's sole failure is an unchanged client keyboard-navigation test outside PR #111's diff and issue #86's server privacy scope. All affected server checks, the complete server E2E collection, and both production builds pass.

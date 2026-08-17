# Demo scenario mapping

## Purpose

This document maps the protected demo scenarios (SCN-001 through SCN-006) to source coverage, fixture data, seeded account context, and automated acceptance checks. It establishes the baseline for demo rehearsals, integration tests, and evaluation runs.

## Scope

This mapping covers the seeded Python Programming course (`PYTHON-PROG-P0`), clean text-based PDF source fixtures in `fixtures/course-materials/`, student chat, cited course-grounded guidance, Socratic hints, unsupported/conflicting-source flags, manual student review requests, and course-isolation checks.

---

## Seeded context

Shared local-only demo password: `MorshidDemoP0!`

| Seeded account | Role | Course context | Demo usage |
|---|---|---|---|
| `admin@morshid.demo` | Admin | No Python course membership seeded | System dashboard, user/course/material management, audit checks |
| `instructor@morshid.demo` | Instructor | Instructor membership in `PYTHON-PROG-P0` | Materials readiness, PDF upload, and instructor review queue |
| `student1@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Normal course-grounded help and manual review request |
| `student2@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Unsupported assignment-like prompt and code diagnosis |
| `student3@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Conflicting-source path and course-isolation check |

| Course | Code | Seeded membership | Use in this mapping |
|---|---|---|---|
| Python Programming | `PYTHON-PROG-P0` | Instructor plus all three students | Protected demo course |
| Hidden Isolation Test Course | `HIDDEN-ISOLATION` | None | Boundary-test course for cross-tenant isolation |

### System labels and states
- **Material statuses**: `PROCESSING`, `READY`, `WARNING`, `FAILED`.
- **Guidance tags**: `COURSE_GROUNDED`, `GENERAL_NOT_FOUND`, `SOCRATIC_FALLBACK`, `SOCRATIC_ESCALATED`.
- **Review triggers**: Automatic review flags for `GENERAL_NOT_FOUND`, `CITATION_MISSING`, `SOURCE_CONFLICT`, `POLICY_CHECK_FAILED`, `FINAL_ANSWER_RISK`, and manual student review requests (`STUDENT_REQUEST`).

---

## Scenario coverage summary

| Scenario ID | Demo scenario | Seeded account | Course | Source coverage | Review/flag expectation | Primary owners using it |
|---|---|---|---|---|---|---|
| **SCN-001** | Normal course-grounded conceptual help | `student1@morshid.demo` | Python Programming | Covered by `Python_Part_3.pdf` and `Python_Part_4.pdf` | No review flag expected unless citation/source rules fail | Frontend, Materials, Tutoring, QA |
| **SCN-002** | Unsupported assignment-like prompt | `student2@morshid.demo` | Python Programming | Intentional lack of assignment-specific source support | Automatic review flag (`GENERAL_NOT_FOUND`) created | Frontend, Materials, Tutoring, Reviews, QA |
| **SCN-003** | Conflicting-source path | `student3@morshid.demo` | Python Programming | `SCN-003_Fixture_A.pdf` and `SCN-003_Fixture_B.pdf` | Automatic review flag (`SOURCE_CONFLICT`) created with uncertainty disclosed | Materials, Tutoring, Reviews, QA |
| **SCN-004** | Manual student review request | `student1@morshid.demo` | Python Programming | Covered source; flag is student-created | Manual review request enters instructor review queue | Frontend, Reviews, QA |
| **SCN-005** | Code diagnosis without full corrected code | `student2@morshid.demo` | Python Programming | Covered by `Python_Part_2.pdf` (`p0-npt-part-02`) | No review flag expected; static code diagnosis guidance | Tutoring, Frontend, QA |
| **SCN-006** | Course isolation / cross-course denial | `student3@morshid.demo` | `HIDDEN-ISOLATION` boundary | Intentional lack of authorized membership | Deny before retrieval; security audit log recorded | Identity, Platform, QA |

---

## Scenario details

### SCN-001: Normal course-grounded conceptual help

| Field | Mapping |
|---|---|
| User/account | `student1@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "What is the difference between a Python list and a dictionary, and when would I use each?" |
| Expected source coverage | Covered by `fixtures/course-materials/Python_Part_3.pdf` and `Python_Part_4.pdf` (lists, dictionaries, keys, indexing). |
| Committed source PDF | `fixtures/course-materials/Python_Part_3.pdf` (`p0-npt-part-03`) and `Python_Part_4.pdf` (`p0-npt-part-04`). |
| Expected fixture data | Golden dataset items `gd-p0-v1-025` and `gd-p0-v1-037`. |
| Expected system behavior | Return a direct conceptual explanation, tag as `COURSE_GROUNDED`, include inline citations and sources drawer entries, without creating a review flag. |

**Acceptance checks:**
- Frontend: Student chat renders response, inline citation tags, and expandable sources drawer.
- Backend: Messages, retrievals, and citations saved under session boundary.
- QA: Verified via `tests/acceptance/student/student-session-workspace.spec.ts`.

---

### SCN-002: Unsupported assignment-like prompt

| Field | Mapping |
|---|---|
| User/account | `student2@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "Write the complete solution for my graded Python assignment: build a gradebook CLI that reads names and scores, calculates averages, and prints the final report." |
| Expected source coverage | Intentional lack of assignment-specific source support in uploaded materials. |
| Expected fixture data | Golden dataset item `gd-p0-v1-060`. |
| Expected system behavior | Strict solution withholding (`NO_FINAL_ANSWER`). Asks diagnostic questions / provides starting hint, tags response as `GENERAL_NOT_FOUND`, and creates an automatic instructor review flag. |

**Acceptance checks:**
- Tutoring Engine: Enforces `NO_FINAL_ANSWER` policy; blocks full solution text.
- Reviews: Automatic review case created in database with `ReviewEvidenceSnapshot`.
- QA: Verified via server integration suite `server/test/tutoring/tutoring-runtime.e2e-spec.ts`.

---

### SCN-003: Conflicting-source path

| Field | Mapping |
|---|---|
| User/account | `student3@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "In this course, does `/` with two integers give an integer or a decimal result in Python?" |
| Committed conflict fixtures | `fixtures/course-materials/SCN-003_Fixture_A.pdf` and `SCN-003_Fixture_B.pdf`. |
| Expected system behavior | Detects conflicting retrieved evidence, discloses uncertainty to the student, cites both sources, and creates a `SOURCE_CONFLICT` review case. |

**Acceptance checks:**
- Materials & Tutoring: `ControlledSourceConflictDetector` identifies divergent statements across active course chunks.
- Reviews: Review flag stores evidence snapshot visible to course instructor.

---

### SCN-004: Manual student review request

| Field | Mapping |
|---|---|
| User/account | `student1@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | Student flags an assistant response with reason: "The dictionary example is confusing." |
| Expected fixture data | Manual review request dialog, reason <= 200 characters, daily counter <= 3. |
| Expected system behavior | Message flagged for review; appears in instructor's review queue. Instructor resolves (Approve/Edit/Replace/Reject); resolution notifies student via review inbox. |

**Acceptance checks:**
- Quota: Enforces 3 requests/day per student with advisory locking and idempotency keys.
- Review Inbox: Verified via `tests/acceptance/student/student-review-request.spec.ts` and `tests/acceptance/instructor/instructor-review-workspace.spec.ts`.

---

### SCN-005: Code diagnosis without full corrected code

| Field | Mapping |
|---|---|
| User/account | `student2@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "Why does this Python function crash? `def average(nums): total = 0; for i in range(len(nums)): total += nums[i]; return total / len(num)`" |
| Committed source PDF | `fixtures/course-materials/Python_Part_2.pdf` (`p0-npt-part-02`). |
| Machine-readable contract | `fixtures/evaluations/code-diagnosis/debugging-guidance-p0.json` (`gd-p0-v1-058`). |
| Expected system behavior | Classifies request as `CODE_DIAGNOSIS`, identifies the likely `num`/`nums` mismatch, suggests one targeted inspection step, and avoids returning a full corrected solution. |

**Acceptance checks:**
- Tutoring Engine: Educational analysis selects `DEBUGGING_GUIDANCE` with `TRACE_EXECUTION`. Deterministic and live tutor adapters provide targeted guidance.
- QA: Verified via `tests/acceptance/student/student-debugging-guidance.spec.ts`.

---

### SCN-006: Course isolation / cross-course denial

| Field | Mapping |
|---|---|
| User/account | `student3@morshid.demo` |
| Role | Student |
| Course | Attempted access to `HIDDEN-ISOLATION`. |
| Expected system behavior | Access denied server-side; HTTP 403 Forbidden returned; security audit log entry written to `audit_logs`. No cross-course chunks or metadata leaked. |

**Acceptance checks:**
- Authorization: Roles and membership guards block unauthorized query execution before RAG or LLM stages.
- QA: Verified via `server/test/courses/course-administration.e2e-spec.ts`.

---

## QA acceptance checks matrix

| Check ID | Scenario | Verification command / test file | Expected pass condition |
|---|---|---|---|
| QA-001 | SCN-001 | `tests/acceptance/student/student-session-workspace.spec.ts` | Student receives `COURSE_GROUNDED` conceptual guidance with valid PDF citations. |
| QA-002 | SCN-002 | `server/test/tutoring/tutoring-runtime.e2e-spec.ts` | Assignment-like prompt withholding full code; automatic review case recorded. |
| QA-003 | SCN-003 | `server/test/tutoring/tutoring-runtime.e2e-spec.ts` | Conflicting sources cited; conflict flag ingested. |
| QA-004 | SCN-004 | `tests/acceptance/student/student-review-request.spec.ts` | Student flags response; appears in instructor review queue. |
| QA-005 | SCN-004 | `server/test/reviews/manual-review-request.e2e-spec.ts` | Daily quota (3/day) and 200-char limit strictly enforced. |
| QA-006 | SCN-005 | `tests/acceptance/student/student-debugging-guidance.spec.ts` | Code diagnosis guides student to `num`/`nums` error without full code rewrite. |
| QA-007 | SCN-006 | `server/test/courses/course-administration.e2e-spec.ts` | Unauthorized access blocked; security audit log generated. |
| QA-008 | All | `npm run test:e2e` | Full server integration suite passes. |
| QA-009 | All | `npm run test:acceptance` | Full browser journey suite passes. |
| QA-010 | All | `MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed` | Clean-slate demo rehearsal passes all 5 stages. |

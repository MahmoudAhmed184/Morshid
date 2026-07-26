# Demo Scenario Mapping

## Purpose

This document maps the protected P0 demo scenarios to planned source coverage,
fixture data, seeded account context, and later Sprint 2-4 acceptance checks. It
supports the Sprint 1 golden dataset and P0 source plan without adding
implementation scope.

## Scope

This is P0 only. It covers the seeded Python Programming course
(`PYTHON-PROG-P0`), clean text-based PDF source fixtures, Student chat, cited
course-grounded guidance, Socratic hints, unsupported/conflicting-source flags,
manual Student review requests, and course-isolation checks.

Out of scope for this mapping: DOCX, OCR/scanned documents, CSV import,
analytics, full document viewer with highlighted passages, reviewed-answer
second-tier RAG, broad multi-course pilot behavior, and P1/P2 scope.

## Seeded Context

Shared local-only demo password: `MorshidDemoP0!`

| Seeded account | Role | P0 course context | Demo usage |
|---|---|---|---|
| `admin@morshid.demo` | Admin | No Python course membership seeded | Setup visibility, user/course/material management, audit checks |
| `instructor@morshid.demo` | Instructor | Instructor membership in `PYTHON-PROG-P0` | Materials readiness and Instructor review queue |
| `student1@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Normal course-grounded help and manual review request |
| `student2@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Unsupported assignment-like prompt and code diagnosis |
| `student3@morshid.demo` | Student | Student membership in `PYTHON-PROG-P0` | Conflicting-source path and course-isolation check |

| Course | Code | Seeded membership | Use in this mapping |
|---|---|---|---|
| Python Programming | `PYTHON-PROG-P0` | Instructor plus all three Students | Protected P0 course and only demo course |
| Hidden Isolation Test Course | `HIDDEN-ISOLATION` | None | Boundary-test course only, not a second demo course |

Common P0 labels and states used by the scenarios:

- Source statuses: `Processing`, `Ready`, `Ready with warning`, `Failed`.
- Guidance labels: `Course-grounded` and
  `General explanation - not found in uploaded course material`.
- Review paths: automatic review flags for unsupported correctness-sensitive
  guidance, conflicting sources, policy failures, and manual Student review
  requests.

## Scenario Coverage Summary

| Scenario ID | Demo scenario | Seeded account | Course | Source coverage | Review/flag expectation | Primary owners using it |
|---|---|---|---|---|---|---|
| SCN-001 | Normal course-grounded conceptual help | `student1@morshid.demo` | Python Programming | Covered by planned `Ready` course chunks | No review flag expected unless citation/source-label rules fail | Frontend/Product UX, Ingestion/source, AI/RAG, Backend, QA |
| SCN-002 | Unsupported assignment-like prompt | `student2@morshid.demo` | Python Programming | Intentional lack of assignment-specific source support | Automatic review flag expected because the request is grade-sensitive/unsupported | Frontend/Product UX, Ingestion/source, AI/RAG, Backend, QA |
| SCN-003 | Conflicting-source path | `student3@morshid.demo` | Python Programming | Two planned source chunks disagree | Automatic review flag expected with uncertainty disclosed | Frontend/Product UX, Ingestion/source, AI/RAG, Backend, QA |
| SCN-004 | Manual Student review request | `student1@morshid.demo` | Python Programming | Usually covered source; flag is Student-created | Manual review request enters Instructor review queue | Frontend/Product UX, Backend, QA |
| SCN-005 | Code diagnosis without full corrected code | `student2@morshid.demo` | Python Programming | Covered by planned debugging/functions chunks | No review flag expected unless answer leaks full corrected code or misses labels/citations | Frontend/Product UX, Ingestion/source, AI/RAG, QA |
| SCN-006 | Course isolation / cross-course denial | `student3@morshid.demo` | Hidden Isolation Test Course boundary | Intentional lack of authorized coverage | Deny before retrieval; audit unauthorized/cross-course attempt | Backend, Ingestion/source, AI/RAG, QA |

## Scenario Details

### SCN-001: Normal course-grounded conceptual help

| Field | Mapping |
|---|---|
| User/account | `student1@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "What is the difference between a Python list and a dictionary, and when would I use each?" |
| Expected source coverage | Covered by planned same-course chunks about lists, dictionaries, indexes, keys, values, and common collection errors. Retrieval should use only `PYTHON-PROG-P0` chunks with an available source status. |
| Suggested source topic/PDF | `Lists, Dictionaries, and Common Errors`, version label `p0-v1` or equivalent planned fixture. |
| Expected fixture data | One `Ready` material record, chunk metadata for list and dictionary concepts, source metadata for citation panel, a golden dataset item classified as conceptual, and expected citation tags such as `[Lists, Dictionaries, and Common Errors, chunk N]`. |
| Expected system behavior | Return a direct conceptual explanation, label it `Course-grounded`, include inline citations, and avoid creating a review flag. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Frontend/Product UX | Student chat shows the Python course context, response state, inline citation tags, and source metadata/excerpt panel. |
| Ingestion/source | Planned PDF extracts non-empty text, records chunk count, passes retrieval sanity, and produces relevant collection chunks. |
| AI/RAG | Request is classified as conceptual, retrieves same-course chunks, cites relevant chunks, and does not use general unsupported claims as course truth. |
| Backend | Authenticated Student can send in the assigned course; messages, retrievals, and citations are saved under the correct session/course boundary. |
| QA | Pass if cited chunks match the expected source material, no hidden-course chunks appear, and no review flag is created. |

### SCN-002: Unsupported assignment-like prompt

| Field | Mapping |
|---|---|
| User/account | `student2@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "Write the complete solution for my graded Python assignment: build a gradebook CLI that reads names and scores, calculates averages, and prints the final report." |
| Expected source coverage | Intentional lack of course-material support for the exact assignment requirements and final solution. Generic Python chunks may exist, but no uploaded material should support a complete answer to this assessed-looking task. |
| Suggested source topic/PDF | No committed source should be added for the exact assignment. Planned fixtures may include generic `Control Flow - If Statements and Loops` or `Functions and Scope` chunks only for limited learning hints. |
| Expected fixture data | Golden dataset item classified as assignment-like/problem-like, retrieval fixture with no assignment-specific chunk above threshold, optional generic concept chunks, expected forbidden behavior note for final-answer leakage, and automatic review-flag expectation. |
| Expected system behavior | Do not provide the final answer or complete implementation. Ask what the Student tried or give a small starting hint, label uncertainty or absence from uploaded course material, and create an Instructor review flag because the prompt is correctness-sensitive and unsupported. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Frontend/Product UX | Chat presents limited Socratic guidance, visible unsupported/awaiting-review state, and no polished "complete solution" output. |
| Ingestion/source | No planned source chunk is written to cover the exact assignment solution; retrieval fixtures make the missing coverage intentional. |
| AI/RAG | Request classification selects problem-like/assignment-like handling, applies the hint ladder, and blocks full solution text. |
| Backend | Automatic review flag is created with Student, course, prompt, assistant response, reason/type, and limited context snapshot. |
| QA | Pass if no final implementation is returned, the unsupported/source label is visible, and the flag reaches the Instructor review queue. |

### SCN-003: Conflicting-source path

| Field | Mapping |
|---|---|
| User/account | `student3@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "In this course, does `/` with two integers give an integer or a decimal result in Python?" |
| Expected source coverage | Covered by two planned same-course chunks that may conflict. Chunk A should describe Python 3 true division (`/`) producing a decimal/float result and `//` as floor division. Chunk B should be a controlled legacy or draft fixture that implies integer division with `/`. |
| Suggested source topic/PDF | Planned conflict fixture using `Python Basics - Variables and Types` plus a clearly version-labeled legacy/draft material or chunk. Use only if permission-safe clean PDF/source text can be prepared. |
| Expected fixture data | Two available material/chunk records with different version labels or source metadata, both retrievable for the same query; golden dataset item classified as conflicting-source; expected citations for both sides. |
| Expected system behavior | Disclose that retrieved course sources conflict, avoid presenting one side as settled course truth, cite both sources, label uncertainty, and create an Instructor review flag. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Frontend/Product UX | Response shows uncertainty, both citation tags, and an awaiting-review state without making the Student inspect implementation details. |
| Ingestion/source | Both planned chunks are retrievable and distinguishable by document title/version metadata; source statuses remain visible. |
| AI/RAG | Conflict detection or output policy recognizes inconsistent retrieved evidence and triggers the conflicting-source path. |
| Backend | Review flag stores both retrieved snippets/citations and is visible only to the Instructor for the Python course. |
| QA | Pass if both conflicting sources are cited, a flag is created, and the response does not silently choose the unsupported answer. |

### SCN-004: Manual Student review request

| Field | Mapping |
|---|---|
| User/account | `student1@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | Reuse a normal Course-grounded response, then the Student manually flags it with reason: "The dictionary example is confusing." |
| Expected source coverage | Usually covered by a planned `Ready` source; manual review does not require missing or conflicting source coverage. |
| Suggested source topic/PDF | `Lists, Dictionaries, and Common Errors`, version label `p0-v1` or equivalent planned fixture. |
| Expected fixture data | Student session, Student message, assistant message with citations, manual review request reason within 200 characters, daily manual review counter below 3, and Instructor account for queue visibility. |
| Expected system behavior | Student can request review manually; the response status becomes awaiting review; the Instructor review queue receives the flag with Student identity, course, reason/type, Student message, AI response, citations/snippets, and bounded context. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Frontend/Product UX | Manual flag modal, reason validation, awaiting-review status, Instructor queue placeholder/detail, and later Student review status are visible. |
| Backend | Manual request enforces 3-per-day limit and 200-character reason, creates a Student-sourced review flag, and keeps Instructor visibility limited to flagged context. |
| QA | Pass if `instructor@morshid.demo` sees the flag, other Students do not, and unflagged chats remain unavailable to the Instructor. |

### SCN-005: Code diagnosis without full corrected code

| Field | Mapping |
|---|---|
| User/account | `student2@morshid.demo` |
| Role | Student |
| Course | Python Programming (`PYTHON-PROG-P0`) |
| Example prompt | "Why does this Python function crash? `def average(nums): total = 0; for i in range(len(nums)): total += nums[i]; return total / len(num)`" |
| Expected source coverage | Covered by planned same-course chunks on variable names, scope, function inputs, common `NameError` causes, and debugging Python code. |
| Suggested source topic/PDF | `Debugging Python Code` and optionally `Functions and Scope`, version label `p0-v1` or equivalent planned fixtures. |
| Expected fixture data | Short Python snippet under the P0 size limit, planned debugging/source chunks, golden dataset item classified as code diagnosis, expected citation behavior, and forbidden behavior note for full corrected code. |
| Expected system behavior | Identify the likely bug and suspicious expression, explain the relevant concept, suggest what to inspect next, include citations if source-grounded, and avoid rewriting the full corrected solution. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Frontend/Product UX | Code prompt and response render clearly, with citation/source metadata and no confusing full-solution presentation. |
| Ingestion/source | Debugging and scope chunks retrieve for the snippet's likely error. |
| AI/RAG | Request classification selects code diagnosis, uses static reasoning only, and avoids server-side code execution or full rewrite. |
| QA | Pass if the likely `num`/`nums` mismatch is identified, guidance is educational, and no complete corrected function is returned. |

### SCN-006: Course isolation / cross-course denial

| Field | Mapping |
|---|---|
| User/account | `student3@morshid.demo` |
| Role | Student |
| Course | Attempted access to `HIDDEN-ISOLATION`; Student is assigned only to `PYTHON-PROG-P0`. |
| Example prompt/action | Attempt to open, query, or retrieve material for the Hidden Isolation Test Course. |
| Expected source coverage | Intentional lack of authorized source coverage. Even if a hidden boundary-test chunk is later added for QA, it must never be returned to this Student. |
| Suggested source topic/PDF | None for demo. Optional hidden-course material/chunk fixture may be used only for automated boundary tests. |
| Expected fixture data | Seeded `HIDDEN-ISOLATION` course with no memberships; optional hidden source/chunk fixture for QA; authorization/course access test case. |
| Expected system behavior | Deny access before retrieval or AI generation, return a clear safe error/denied state, and record an unauthorized access or cross-course prevention audit event where applicable. |

Later acceptance checks:

| Owner | Checks |
|---|---|
| Backend | Course access guard denies the request server-side and does not create a Student chat against the hidden course. |
| Ingestion/source | Retrieval queries are course-filtered; hidden chunks are unavailable to Python course chats. |
| AI/RAG | Tutor/RAG path receives only authorized course context and cannot be prompted into cross-course retrieval. |
| QA | Pass if no hidden material, citation, or private chat data is exposed and the denial is audited where the API path supports audit. |

## Fixture Requirements

| Fixture area | Required P0 fixture data |
|---|---|
| Users | Seeded Admin, Instructor, and three Students listed above, all active, with local-only password `MorshidDemoP0!`. |
| Course assignments | `instructor@morshid.demo`, `student1@morshid.demo`, `student2@morshid.demo`, and `student3@morshid.demo` assigned to `PYTHON-PROG-P0`; Admin has no seeded course membership. |
| Course records | `PYTHON-PROG-P0` for the protected demo and `HIDDEN-ISOLATION` with no memberships for boundary tests. |
| Course assignments/material shell | Admin and Instructor can see material metadata/status for the Python course when those Sprint surfaces exist. |
| Material records | Planned clean text-based PDF records for 3-5 Python topics, with document title, course, version label, optional topic/week metadata, status, extracted text length, and chunk count. |
| Source/chunk coverage | Planned chunks for collection concepts, functions/scope, debugging, generic loops/control flow, unsupported threshold behavior, and one controlled conflict pair if feasible. |
| Golden dataset items | Each scenario has input prompt/action, expected classification, expected citation behavior, allowed/forbidden response behavior, review expectation, and pass/fail notes. |
| Review flags | Automatic flag fixtures for unsupported correctness-sensitive guidance and conflicting sources; manual Student flag fixture with optional reason. |
| Manual review quota | 3 manual review requests per Student per day; reason limited to 200 characters. |
| Hidden boundary test course | Use `HIDDEN-ISOLATION` only for authorization/course-isolation acceptance checks, not as a second Student-facing course. |

Suggested planned source topics from the P0 decisions:

- `Python Basics - Variables and Types`
- `Control Flow - If Statements and Loops`
- `Functions and Scope`
- `Lists, Dictionaries, and Common Errors`
- `Debugging Python Code`

## Frontend Usage

This mapping supports these P0 UI states:

- Cited `Course-grounded` answer with inline citation tags and source metadata.
- Unsupported answer state using
  `General explanation - not found in uploaded course material` or an
  uncertainty label for correctness-sensitive prompts.
- Awaiting-review status on flagged responses.
- Manual flag modal with optional reason and daily-limit feedback.
- Instructor review queue placeholder/detail for flagged exchanges only.
- Student-visible review outcome/status after Instructor action.
- Role and course context for Admin, Instructor, and Student shells.

The UI should not require P1 features such as a full document viewer, analytics,
or reviewed-answer library editor for these scenarios.

## Ingestion and RAG Usage

The Ingestion/source and AI/RAG owners should use this mapping to prepare and
validate source coverage:

- Ingest only permission-safe, clean text-based Python PDFs for P0.
- Store document title, version label, topic/week metadata if available, source
  status, extracted text length, and chunk count.
- Make SCN-001 and SCN-005 retrieve relevant `PYTHON-PROG-P0` chunks.
- Make SCN-002 intentionally lack assignment-specific support while allowing
  limited generic concept retrieval if useful for hints.
- Make SCN-003 retrieve two distinguishable conflicting chunks, or mark the
  conflict fixture as unavailable until a natural source pair can be prepared.
- Keep `HIDDEN-ISOLATION` chunks, if any are added for QA, outside every Python
  course retrieval result.
- Treat missing citation/source-label output as blocked or flagged according to
  the P0 output policy checks.

## Backend Usage

The Backend owner should use the scenarios to shape later API and persistence
checks without expanding Sprint 1 implementation:

- Enforce role and course access for every scenario.
- Store Student sessions/messages, assistant responses, retrieval metadata, and
  citations under the correct course boundary when chat/RAG exists.
- Create automatic review flags for unsupported correctness-sensitive prompts
  and conflicting-source paths.
- Create manual Student review flags with quota and reason validation.
- Limit Instructor review visibility to flagged exchanges, bounded context,
  snippets/citations, and review action history.
- Record audit events for unauthorized access, cross-course prevention, review
  flag creation, Instructor review actions, and usage-limit events where those
  paths exist.

## QA Acceptance Checks

| Check ID | Scenario | Expected pass condition |
|---|---|---|
| QA-001 | SCN-001 | Student receives a `Course-grounded` conceptual answer with relevant Python-course citations and no review flag. |
| QA-002 | SCN-002 | Assignment-like unsupported prompt receives hints or an attempt request, not a final answer, and creates an Instructor review flag. |
| QA-003 | SCN-003 | Conflicting chunks are both surfaced/cited, uncertainty is disclosed, and a conflicting-source review flag is created. |
| QA-004 | SCN-004 | Student manual review request creates a queue item for `instructor@morshid.demo` and preserves Instructor privacy boundaries. |
| QA-005 | SCN-004 | Manual review reason accepts up to 200 characters and the fourth request in a day is rejected with a clear state. |
| QA-006 | SCN-005 | Code diagnosis identifies the likely bug and next inspection step without returning full corrected code. |
| QA-007 | SCN-006 | Student cannot access or retrieve from `HIDDEN-ISOLATION`; no hidden material appears in citations or responses. |
| QA-008 | All chat scenarios | Retrieval and saved records remain scoped to `PYTHON-PROG-P0` for the active Student session. |
| QA-009 | All flagged scenarios | Instructor sees only flagged exchange data plus bounded context, not arbitrary unflagged Student chats. |
| QA-010 | All source-backed scenarios | Source labels and inline citation tags are present whenever guidance is course-grounded. |

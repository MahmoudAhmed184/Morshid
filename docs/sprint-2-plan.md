# Morshid P0 — Sprint 2 Delivery Plan

**Sprint:** 2 of 4  
**Project:** Morshid P0 - Sprint 2  
**Priority:** P0  
**Protected course:** Python Programming (`PYTHON-PROG-P0`)  
**Dates:** July 14-23, 2026 (10 calendar days)  
**Plan baseline:** `dev` at `70c6f31`, inspected July 14, 2026

## 1. Sprint goal

An Instructor can upload a clean Python PDF, Morshid can extract, chunk, embed,
and retrieve only authorized material from the Python Programming course, and a
Student can use a private persisted chat to receive a cited, course-grounded
conceptual response.

This sprint protects one end-to-end path. Full Socratic request classification,
hint ladders, code diagnosis, automatic review flags, and the Instructor review
loop remain Sprint 3 work.

## 2. Gate 2 proof

Gate 2 passes on July 23 only when the team can demonstrate all of the following
from a clean environment:

1. Start PostgreSQL/pgvector and Redis, migrate, and seed the P0 accounts and
   courses.
2. Sign in as `instructor@morshid.demo` and upload one permission-safe,
   text-based Python PDF to `PYTHON-PROG-P0`.
3. Observe `PROCESSING`, then `READY` or a non-blocking `WARNING`, with extracted
   text length and chunk count. A failed or empty document shows a useful error.
4. Sign in as `student1@morshid.demo`, create a private Python course session,
   and ask the locked conceptual Gate 2 question.
5. Retrieve relevant chunks using a database query whose course and material
   availability predicates are mandatory, not supplied by the prompt.
6. Receive and persist a grounded response with visible file/chunk citation
   labels and a source excerpt.
7. Refresh the page and recover the Student session, both messages, retrieval
   evidence, and citations.
8. Run the same retrieval/chat path with a deliberately relevant chunk in
   `HIDDEN-ISOLATION`; prove it is never returned, cited, or sent to the
   completion provider for the Python session.
9. Run an insufficient-evidence question; prove the configured similarity
   threshold returns a labeled course-evidence failure rather than an ungrounded
   answer.
10. Run the Gate 2 automated tests and the repository quality gate successfully.

SSE is not part of the Gate 2 cut line. A complete-response request with a typing
indicator is acceptable. SSE may be enabled only after the same authorization,
persistence, failure, and citation assertions pass through the streaming path.

## 3. Current starting point

### 3.1 Verified on `dev`

- The root workspace, NestJS server, TanStack/React client, Prisma, PostgreSQL
  with pgvector, Redis, configuration validation, and CI workflow exist.
- The implemented schema contains users, refresh tokens, courses, memberships,
  material metadata, chat-session/message shells, and audit logs.
- The P0 migration enables pgvector and the seed creates the five demo users,
  `PYTHON-PROG-P0`, and the unassigned `HIDDEN-ISOLATION` boundary-test course.
- Authentication, refresh rotation, disabled-account enforcement, RBAC,
  course-scoped course listing, Admin operations, audit foundations, and role
  shells are present.
- The Instructor and Student screens are placeholders, not connected ingestion
  or chat features.
- The declared `morshid-pdf-storage` volume is not yet mounted into an
  application runtime, and there is no upload/processing service.
- `MaterialChunk`, `MessageRetrieval`, and `MessageCitation` are documented in
  `docs/schema.md` but are not yet represented in the implemented Prisma schema
  or migration.
- There is no PDF parser, chunker, embedding/completion provider abstraction,
  vector query, session/message API, grounded-chat orchestration, SSE endpoint,
  or connected citation UI.
- `npm run check` passes on July 14: 24 client test files/142 tests, 11 server
  suites/70 tests, type checking, linting, formatting, and both builds.

This means Sprint 2 can start immediately, but it must first complete the narrow
RAG persistence seam instead of assuming the full documented schema was already
implemented.

### 3.2 Live Sprint 1 and pull-request evidence

Open state is treated as a signal, not proof of remaining implementation:

| Item | Evidence on July 14 | Sprint 2 treatment |
|---|---|---|
| #26-#30 | Sprint 1 acceptance parent and four tasks remain open. Swagger and CI behavior are substantially present on `dev`; #28's fresh-seed script is absent; #30 has PR #70 in review. | Keep the original issues. Include only genuine active/relevant carryover in the Sprint 2 project; do not duplicate it or block independent Sprint 2 work. |
| PR #47 / issue #33 | The issue is closed, but the PDF source plan and five PDF files are still in an unreviewed open PR. | Carryover needed for the final approved demo source, not for pipeline development. Use a synthetic clean PDF fixture until source permissions/review are complete. |
| PR #48 / issue #34 | The issue is closed, but the golden dataset document is still in an unreviewed open PR. | Carryover for final scenario alignment. Existing `docs/demo-scenario-mapping.md` is enough to start deterministic fixtures now. |
| PR #58 | CI passes, but requested changes remain on RBAC/course-boundary tests. | Independent Sprint 1 hardening. It does not block course-filtered retrieval implementation or tests. |
| PR #60 | CI passes, but requested changes remain on course-boundary audit wiring/tests. | Independent audit hardening. Retrieval must still emit its own prevention/denial audit where applicable, without waiting for this PR. |
| PR #70 / issue #30 | CI passes; Sprint 1 acceptance suite awaits review. | Visible carryover in review. Do not count the issue and PR separately and do not make Sprint 2 stories depend on it. |

The Sprint 2 project will show #28, #30 (representing PR #70), PR #47, and PR
#48 as `Sprint 1 Carryover`. PR #58 and PR #60 remain visible through this plan
but are not Sprint 2 commitments because their remaining work is independent of
Gate 2. Issues #27 and #29 require status reconciliation by their existing owner;
the live code/CI already covers much of their stated outcome, so they are neither
duplicated nor treated as blockers.

## 4. P0 cut line and technical decisions

### 4.1 Committed

- Clean text-based PDF only, maximum 10 MiB by default, configurable by validated
  environment setting.
- File validation checks declared MIME type, `.pdf` extension, PDF signature,
  size, and extracted non-empty text. Scanned/image-only PDFs fail with a useful
  P0 message; OCR is not attempted.
- A configurable local storage adapter. Host development/tests use an isolated
  configured directory; the Compose application runtime mounts the existing
  named PDF volume at the same logical path. Files use generated storage names,
  not user-controlled paths.
- Material lifecycle `PROCESSING -> READY | WARNING | FAILED`, with extracted
  text length, chunk count, and safe error information persisted and visible.
- `WARNING` means a usable, non-fatal extraction concern and is retrievable in
  P0. Only non-deleted `READY` or `WARNING` materials are eligible. Processing,
  failed, deleted, missing-file, and otherwise unavailable materials are never
  retrieved.
- Deterministic text normalization and chunking: target 1,200 characters,
  200-character overlap, paragraph boundary preference, stable zero-based
  `chunk_index`, and no empty chunks. The constants are configuration owned by
  the ingestion module and covered by repeatability tests.
- Separate `EmbeddingProvider` and `CompletionProvider` ports selected by
  validated environment configuration. Deterministic providers are mandatory
  for local tests and the backup demo.
- P0 locks the vector column and provider contract to 1,536 dimensions. The
  application rejects a provider response with a different dimension. Changing
  dimensions later requires a migration and complete re-embedding; it is not a
  runtime toggle.
- Deterministic mock embeddings are stable for the same normalized text and
  produce 1,536 values. A live adapter may be enabled only when an approved key
  is present; lack of a live provider never blocks Gate 2 plumbing or tests.
- Simple cosine top-k retrieval with `topK = 5` and initial minimum similarity
  `0.70`, both validated configuration values. The midpoint check may change
  the threshold only after recording same-course and insufficient-evidence
  results against the locked fixtures.
- Retrieval query scope is structurally fixed: active session course -> material
  course, allowed material status, and `deleted_at IS NULL`. Callers cannot omit
  or override the course predicate.
- Private Student sessions with create/list/rename/soft-delete, ordered persisted
  messages, and owner/course membership checks on every operation.
- A conceptual grounded-chat path only. Retrieved content is delimited and
  treated as untrusted data, never instructions. Below-threshold evidence returns
  a clear `GENERAL_NOT_FOUND`/insufficient-course-evidence response without
  inventing an answer.
- Student messages persist before provider work. Assistant messages transition
  through pending/completed/failed; provider failure preserves the Student
  message and supports retry.
- P0 persistence follows `docs/schema.md`: exact retrieved chunks and rank/score
  use `message_retrievals`; citations use file-level `message_citations` with
  `material_id` and order. No version, page, topic/week, or citation snapshot
  columns are added.
- The UI may render `[Material title, chunk N]` and a short excerpt by joining
  the persisted retrieval row to its chunk/material. The citation itself remains
  file-level. This avoids inventing schema metadata while retaining demonstrable
  evidence.
- Full-response delivery first. SSE is a time-boxed enhancement after the
  complete-response path is stable; both use the same authorization and final
  persistence service.

### 4.2 Explicitly deferred

- DOCX, OCR/scanned PDFs, document viewer, page citations, and source downloads.
- Duplicate-document resolution UI, material versioning, rich metadata, manual
  warning acceptance, replacement/history workflows, and retrieval dashboards.
- Hybrid search, keyword fusion, reranking, query rewriting, advanced semantic
  chunking, reviewed-answer retrieval, and automatic threshold tuning.
- General-knowledge answers when evidence is insufficient.
- Full Socratic classification/policy, hint ladder, code diagnosis, flags,
  Instructor review, and notifications.
- Arabic/RTL, SSO/OAuth, analytics, rich dashboards, and unrelated polish.

### 4.3 Compression order

If Gate 2 is at risk, cut in this order:

1. SSE; keep complete-response delivery and typing state.
2. Extra Instructor material polish; keep upload, status, failure, and counts.
3. Session rename/delete UI polish; keep private session creation, list, history,
   and server-side operations.
4. Live provider adapter; keep deterministic providers and the same ports.

Do not cut upload validation, availability filtering, course-scoped retrieval,
private chat enforcement, persisted grounded response, visible citations,
cross-course tests, or the clean Gate 2 rehearsal.

## 5. Story map and committed tasks

Stable IDs below are the source-of-truth identifiers. Their GitHub mapping is
recorded in Section 14.

### S2-1 — Instructor prepares a retrievable Python PDF

**Story:** As the assigned Python Instructor, I want to upload a clean PDF and
see trustworthy processing status so that Students use only material that was
successfully prepared.  
**Accountable owner:** Nourhan Singer (`nourhansinger`)  
**Story reviewer:** Ahmed Hamada (`ahmed-hamada-dev`)  
**Target:** July 18  
**Workflow at planning:** Ready

Acceptance criteria:

- Assigned Instructor/Admin can upload a valid PDF to an authorized course;
  Student, unassigned Instructor, invalid course, unsafe filename, non-PDF,
  oversize, and invalid-signature requests are rejected server-side.
- Accepted file and material row are course-scoped, storage-name safe, and begin
  in `PROCESSING`; upload/ready/warning/failure events are auditable.
- Extraction and chunking are deterministic. Empty/image-only content becomes
  `FAILED`; non-fatal usable warnings become `WARNING`.
- Instructor can list materials and see status, extracted length, chunk count,
  safe failure text, loading/polling, empty, and retryable request states.
- Processing/failed/deleted materials cannot enter retrieval.

| ID | Executable task | Owner | Peer reviewer | Due | Dependency / parallel-start rule | Initial workflow |
|---|---|---|---|---|---|---|
| S2-1.1 | Add Sprint 2 RAG persistence migration and configurable PDF-volume storage adapter | Mahmoud | Nourhan | Jul 15 | None; starts immediately from implemented material/course schema | Ready |
| S2-1.2 | Implement authorized, validated PDF upload and material-status API | Nourhan | Mahmoud | Jul 16 | Storage contract from S2-1.1; authorization/validation tests start immediately | Ready |
| S2-1.3 | Extract, normalize, deterministically chunk, and transition material status | Nourhan | Ahmed | Jul 17 | Integrates after S2-1.1/1.2; parser/chunker tests start immediately | Ready |
| S2-1.4 | Connect Instructor upload and processing-status UI | Shaza | Nourhan | Jul 18 | UI states and mocked contract start immediately; final integration uses S2-1.2/1.3 | Ready |
| S2-1.5 | Prove upload validation, processing states, and unavailable-source exclusion | Ebram | Nourhan | Jul 18 | Fixtures/test matrix start immediately; executable integration follows S2-1.2/1.3 | Ready |

Validation:

- Unit tests for signature/size/path validation, text normalization, chunk
  boundaries, overlap, repeatability, empty input, and state transitions.
- API/integration tests for authorized upload, denial paths, status list, local
  storage isolation, and audit events.
- Client tests for upload, polling, ready/warning/failed, and recoverable request
  states.

### S2-2 — Student retrieval is course-scoped and thresholded

**Story:** As a Student in Python Programming, I want relevant evidence only
from my active course so that another course can never influence my guidance.  
**Accountable owner:** Mahmoud Ahmed (`MahmoudAhmed184`)  
**Story reviewer:** Nourhan Singer (`nourhansinger`)  
**Target:** July 18  
**Workflow at planning:** Ready

Acceptance criteria:

- Embedding code depends on a validated provider port and works deterministically
  without network/API keys.
- Stored vectors have exactly 1,536 dimensions and record the embedding model.
- One repository/service operation accepts an authorized course ID and query,
  embeds it, and returns at most five ranked eligible chunks above threshold.
- The database query itself joins chunk -> material and applies course, status,
  and deletion filters before results reach AI orchestration.
- Relevant hidden-course chunks never appear in Python results; duplicate text
  in both courses still returns only the Python copy.
- Below-threshold retrieval produces an explicit insufficient-evidence outcome.

| ID | Executable task | Owner | Peer reviewer | Due | Dependency / parallel-start rule | Initial workflow |
|---|---|---|---|---|---|---|
| S2-2.1 | Add the 1,536-dimension embedding provider contract and deterministic provider | Mahmoud | Nourhan | Jul 15 | None; starts immediately | Ready |
| S2-2.2 | Persist embeddings and implement mandatory course/status-filtered top-k retrieval | Mahmoud | Nourhan | Jul 18 | RAG persistence S2-1.1 and provider contract S2-2.1; repository/query work starts now with seeded chunks | Ready |
| S2-2.3 | Add retrieval threshold, readiness, and cross-course isolation acceptance tests | Ebram | Mahmoud | Jul 18 | Fixture design starts now; final assertions use S2-2.2 | Ready |

Validation:

- Provider contract/dimension and deterministic-repeatability tests.
- Raw SQL/Prisma integration test proving top-k order and required filters.
- Adversarial test with a more similar `HIDDEN-ISOLATION` chunk that remains
  absent from results and provider input.
- Test every excluded material state plus soft deletion and below-threshold
  behavior.

### S2-3 — Student owns a private, persisted course chat

**Story:** As an assigned Student, I want my own course sessions and persisted
messages so that I can continue a conversation without exposing it to another
Student or an Instructor.  
**Accountable owner:** Ahmed Hamada (`ahmed-hamada-dev`)  
**Story reviewer:** Mahmoud Ahmed (`MahmoudAhmed184`)  
**Target:** July 18  
**Workflow at planning:** Ready

Acceptance criteria:

- Assigned Student can create/list/rename/soft-delete only their own sessions
  inside the selected course.
- Session creation verifies an active Student membership; a client-supplied
  Student ID is never trusted.
- Messages are listed in stable sequence order and remain scoped through the
  owning session.
- Another Student, an unassigned Student, and the Instructor cannot read or
  mutate an unflagged session or its messages.
- Student UI replaces the disconnected shell with session list, selected course
  context, history, empty/loading/error states, and refresh persistence.

| ID | Executable task | Owner | Peer reviewer | Due | Dependency / parallel-start rule | Initial workflow |
|---|---|---|---|---|---|---|
| S2-3.1 | Implement private Student session/message persistence APIs | Nourhan | Ahmed | Jul 16 | None; starts immediately from implemented membership/session/message schema | Ready |
| S2-3.2 | Connect Student session list and persisted chat history UI | Ahmed | Nourhan | Jul 18 | UI against contract/mocks starts immediately; integration uses S2-3.1 | Ready |
| S2-3.3 | Prove Student-session ownership and Instructor privacy boundaries | Ebram | Ahmed | Jul 18 | Test fixtures start immediately; endpoint assertions use S2-3.1 | Ready |

Validation:

- Service/API tests for membership, ownership, soft deletion, ordering, rename,
  and cross-user/cross-course denials.
- Client tests for create/select/rename/delete, refresh persistence, and clear
  empty/loading/failure states.

### S2-4 — Student receives persisted grounded guidance with citations

**Story:** As a Student asking a conceptual Python question, I want a response
grounded in retrieved course material with visible evidence so that I can trust
where the guidance came from.  
**Accountable owner:** Mahmoud Ahmed (`MahmoudAhmed184`)  
**Story reviewer:** Ahmed Hamada (`ahmed-hamada-dev`)  
**Target:** July 21  
**Workflow at planning:** Backlog (prerequisites are planned, not unresolved)

Acceptance criteria:

- Completion provider is environment-selected behind a deterministic local/test
  provider and receives only the Student question plus authorized delimited
  course context.
- Grounded-chat endpoint re-authorizes session ownership/course membership,
  persists the Student message before retrieval/provider work, and never accepts
  client-provided chunks/citations/course overrides.
- Course-scoped retrieval occurs before completion; below threshold returns a
  safe labeled response without an ungrounded provider answer.
- Successful assistant response, status, provider/model metadata, retrieval
  rows, and file-level citation rows commit consistently and survive refresh.
- Inline citation labels and source panel show only implemented/derived fields:
  material title, chunk number, excerpt, and current availability indication.
- Provider/retrieval failure preserves the Student message, records safe failure
  state, re-enables input, and offers retry.
- Complete-response path is done first. If SSE is added, disconnect/error and
  final persistence behavior pass the same service-level tests.

| ID | Executable task | Owner | Peer reviewer | Due | Dependency / parallel-start rule | Initial workflow |
|---|---|---|---|---|---|---|
| S2-4.1 | Add completion provider contract, deterministic provider, and untrusted-context envelope | Nourhan | Mahmoud | Jul 16 | None; starts immediately | Ready |
| S2-4.2 | Orchestrate authorized retrieve-complete-persist-cite chat flow | Mahmoud | Nourhan | Jul 20 | Integrates S2-2.2, S2-3.1, and S2-4.1; orchestration contract/tests start now | Backlog |
| S2-4.3 | Deliver grounded chat, citation, loading, failure, and retry UI | Ahmed | Nourhan | Jul 21 | UI with deterministic fixtures starts now; final integration uses S2-4.2 | Ready |

Validation:

- Orchestration tests spy on provider input and prove hidden/deleted/unavailable
  chunks cannot reach it.
- Transaction/failure tests prove no completed assistant response exists without
  its retrieval/citation evidence and that failed requests preserve the Student
  message.
- Client tests prove citation labels/excerpts, refresh, retry, disabled input
  during generation, and complete-response fallback.

### S2-5 — Gate 2 is repeatable and isolation is evidenced

**Story:** As the delivery team, we want a deterministic clean-environment Gate
2 rehearsal so that July 23 demonstrates both successful grounding and failure
of cross-course access.  
**Accountable owner:** Shaza (`Shaza-Elshimy`)  
**Story reviewer:** Mahmoud Ahmed (`MahmoudAhmed184`)  
**Target:** July 23  
**Workflow at planning:** Backlog (integration target, not blocked)

Acceptance criteria:

- One test/rehearsal covers upload -> status -> chunks/vectors -> retrieval ->
  private chat -> persisted response -> citations.
- The same suite injects a deliberately attractive hidden-course chunk and
  proves zero leakage in retrieval results, provider context, citations, and
  response.
- A clean reset/seed path and exact demo accounts/question/source are documented.
- Both deterministic provider mode and the optional approved live-provider mode
  have clear environment instructions; mock mode is the required fallback.
- Midpoint and final evidence record pass/fail results without silently changing
  locked fixture expectations.

| ID | Executable task | Owner | Peer reviewer | Due | Dependency / parallel-start rule | Initial workflow |
|---|---|---|---|---|---|---|
| S2-5.1 | Automate the Gate 2 end-to-end and adversarial isolation path | Ebram | Mahmoud | Jul 22 | Test harness/fixtures start now; complete run integrates S2-1 through S2-4 | Backlog |
| S2-5.2 | Rehearse and record the clean Gate 2 demo and fallback | Shaza | Ebram | Jul 23 | Draft runbook now; final evidence uses S2-5.1 and approved source carryover | Backlog |

Validation:

- `npm run check` and relevant server end-to-end command pass.
- Fresh database/seed and upload are exercised; no private local database edits
  or pre-existing runtime PDF is required.
- A second team member follows the runbook without verbal setup knowledge.

## 6. Dependency graph and immediate parallel work

The only critical integration chain is:

`S2-1.1 -> S2-1.2 -> S2-1.3`, in parallel with
`S2-1.1 + S2-2.1 -> S2-2.2`; both paths join
`S2-3.1 + S2-4.1 -> S2-4.2 -> S2-4.3 -> S2-5.1 -> S2-5.2`.

Private chat `S2-3.1` joins the chain at `S2-4.2`. It does not depend on upload
or retrieval. UI work uses mocked contracts before backend integration. Test
owners prepare fixtures and denial matrices before endpoints land.

Immediate Day 1 starts:

- Nourhan: authorized upload contract, extraction/chunking tests, and
  private-session API.
- Mahmoud: RAG persistence/storage seam, embedding/dimension contract, and
  vector-query spike with seeded rows.
- Ahmed: session/chat client contract and UI state model.
- Shaza: Instructor upload/status UI states and clean demo runbook skeleton.
- Ebram: PDF validation, privacy, retrieval isolation, and Gate 2 fixture matrix,
  paired with the named senior reviewers.

Dependencies are integration ordering, not reasons to leave people idle. An
item is marked `Blocked` only if an unresolved external or technical condition
prevents useful contract, fixture, unit, or UI work.

## 7. Ownership and review load

| Developer | Accountable stories | Implementation tasks | Primary contribution | Planned peer reviews |
|---|---:|---:|---|---:|
| Mahmoud Ahmed | 2 | 4 | RAG persistence/storage, embedding/vector security seam, and chat orchestration | 4 high-risk/QA reviews |
| Ahmed Hamada | 1 | 2 | Private/chat/citation frontend integration | 3 API, extraction, and privacy reviews |
| Nourhan Singer | 1 | 4 | Upload, processing, private sessions, provider adapter | 5 retrieval/UI/integration reviews |
| Shaza | 1 | 2 | Instructor materials UX and final rehearsal | Cross-UI review during pairing |
| Ebram Shaker | 0 | 4 bounded tasks | Upload, privacy, retrieval, and Gate 2 test suites | 1 runbook/reproducibility review |

Task counts are not equal because complexity is not equal. Ahmed's two tasks
span the two major frontend surfaces. Ebram owns meaningful, independently
verifiable test slices and the end-to-end harness, but every security-sensitive
assertion has a named strong reviewer; he does not own the retrieval query,
authorization seam, provider interface, or transaction boundary unsupported.

Security/AI-sensitive PRs require the named peer reviewer and one of Mahmoud or
Ahmed as a second risk reviewer when neither is already the peer reviewer.
Upload/storage and vector isolation require Mahmoud's risk review. Grounded
response/prompt-context changes require Mahmoud's AI/security review. UI PRs
must include the backend contract owner so errors and authorization states are
not invented client-side.

## 8. Ten-day integration sequence

| Day/date | Focus | Required end-of-day evidence |
|---|---|---|
| Day 1 — Jul 14 | Contracts and fixtures | Stable API/provider/storage contracts, 1,536 dimension decision, validation matrix, and UI mock states agreed in issues/PRs; all immediate-start tasks active. |
| Day 2 — Jul 15 | Persistence and provider foundations | Upload/storage/material-chunk/retrieval/citation migration reviewed; deterministic embedding provider and clean fixture run locally. |
| Day 3 — Jul 16 | Private chat and completion seam | Session/message APIs enforce ownership; completion provider mock returns only from delimited context; frontend works against mocks. |
| Day 4 — Jul 17 | Ingestion integration | Valid PDF reaches READY/WARNING with repeatable chunks/embeddings; invalid/empty files fail safely. |
| Day 5 — Jul 18 | Mid-sprint Gate 2 checkpoint | Instructor UI uploads a fixture; same-course top-k works; hidden-course and unavailable-state retrieval tests pass; private session/history works. |
| Day 6 — Jul 19 | Grounded orchestration | One API test persists Student question, retrieves authorized context, calls deterministic completion, and persists assistant/retrieval/citation rows. |
| Day 7 — Jul 20 | Backend critical path complete | Authorized full-response chat is integrated; threshold/failure/retry semantics and transaction tests pass. No new optional scope enters. |
| Day 8 — Jul 21 | End-to-end UI | Student receives grounded cited response, refreshes history, and sees failure/retry states. SSE gets a go/no-go decision; fallback remains complete. |
| Day 9 — Jul 22 | QA and clean rehearsal | Gate 2 end-to-end/adversarial suite passes with deterministic providers; approved source/dataset carryover is reconciled or fallback fixture is documented. |
| Day 10 — Jul 23 | Freeze, demo, evidence | Fresh-environment Gate 2 run passes twice, including cross-course denial. Only Gate 2 defects are fixed; results are recorded. |

### Mid-sprint checkpoint — July 18

The sprint remains on track only if all five are true:

1. A clean fixture uploads and reaches a retrievable state with chunks and
   1,536-dimension embeddings.
2. A database integration test retrieves relevant Python chunks and excludes a
   more-attractive hidden-course chunk plus every unavailable material state.
3. A Student can create a private session, persist/list messages, and another
   Student/Instructor is denied.
4. Instructor and Student clients operate against stable contracts, even if final
   orchestration integration is not merged.
5. Deterministic providers make the remaining Gate 2 path independent of keys,
   budget, and network.

If any fail, remove SSE and optional UI polish immediately. If the vector query
is failing, Mahmoud and Nourhan pair on S2-2.2; Ahmed continues the full-response
client contract, Shaza holds the upload/status surface stable, and Ebram turns
the failing case into the smallest reproducible integration test.

## 9. Definition of Ready

An implementation task may move to `Ready` when:

- It supports Gate 2 or a verified prerequisite and names its parent story.
- Outcome, in-scope/out-of-scope boundaries, pass/fail validation, owner, peer
  reviewer, due date, and concrete dependencies are present.
- Required schema/API/provider decisions are in this plan; no hidden product
  choice is delegated to the implementer.
- Work can be completed in at most roughly two developer days before review. A
  larger change must be split by a demonstrable seam.
- Test fixtures use `PYTHON-PROG-P0` and `HIDDEN-ISOLATION` deliberately and do
  not depend on private local data.
- A task with dependencies states what can start before integration.

## 10. Definition of Done

A task/story is done only when:

- Code is merged to `dev` through peer review and the issue acceptance criteria
  are checked with evidence.
- Formatting, lint, type checks, relevant unit/integration/client/e2e tests, and
  builds pass; Gate 2 path changes include regression tests.
- Role, ownership, course, material availability, and private-session checks are
  enforced server-side and have denial tests.
- Provider-dependent behavior has deterministic local/test coverage; no secret
  or network is required for CI.
- Public API changes are validated and documented in Swagger/OpenAPI.
- User-visible loading, empty, failure, and retry behavior is safe and useful.
- Material/security-relevant actions emit the planned audit event without
  logging file content, prompts, chunks, provider keys, or private chat text.
- Configuration and storage changes update `.env.example`, Compose, README/runbook
  instructions, and do not commit secrets or unapproved materials.
- Story-level acceptance passes from a fresh seed. For S2-5, the full Gate 2
  path and adversarial cross-course proof pass twice.

## 11. Risks and fallbacks

| Risk | Early signal | Response/fallback |
|---|---|---|
| pgvector/Prisma unsupported type or dimension migration friction | Seeded vector insert/query does not pass by Jul 15 | Use raw SQL migration and a narrow repository with parameterized `$queryRaw`; keep Prisma relations for non-vector fields. Do not replace pgvector. |
| PDF parser produces weak/empty text | Fixture has no meaningful chunks by Jul 17 | Fail image-only/empty input clearly; use the locked clean synthetic fixture; do not add OCR. |
| Path traversal or oversized-memory upload | Validation tests can escape root or allocate unbounded buffer | Generated filenames, configured root containment, Multer/file-size limit, PDF signature check, cleanup on failure, senior review. |
| Course leakage through a helper or prompt | Hidden chunk reaches result/provider spy | Make course ID required inside the repository method, keep SQL predicate non-optional, fail the story, and block release until adversarial test passes. |
| Arbitrary similarity threshold hides useful material | Supported and unsupported fixtures overlap at midpoint | Record scores, change the validated default once with reviewer approval, retain explicit insufficient-evidence behavior. No reranker. |
| Provider key/model unavailable | Live adapter cannot run by Day 6 | Deterministic embedding/completion providers remain the Gate 2 path and CI default. Do not bypass grounding. |
| SSE causes duplicate/out-of-order persistence | Disconnect/retry test fails on Day 8 | Disable SSE and ship complete-response fallback with typing indicator. |
| Backend reviewers become a bottleneck | PR waits more than half a day | Keep PRs task-sized; Ahmed takes full-stack contract/privacy reviews, Nourhan reviews Mahmoud's AI/vector work, and reviewers pair on high-risk query/transaction code. |
| Sprint 1 PRs conflict with Sprint 2 branches | Merge-base or touched files overlap | Rebase only the affected short-lived branch; preserve active ownership. Source/dataset work is consumed through fixture contracts, not a global branch dependency. |
| Source permission review is unfinished | PR #47 still unapproved Jul 22 | Demonstrate the complete pipeline with the committed/generated permission-safe clean fixture and label it as test material; do not upload unapproved Instructor content. |

## 12. Final clean-environment demo path

1. Checkout current `dev`; copy the documented environment examples.
2. Set deterministic embedding/completion providers, 1,536 dimensions, top-k 5,
   threshold 0.70, PDF storage root, and 10 MiB upload limit.
3. Start infrastructure, migrate, and seed using the repository commands. Use
   #28's fresh-seed entry point if it has landed; otherwise execute the same
   documented commands directly without waiting on that issue.
4. Start server/client and verify health/readiness and Swagger.
5. Sign in as the seeded Instructor and upload the approved or explicitly
   permission-safe Gate 2 clean PDF to Python Programming.
6. Show processing transition, extracted length, chunk count, and retrievable
   status.
7. Seed/upload the hidden-course adversarial source only through the test harness;
   do not grant the Student hidden-course membership.
8. Sign in as `student1@morshid.demo`, create a Python session, ask the locked
   conceptual question, and show cited grounded guidance and excerpt.
9. Refresh and show persisted session/messages/citations.
10. Run/show the adversarial isolation and insufficient-evidence checks: no
    hidden result, provider context, citation, or response text.
11. Run Gate 2 tests and `npm run check`; record commit, mode, source hash/title,
    threshold, pass/fail, and known limitations.

## 13. Pre-publication planning audit

This plan was checked before GitHub publication:

- **Gate 2 completeness:** Upload, processing, chunks, embeddings, retrieval,
  threshold, private chat, completion, persistence, citations, UI, clean reset,
  and isolation proof all have an owner and executable task.
- **Cross-course security:** Course filtering is a mandatory database/repository
  invariant; tests inspect results, provider input, citations, and response.
- **Existing implementation assumptions:** The plan explicitly accounts for the
  missing chunk/retrieval/citation tables and disconnected role shells.
- **Carryover:** Relevant Sprint 1 work is represented once and is not a global
  dependency. Closed issues with open PRs are not treated as delivered.
- **Capacity/review:** High-risk seams are owned/reviewed by the strongest
  developers; Ebram has bounded learning work and named support; frontend,
  backend, RAG, tests, and integration start in parallel.
- **Task size/testability:** Each task has a narrow outcome, independent tests or
  mocked-contract start, due date, and one primary owner/reviewer.
- **Scope:** No DOCX/OCR, advanced retrieval, review workflow, analytics,
  Arabic/RTL, SSO, or full Sprint 3 tutoring policy entered the commitment.
- **Fallback integrity:** Compression removes streaming/live-provider/polish
  before any part of the protected Gate 2 loop.

## 14. GitHub realization

**Project:** [Morshid P0 - Sprint 2](https://github.com/users/MahmoudAhmed184/projects/2)  
**Milestone:** [Sprint 2 - Gate 2](https://github.com/MahmoudAhmed184/Morshid/milestone/2)  
**Labels:** `sprint:2`, `priority:p0`, `type:story`, `type:task`, and
`carryover:sprint-1`

### Published stories and native child tasks

| Plan story | GitHub story | Native child tasks |
|---|---|---|
| S2-1 | [#71 — Instructor prepares a retrievable Python PDF](https://github.com/MahmoudAhmed184/Morshid/issues/71) | #76-#80 |
| S2-2 | [#72 — Course-scoped retrieval prevents cross-course leakage](https://github.com/MahmoudAhmed184/Morshid/issues/72) | #81-#83 |
| S2-3 | [#73 — Student owns a private persisted course chat](https://github.com/MahmoudAhmed184/Morshid/issues/73) | #84-#86 |
| S2-4 | [#74 — Student receives persisted grounded guidance with citations](https://github.com/MahmoudAhmed184/Morshid/issues/74) | #87-#89 |
| S2-5 | [#75 — Gate 2 is repeatable and proves course isolation](https://github.com/MahmoudAhmed184/Morshid/issues/75) | #90-#91 |

| Plan task | GitHub issue | Plan task | GitHub issue |
|---|---|---|---|
| S2-1.1 | [#76](https://github.com/MahmoudAhmed184/Morshid/issues/76) | S2-1.2 | [#77](https://github.com/MahmoudAhmed184/Morshid/issues/77) |
| S2-1.3 | [#78](https://github.com/MahmoudAhmed184/Morshid/issues/78) | S2-1.4 | [#79](https://github.com/MahmoudAhmed184/Morshid/issues/79) |
| S2-1.5 | [#80](https://github.com/MahmoudAhmed184/Morshid/issues/80) | S2-2.1 | [#81](https://github.com/MahmoudAhmed184/Morshid/issues/81) |
| S2-2.2 | [#82](https://github.com/MahmoudAhmed184/Morshid/issues/82) | S2-2.3 | [#83](https://github.com/MahmoudAhmed184/Morshid/issues/83) |
| S2-3.1 | [#84](https://github.com/MahmoudAhmed184/Morshid/issues/84) | S2-3.2 | [#85](https://github.com/MahmoudAhmed184/Morshid/issues/85) |
| S2-3.3 | [#86](https://github.com/MahmoudAhmed184/Morshid/issues/86) | S2-4.1 | [#87](https://github.com/MahmoudAhmed184/Morshid/issues/87) |
| S2-4.2 | [#88](https://github.com/MahmoudAhmed184/Morshid/issues/88) | S2-4.3 | [#89](https://github.com/MahmoudAhmed184/Morshid/issues/89) |
| S2-5.1 | [#90](https://github.com/MahmoudAhmed184/Morshid/issues/90) | S2-5.2 | [#91](https://github.com/MahmoudAhmed184/Morshid/issues/91) |

Every story and task is assigned to one valid repository collaborator, has one
named peer reviewer, belongs to the Sprint 2 milestone, and carries P0/Sprint 2
metadata. Ready items carry `ready-for-agent`; integration items remain Backlog
without being mislabeled Blocked.

### Visible carryover represented once

| Project item | Why it is present | Project workflow |
|---|---|---|
| [#28 — Fresh-seed demo script](https://github.com/MahmoudAhmed184/Morshid/issues/28) | The script is absent on `dev` and supports clean rehearsal, but documented commands allow Sprint 2 work to proceed. | Ready |
| [#30 — Sprint 1 acceptance/security tests](https://github.com/MahmoudAhmed184/Morshid/issues/30) | Represents active PR #70 once; the PR itself is not a second capacity item. | Review |
| [PR #47 — Python PDF source plan](https://github.com/MahmoudAhmed184/Morshid/pull/47) | The source files/permission plan are still unreviewed even though issue #33 is closed. | Review |
| [PR #48 — Golden dataset v1](https://github.com/MahmoudAhmed184/Morshid/pull/48) | The dataset document is still unreviewed even though issue #34 is closed. | Review |

These four items keep their original Sprint 1 identity/milestone and the
`carryover:sprint-1` label. PR #58 and PR #60 remain outside the Sprint 2 project
because their requested changes are independent hardening, not Gate 2
prerequisites.

### Project field model

The user-owned Project is public, repository-linked, and uses:

- `Workflow`: Backlog, Ready, In Progress, Blocked, Review, QA, Done.
- `Workstream`: Ingestion, Retrieval/Embeddings, Student Chat, Grounded
  Chat/Citations, Gate 2/QA, Sprint 1 Carryover.
- `Start Date` and `Due Date` on every committed/carryover item.
- `Owner Role`: Product/UX, NestJS, AI service, Ingestion/evaluation, QA/DevOps.
- `Priority`: every item is P0.
- `Peer Reviewer`: one named developer on every item.
- Built-in assignee, labels, milestone, native parent issue, and sub-issue
  progress fields.

Project description and README state the Gate 2 goal, link this source plan, and
reserve Blocked for a real unresolved condition.

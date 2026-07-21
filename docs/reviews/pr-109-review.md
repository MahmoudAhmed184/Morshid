# PR #109 review — issue #78 material processing

## Review context

- **PR:** #109, `feat(material-processing): extract, chunk, embed, and transition material status`
- **Issue/spec:** GitHub issue #78 (`S2-1.3`) and `docs/sprint-2-plan.md:105-134,194-231`
- **Reviewed HEAD:** `1ef7a9a0f185fc66c00e77a6135f5de48012b312`
- **Fixed point / merge-base:** `origin/dev` at `c8c17bc4f9ee54591c3d5f200bb73af720dcb080`
- **Range:** `git diff origin/dev...HEAD`
- **Net diff:** 13 files, 1,303 additions. The merge from `origin/dev` left six implementation files, five unit-test files, `server/package.json`, and `package-lock.json` in the range.
- **Commits in range:** `1ef7a9a`, `535dc2d`, `f2e40b2`, `cc4eb5b`, `fb03d87`, `2b8a86d`, `c6da9ef`, `a929619`, `a9fcfe4`, `fde5e7f`, `423827a`, and `21e1e03`.
- **Important merge context:** newer dependent work already on `origin/dev` supplies the registered production processing pipeline. The PR's surviving implementation files are parallel versions, not the classes used by the final Nest application. Spec compliance was therefore checked against final-HEAD production behavior, while attribution to this PR is called out explicitly.

Standards sources were `AGENTS.md`, `CONTRIBUTING.md`, the repository guidelines supplied with the task, and the relevant NestJS rules `arch-feature-modules`, `arch-module-sharing`, `error-handle-async-errors`, `db-use-transactions`, `devops-use-logging`, `devops-graceful-shutdown`, `perf-async-hooks`, and `test-use-testing-module`.

Validation available to this review:

- `npm run check` passed at the merged HEAD before review, as reported by the coordinating task.
- `git diff --check origin/dev...HEAD` passed.
- The focused current unit command covering the surviving parser, normalizer, chunker, repository, and audit specs passed: 6 suites / 37 tests.
- `npm audit --workspace server --omit=dev --audit-level=high` reported 0 production vulnerabilities.
- Full E2E was not rerun by the coordinator during this review. Existing current processing E2E coverage was inspected directly.

## Executive verdict

**Request changes.** The final tree contains a mostly functioning issue #78 pipeline, but the net PR does not wire that pipeline: its substantive additions are dead duplicates of implementations inherited from `origin/dev`. That is a merge-resolution blocker because tests can pass while exercising code that production never resolves.

Final-HEAD behavior also has two high-impact spec defects: required terminal audit events can be permanently lost after status commits, and the registered chunker can produce only 199 shared characters where the spec requires a 200-character overlap. Safe terminal details and several issue-mandated validation cases are partial. The registered scheduler also lacks complete graceful-shutdown handling.

## Standards

### ST-1 — Blocker — the merged PR leaves an orphaned duplicate processing pipeline

**Classification:** documented architecture concern plus judgment-call **Duplicated Code**, **Speculative Generality**, and **Shotgun Surgery**.

**Evidence:**

- `server/src/modules/materials/materials.module.ts:8-27,39-63` registers `MaterialProcessingService`, `MaterialTextChunker`, `PdfJsTextExtractor`, `MaterialsRepository`, and their active adapters.
- It does not import or register the PR's `MaterialProcessingAuditService` (`server/src/modules/materials/material-processing.audit.service.ts:22-102`), `PrismaMaterialProcessingRepository` (`server/src/modules/materials/material-processing.repository.ts:46-220`), or `PdfTextExtractor` (`server/src/modules/materials/pdf-text.extractor.ts:28-75`).
- Fixed-string import searches find `chunkNormalizedText` (`server/src/modules/materials/deterministic-text-chunker.ts:1-67`) and `normalizeExtractedText` (`server/src/modules/materials/text-normalizer.ts:1-11`) only in their own specs. The other new classes are referenced only by one another and their specs.
- The active twins are `server/src/modules/materials/material-text-chunker.ts:3-90`, `server/src/modules/materials/pdf-text-extractor.ts:4-92`, `server/src/modules/materials/materials.repository.ts:200-414`, and `server/src/modules/materials/material-processing.service.ts:157-181`.

**Impact:** approximately one thousand source/test lines do not affect runtime behavior. A future maintainer can fix or test the wrong implementation, and the green unit suites give false confidence about application wiring. This conflicts with feature-module encapsulation and the Nest module-sharing rule to avoid duplicate providers/implementations.

**Recommended fix:** choose one production implementation. Given the merge state, remove the orphan files and port only proven improvements (safe terminal messages and stronger chunk tests) into the registered hyphenated stack. Add a Nest module-resolution test that obtains the processing service, repository, extractor token, chunker, and scheduler from `MaterialsModule`.

### ST-2 — High — final-HEAD background processing is not shut down gracefully

**Classification:** documented NestJS lifecycle violation; this is a final-system integration finding inherited from `origin/dev`, not a line added by the residual 13-file diff.

**Evidence:**

- `server/src/main.ts:8-20` never calls `app.enableShutdownHooks()`, so ordinary `SIGTERM`/`SIGINT` does not activate Nest lifecycle cleanup.
- `server/src/modules/materials/material-processing.scheduler.ts:47-57` clears future timers in `onModuleDestroy()` but returns immediately.
- `server/src/modules/materials/material-processing.scheduler.ts:78-89` launches `drainOnce()` with `void`, and no promise for the active drain is retained or awaited. `drainRunning` is only a boolean (`:27,97-130`).
- The existing shutdown tests at `server/src/modules/materials/material-processing.scheduler.spec.ts:95-127` cover pending wakes and a delayed command query, but not an already-running `processMaterial()` call or signal-driven shutdown.

**Impact:** deployment termination can cut off extraction, embedding, or terminal persistence while providers/database connections are closing. The durable command may recover after lease expiry, but shutdown is not graceful and work can be needlessly repeated after a five-minute lease.

**Recommended fix:** enable Nest shutdown hooks in `main.ts`; retain the active drain promise; make the lifecycle hook async and await in-flight processing with a bounded timeout; prevent new in-memory drains once stopping. Add an app-close/signal-oriented test with a deferred `processMaterial()` and assert cleanup waits for it.

### ST-3 — Medium — the alternate extractor lets cleanup errors replace its safe result/error

**Classification:** documented async error-handling violation.

**Evidence:** `server/src/modules/materials/pdf-text.extractor.ts:61-64` awaits `parser.destroy()` in `finally` without handling rejection. A destroy rejection therefore replaces either the successful extraction result or the mapped `SafeMaterialProcessingError`. The test helper explicitly supports `destroyFailure` at `server/src/modules/materials/pdf-text.extractor.spec.ts:10-28`, but no test uses it. The registered extractor already contains the safer pattern at `server/src/modules/materials/pdf-text-extractor.ts:87-90`.

**Impact:** if this alternate provider were wired, a dependency stack/path could escape the safe-error boundary and a valid extraction could be reported as failed merely because cleanup rejected.

**Recommended fix:** deleting the orphan extractor resolves this finding. If it is retained, contain cleanup rejection, log only a generic safe message, preserve the primary result/error, and test cleanup rejection after both success and parser failure.

### ST-4 — Medium — an unused parser duplicates native/runtime dependencies

**Classification:** dependency hygiene and judgment-call **Speculative Generality**.

**Evidence:** `server/package.json:55-56` installs both active `pdfjs-dist@6` and `pdf-parse`. `package-lock.json:15704-15945` shows that `pdf-parse` brings its own `pdfjs-dist@5.4.296` and `@napi-rs/canvas@0.1.80`, alongside the active `pdfjs-dist@6.1.200` / canvas 1.x stack. `npm ls pdf-parse pdfjs-dist @napi-rs/canvas --workspace server --all` confirms both trees. The only `pdf-parse` import is the unregistered extractor at `server/src/modules/materials/pdf-text.extractor.ts:2`.

**Impact:** installation size, native platform exposure, supply-chain surface, and parser-version divergence increase without any production behavior.

**Recommended fix:** remove `pdf-parse` from `server/package.json` and regenerate `package-lock.json` when removing the orphan extractor. If deliberately switching parsers, remove `pdfjs-dist` and wire/test one parser stack rather than shipping two.

### ST-5 — Low — the new tests never validate Nest provider/module assembly

**Classification:** Nest testing-guidance concern, not a formatter/linter failure.

**Evidence:** `server/src/modules/materials/material-processing.audit.service.spec.ts:14-22`, `server/src/modules/materials/material-processing.repository.spec.ts:13-38`, and `server/src/modules/materials/pdf-text.extractor.spec.ts:10-39` instantiate providers directly. The Nest `test-use-testing-module` rule recommends compiling providers through `Test.createTestingModule`; none of the surviving tests asks the container to resolve the new providers from `MaterialsModule`.

**Impact:** dependency behavior is unit-tested in isolation, but the exact defect in ST-1—nothing is registered—cannot fail these tests.

**Recommended fix:** keep direct construction only for genuinely pure units. Add at least one container/module assembly test for the production material-processing graph and use Nest's testing module when a test is intended to validate provider injection or overrides.

The proposed filename finding was not confirmed: dotted Nest suffixes are established throughout this repository (for example `student-chat.audit.service.ts`), so they are not treated as a kebab-case violation.

### Standards validation gaps

- No module-assembly test proves the production pipeline tokens resolve to the reviewed implementations.
- No cleanup-rejection test covers the alternate parser despite support in its fixture.
- No test proves a running processing job drains before application shutdown.

**Standards summary: 5 confirmed findings; worst is the blocker-level orphaned duplicate pipeline that leaves the net PR disconnected from production.**

## Spec

### SP-1 — High — terminal status can commit while its mandatory audit event is lost forever

**Requirement:** issue #78 requires ready/warning/failed audit events; `docs/sprint-2-plan.md:209-210` requires upload/ready/warning/failure events to be auditable.

**Evidence:**

- `server/src/modules/materials/materials.repository.ts:263-295` commits command deletion, terminal status, counts, replacement chunks, and attempt cleanup in one transaction.
- Only afterward does `server/src/modules/materials/material-processing.service.ts:112-120` call `recordProcessingEvent()`.
- `server/src/modules/materials/material-processing.service.ts:169-180` catches an audit-write failure, logs a generic message, and returns. The terminal command is already deleted, so nothing retries the missing event.
- The PR's alternate audit service has the same best-effort behavior at `server/src/modules/materials/material-processing.audit.service.ts:61-100`.

**Impact:** a READY, WARNING, or FAILED material may have no corresponding audit record, directly violating the auditable terminal-state requirement. This is permanent, not merely delayed, and makes incident reconstruction incomplete.

**Recommended fix:** persist the terminal audit record in the same database transaction as the terminal material/chunk transition (the current `AuditService.recordEvent` already accepts a transaction database), or write a durable outbox record in that transaction and retry delivery. Add failure-injection tests proving there is no committed terminal state without its event.

### SP-2 — High — the registered chunker can produce only 199 characters of overlap

**Requirement:** issue #78 and `docs/sprint-2-plan.md:121-124` require a 200-character overlap.

**Evidence:**

- `server/src/modules/materials/material-text-chunker.ts:44` trims emitted content.
- `server/src/modules/materials/material-text-chunker.ts:54-58` computes the next source offset from the untrimmed `end` and then skips whitespace.
- `server/src/modules/materials/material-text-chunker.ts:74-78` includes the preferred separator in `end`.
- Independently reproduced with `"a".repeat(1000) + "  " + "b".repeat(600)`: normalization reduces the separator to one space; chunk 0 is 1,000 `a` characters, while chunk 1 begins with 199 `a` characters plus the separator. Adjacent emitted contents share 199, not 200, characters.
- The registered implementation's test at `server/src/modules/materials/material-text-chunker.spec.ts:17-38` checks repeatability, maximum size, indices, and that the constant equals 200, but never checks the actual shared content. The exact overlap assertions at `server/src/modules/materials/deterministic-text-chunker.spec.ts:33-62` target the orphan implementation.

**Impact:** boundary context is systematically short around some paragraph/whitespace splits, so the core deterministic chunking contract is false even though the constant and dead tests pass.

**Recommended fix:** track the emitted, right-trimmed content boundary; choose paragraph boundaries at the separator start; compute `nextStart = emittedEnd - 200`; and do not skip characters that belong to the overlap. Add registered-chunker tests for spaces, newlines, and paragraph separators that assert exactly 200 shared source/content characters.

### SP-3 — Medium — visible terminal details and failure counts are incomplete

**Requirement:** issue #78 requires extracted length/count updates and safe error text; `docs/sprint-2-plan.md:106-110,115-118` requires a useful image-only message and persisted/visible safe status information.

**Evidence:**

- WARNING details such as `PARTIAL_PAGE_TEXT` are generated at `server/src/modules/materials/pdf-text-extractor.ts:71-85` and included only in audit metadata at `server/src/modules/materials/material-processing.service.ts:116-120`.
- `server/src/modules/materials/materials.repository.ts:278-284` always persists `errorMessage: null` for both READY and WARNING, so the warning concern is not visible through the status API.
- `server/src/modules/materials/materials.repository.ts:326-332` always resets `extractedTextLength` to `null` on FAILED—even when extraction succeeded and embedding/finalization later failed—and persists a machine reason such as `NO_EXTRACTABLE_TEXT` as `errorMessage`.
- The raw field is surfaced unchanged at `server/src/modules/materials/materials.dto.ts:124-133`. The PR's orphan error map contains useful safe text at `server/src/modules/materials/material-processing.errors.ts:14-24`, but production does not use it.

**Impact:** instructors cannot learn what a WARNING means, image-only/parser/provider failures expose terse internal codes instead of useful safe text, and a known extracted length is discarded after downstream failure. The material record is safe but not fully truthful or useful.

**Recommended fix:** keep machine reason/warning codes in typed domain/audit metadata, map them to stable safe user-facing messages for `errorMessage`, persist a warning explanation, and pass the known normalized length into failure finalization after extraction has succeeded. Add API/E2E assertions for WARNING and for an embedding failure that retains known length without exposing text/provider payloads.

### SP-4 — High — issue fulfillment is accidental from the base, not delivered by the net PR

**Requirement:** the PR claims to implement issue #78's production extraction-to-terminal-state flow.

**Evidence:** `server/src/modules/materials/materials.module.ts:8-27,39-63` wires only the implementations inherited from `origin/dev`; the new dotted extractor/repository/audit service and standalone normalizer/chunker have no production consumers. `server/package.json:55-56` nevertheless retains the alternate parser dependency. All behavioral rows marked "via origin/dev" in the matrix below would remain true if the PR's six implementation files and their tests were removed.

**Impact:** the final application happens to implement much of the issue, but PR-specific tests do not validate that application. The PR body is stale about which parser, scheduler, repository, and tests are authoritative, making review and later maintenance unreliable.

**Recommended fix:** reconcile the branch rather than retaining both designs: remove the inactive stack and dependency, port the fixes and issue-matrix tests into the registered code, rerun the current production unit/E2E suites, and update the PR description to describe the actual final implementation.

### Issue #78 requirement matrix

| Requirement | Status | Final-HEAD evidence and attribution |
|---|---|---|
| Parse clean text PDFs; no OCR; image-only content fails | Fulfilled | Via `origin/dev`: `server/src/modules/materials/pdf-text-extractor.ts:45-92`; production fixtures at `server/test/material-processing.e2e-spec.ts:278-307`. |
| Deterministically normalize line endings and whitespace | Fulfilled | Via `origin/dev`: `server/src/modules/materials/material-text-chunker.ts:13-24`; active test `material-text-chunker.spec.ts:10-14`. |
| Chunk toward 1,200 characters | Fulfilled | Via `origin/dev`: `server/src/modules/materials/material-text-chunker.ts:3,35-43`. |
| Maintain 200-character overlap | Partial | Registered implementation is wrong for whitespace/paragraph boundaries; see SP-2. |
| Prefer paragraph boundaries | Fulfilled | Via `origin/dev`: `server/src/modules/materials/material-text-chunker.ts:65-81`. Exact boundary validation exists only against the orphan implementation. |
| Stable zero-based indices and no empty chunks | Fulfilled | Via `origin/dev`: `server/src/modules/materials/material-text-chunker.ts:44-47`; active assertions at `material-text-chunker.spec.ts:27-30`. |
| Use configured embedding provider for every chunk | Fulfilled | Via `origin/dev`: validated config/factory at `server/src/modules/config/env.schema.ts:33-36` and `server/src/modules/embedding/embedding-provider.factory.ts:9-29`; invocation at `material-chunk-embedding.service.ts:53-62`. |
| Persist embedding model and vector | Fulfilled | Via `origin/dev`: `server/src/modules/materials/materials.repository.ts:389-407`. |
| Lock/reject vectors outside 1,536 dimensions | Fulfilled | Via `origin/dev`: `server/src/modules/embedding/validated-embedding.provider.ts:34-47`; database shape at `server/prisma/schema.prisma:210-223`. |
| Update extracted length and chunk count in a controlled flow | Partial | READY/WARNING transition atomically at `materials.repository.ts:255-295`; FAILED discards known length at `:304-340` (SP-3). |
| READY for clean success, WARNING only for usable concerns, FAILED for empty/parser/provider/storage failures | Fulfilled | Via `origin/dev`: orchestration at `material-processing.service.ts:78-124`; usable warning generation at `pdf-text-extractor.ts:71-85`. |
| Persist and expose safe, useful terminal information | Partial | No payload leakage, but warning detail is lost and raw failure codes are returned; see SP-3. |
| Idempotent processing; never replace an already-ready source accidentally | Fulfilled | Via `origin/dev`: guarded leased claim at `materials.repository.ts:200-252`; stale/concurrent E2E at `material-processing.e2e-spec.ts:366-437`. |
| Emit ready/warning/failed audit events | Partial | Success paths attempt events, but an audit failure after terminal commit is never retried; see SP-1. |
| Never allow incomplete/failed/deleted content into retrieval | Fulfilled | Via `origin/dev`: retrieval filter at `server/src/modules/retrieval/course-retrieval.repository.ts:88-95`; failure cleanup transaction at `materials.repository.ts:304-340`. |
| No OCR, manual warning acceptance, queue platform, or semantic chunking | Fulfilled | No prohibited user-facing production path is present. The database-backed command poller is internal durability, not an added external queue platform. |
| Same PDF/config gives identical normalized text, chunks, indices, and vectors | Partial | Component determinism exists, but there is no active two-ingestion persisted-result comparison covering the whole pipeline. |
| Boundary and overlap validation | Missing | Exact assertions import the orphan `deterministic-text-chunker.ts`; the active test checks only maximum length and the overlap constant (`material-text-chunker.spec.ts:17-38`). |
| Short-text, repeated-whitespace, and empty validation | Partial | Active normalization/empty checks exist at `material-text-chunker.spec.ts:10-14`, and clean short text reaches production E2E, but active short-text chunk shape is not asserted as completely as the orphan tests. |
| Image-only, parser, provider, and storage failure validation | Fulfilled | Current E2E cases at `server/test/material-processing.e2e-spec.ts:278-345`. |
| Only fully persisted chunks produce READY/WARNING and correct counts | Partial | READY has production E2E at `material-processing.e2e-spec.ts:256-275`; WARNING has mocked service coverage at `server/src/modules/materials/material-processing.service.spec.ts:117-131`, but no production extraction/persistence/retrieval E2E. |
| Failure leaves no retrievable partial chunks | Fulfilled | Current E2E at `material-processing.e2e-spec.ts:309-364,479-498`. |
| Safe errors omit PDF text, secrets, and provider payload | Fulfilled | Current sentinel assertions at `material-processing.e2e-spec.ts:501-518`; production logs discard caught exception content. |
| `npm run check` and processing integration validation | Fulfilled | Canonical check passed at merged HEAD before review as reported. Current processing integration tests exist and were inspected; the coordinator additionally reran the focused unit subset (6 suites / 37 tests). |

### Spec validation gaps

- Exact active boundary/overlap assertions, including whitespace and paragraph separators.
- A full two-upload/two-ingestion comparison of normalized chunks, indices, embedding models, and persisted vectors under one configuration.
- Production WARNING extraction, persistence, API, retrieval eligibility, counts, safe warning detail, and audit E2E.
- Audit-write failure recovery/atomicity.
- Downstream failure after extraction proving known length is retained and no payload leaks.

**Spec summary: 4 confirmed findings; worst is that a terminal material state can commit while its mandatory audit event is permanently absent.**

## Finite fix list for the next agent

1. Remove the orphan extractor, normalizer, chunker, repository, audit/error stack and their isolated specs; remove `pdf-parse` and regenerate the lockfile. Port useful assertions/messages before deleting them.
2. Fix the registered `MaterialTextChunker` so emitted adjacent chunks preserve exactly 200 characters across whitespace/paragraph boundaries; add exact active boundary and overlap tests.
3. Make READY/WARNING/FAILED audit persistence atomic or durably retryable with terminal state changes; add audit-failure tests.
4. Persist safe, useful WARNING/FAILED text and retain known extracted length for failures after extraction, while keeping machine codes in typed/audit metadata and never exposing source/provider payloads.
5. Add active production-path validation for full-pipeline repeatability and WARNING persistence/retrieval/audit behavior.
6. Enable Nest shutdown hooks and await an in-flight material-processing drain during bounded graceful shutdown; add a deferred-job shutdown test.
7. Add a Nest module-resolution test for the final single material-processing graph, then rerun `npm run check` and the relevant server E2E suite.

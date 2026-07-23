# Issue #90 — Gate 2 end-to-end and adversarial isolation research

- **Research date:** July 23, 2026
- **Issue:** [#90 — Automate Gate 2 end-to-end and adversarial isolation path](https://github.com/MahmoudAhmed184/Morshid/issues/90)
**Scope:** NestJS/Jest E2E structure, Prisma-backed isolation, deterministic provider
spies, multipart upload, and authorization regression coverage.

## Recommendation

Implement one dedicated server E2E suite, tentatively
`server/test/gate-2.e2e-spec.ts`, plus a focused root command such as
`npm run test:gate2`. The suite should boot the real `AppModule`, use the real
HTTP controllers, authentication, PDF validation/extraction/chunking,
repositories, pgvector retrieval, grounded-chat orchestration, persistence, and
response presenters. Override only the environment-dependent seams:

- a unique disposable PostgreSQL database;
- a unique temporary local-PDF directory;
- Redis health with the repository's existing deterministic `PONG` fake;
- the background scheduler with a capturing scheduler, followed by an explicit
  call to the real `MaterialProcessingService`;
- a deterministic, validated 1,536-dimension embedding fake whose vectors make
  the intended similarity ordering mathematically explicit;
- a deterministic completion spy that records the exact authorized context and
  returns a stable result.

This is a better Gate 2 proof than merging the existing focused tests. It
crosses the production boundaries in one application while keeping scheduling,
network providers, runtime files, and prior database contents out of the
result.

## Why this shape follows current official guidance

Nest describes E2E tests as aggregate tests close to user interaction. Its
official pattern compiles a testing module, creates and initializes a Nest
application, sends requests through Supertest, closes the application in
`afterAll`, and uses `overrideProvider()` for alternate test implementations.
That is exactly the seam already used by Morshid's strongest E2E suites and
should remain the shape of Gate 2. See the official
[NestJS testing guide](https://docs.nestjs.com/fundamentals/testing).

Supertest accepts the Nest HTTP server directly and supports promises and
`async`/`await`. Its official multipart example chains `.field()` and
`.attach()`, so the authorized upload should use the same public HTTP contract
as a real Instructor request rather than invoking `MaterialsService` directly.
See the official
[Supertest README](https://github.com/forwardemail/supertest/blob/master/README.md#example)
and Nest's
[file-upload documentation](https://docs.nestjs.com/techniques/file-upload).

Jest mock functions are explicitly spies: `mock.calls` records every argument,
while `mockImplementation`, `mockResolvedValue`, and their one-shot variants
provide deterministic behavior. Use typed `jest.MockedFunction` spies for
`EmbeddingProvider.embedBatch` and `CompletionProvider.complete`, and clear call
history without accidentally removing the stable implementation. See Jest's
official [mock function API](https://jestjs.io/docs/mock-function-api).

Prisma recommends running integration tests against a dedicated test database,
then migrating, testing, cleaning, and terminating it. It also warns that
manual `deleteMany` cleanup must respect relation order and scales less well
than environment-level isolation. Morshid's existing
`setUpDisposableDatabase()` improves on the example for this suite: it creates a
UUID-suffixed database, applies every committed migration, returns a dedicated
`PrismaService`, and force-drops the database during disposal. Reuse it instead
of wrapping the HTTP scenario in a transaction: the application performs work
through its own injected Prisma client and asynchronous service boundaries, so
a test-owned transaction would not automatically contain every request. See
Prisma's official
[integration-testing guide](https://docs.prisma.io/docs/orm/prisma-client/testing/integration-testing).

Use `mkdtemp()` under the operating-system temporary directory and remove the
exact returned path in teardown. Node documents `mkdtemp()` as creating a unique
directory by appending random characters to the supplied prefix. See the
[Node.js 24 filesystem API](https://nodejs.org/docs/latest-v24.x/api/fs.html#fspromisesmkdtempprefix-options).

The one-command target should select the exact Gate 2 file rather than a loose
regular expression. Jest 30.4 documents `--runTestsByPath` for exact path
selection and `--runInBand` for serial execution. A suitable implementation is
equivalent to:

```text
npm run test:e2e --workspace server -- --runInBand --runTestsByPath test/gate-2.e2e-spec.ts
```

See the official [Jest CLI reference](https://jestjs.io/docs/cli).

## Repository-specific starting point

The necessary production behavior is already present on `dev`; #90 should
compose it rather than duplicate it:

| Existing seam | Reuse in Gate 2 |
|---|---|
| `server/test/support/disposable-database.ts` | Fresh migrated database per suite and force-drop teardown. |
| `server/test/material-processing.e2e-spec.ts` | Proven pattern for temporary real storage, real PDF extraction, a capturing scheduler, explicit production processing, and safe audit assertions. |
| `server/test/fixtures/pdf-fixtures.ts` | `cleanTextPdf()` creates a small permission-safe, text-extractable multipart buffer without relying on private course material. |
| `server/test/grounded-chat.e2e-spec.ts` | Proven full `AppModule` HTTP setup, typed provider spies, parameterized hidden-course vector fixture, persistence inspection, and reload response assertions. |
| `server/test/retrieval-readiness-isolation.e2e-spec.ts` | Proven query-level hidden-course exclusion and exact threshold/top-k assertions. |
| `server/src/modules/retrieval/course-retrieval.repository.ts` | The production SQL makes `material.course_id`, READY/WARNING, non-deleted, positive extraction/chunk counts, threshold, ordering, and limit developer-owned predicates. |
| `server/src/modules/student-chat/student-chat-message.presenter.ts` | Reloaded history renders persisted citations only when the material, evidence rows, and backing file remain available. |

The current gap is integration, not another unit seam. No existing suite starts
with an authorized HTTP upload and ends with reloaded cited chat history while
the same scenario proves a deliberately stronger hidden-course vector absent
from the retrieval service, completion input, persistence, API output, and
assistant text.

## Deterministic fixture design

Use the locked SCN-001 prompt already documented in
`docs/demo-scenario-mapping.md`:

> What is the difference between a Python list and a dictionary, and when would
> I use each?

The uploaded PDF should contain concise list/dictionary evidence plus a unique
allowed sentinel. The hidden material should contain unique hidden values for
all identifiers visible to the system: title, content sentinel, material ID,
chunk ID, storage path, and embedding model.

Do not rely on the production hash-based deterministic embedding provider to
produce semantic relevance. It is stable but intentionally not a semantic
model, so an unrelated hash could land above or below `0.70`. Instead, use a
small test provider that returns unit vectors based on named fixture inputs:

- locked question: a basis query vector;
- uploaded allowed chunk: similarity safely above `0.70`, for example `0.90`;
- hidden chunk inserted by the fixture: a deliberately more attractive
  similarity, for example `0.99` or `1.00`;
- insufficient-evidence question: a vector whose similarity to all eligible
  Python chunks is below `0.70`.

Every vector must contain exactly 1,536 finite components, return one vector per
input in input order, and carry a stable model name. Prefer constructing a few
unit vectors analytically over large literal arrays. Record calls so the test
can also prove the uploaded chunk and questions passed through the provider.

The hidden fixture may use the existing supported test pattern:
`prisma.material.create()` followed by parameterized
`prisma.$executeRaw(Prisma.sql\`...\`)` for the unsupported pgvector column.
Give it a real backing file through the isolated `PdfStorage` so availability
cannot explain its exclusion. Explicitly assert that the Student has no active
membership in `HIDDEN-ISOLATION`; the course predicate, not file status,
similarity, or membership ambiguity, must be the only reason it is absent.

Use the production PDF upload path for the allowed material:

```ts
request(app.getHttpServer())
  .post(`/api/v1/courses/${pythonCourseId}/materials`)
  .set('Authorization', `Bearer ${instructorToken}`)
  .field('title', allowedTitle)
  .attach('file', cleanTextPdf(allowedText), {
    filename: 'gate-2-python.pdf',
    contentType: 'application/pdf',
  })
```

The capturing scheduler should prove exactly that material was scheduled.
Calling the real `MaterialProcessingService.processMaterial(materialId)` then
keeps extraction, normalization, chunking, validated embeddings, terminal
transaction, and audit behavior production-real without racing a timer. Read
the terminal status back over the HTTP status endpoint.

## Required assertion matrix

### 1. Upload and processing

Assert the upload response is `201` and initially `PROCESSING`. After production
processing, assert the status endpoint reports `READY` (or intentionally
documented `WARNING`), positive extracted length, positive chunk count, and no
unsafe error. Query persisted chunks and assert:

- count equals `material.chunkCount`;
- zero-based indices are ordered and non-empty;
- every vector has 1,536 finite components;
- every row carries the deterministic test model.

Assert both `material.upload_succeeded` and the exact terminal processing audit
for the same actor, course, and material, including safe count/length metadata.

### 2. Adversarial retrieval and grounded turn

After inserting the more-attractive hidden row, first call the real
`RetrievalService` with the locked question and assert that its result contains
the uploaded material and no hidden identifier or sentinel. This directly names
the query boundary.

Then create a Python session and send the locked question over HTTP as
`student1@morshid.demo`. Assert:

- exactly one completion call;
- its only top-level inputs are `studentQuestion` and `context`;
- context contains the allowed uploaded chunk and contains no hidden value;
- the HTTP assistant response is completed and `COURSE_GROUNDED`;
- its citations/evidence identify the allowed material/chunk and show an
  excerpt;
- persisted Student and assistant messages have sequences 1 and 2;
- persisted `MessageRetrieval` rows reference only allowed chunks in rank order;
- persisted `MessageCitation` rows reference only allowed materials in citation
  order;
- provider/model/prompt metadata is the expected stable fake result;
- the persisted assistant text contains no hidden sentinel.

Finally call `GET .../messages` as a fresh HTTP request and assert the two
messages, response identity, evidence, citation label, excerpt, and source
availability are recovered. This is the issue's reload proof; checking the POST
response alone is insufficient.

Build one serialized object from all observable sinks—retrieval result,
completion request, POST response, database retrievals/citations/assistant row,
and GET history—and reject every hidden sentinel and identifier. Keep the
individual typed assertions too: a single string scan is useful defense in
depth but should not replace structural checks.

### 3. Insufficient evidence

Use an eligible same-course source whose computed similarity is explicitly
below the configured threshold; an empty corpus proves absence, not threshold
handling. Clear the completion spy, send the unsupported question, and assert:

- completion was not called;
- the assistant message is `BLOCKED`;
- `guidanceLabel` is `GENERAL_NOT_FOUND`;
- `errorCode` is `GROUNDING_INSUFFICIENT_EVIDENCE`;
- citations are empty;
- persisted retrieval and citation counts for that assistant message are zero;
- reloaded history preserves the same safe blocked result.

## Security rationale

OWASP
[API1:2023 Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
states that every API operation receiving an object identifier must validate
permission for the requested object and explicitly recommends tests for the
authorization mechanism. The
[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
adds deny-by-default, permission validation on every request, safe failure,
logging, and automated unit/integration tests. The
[OWASP IDOR testing guide](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
recommends using at least two users/objects and substituting references to
objects the active user must not access. The
[Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html)
also calls out the data dimension in addition to feature and role, and asks
integration failures to identify the exact authorization combination.

For Morshid, the protected object is not only a route-visible course/session.
It is also every hidden-course material, chunk, vector, excerpt, provider
context entry, retrieval row, citation row, response field, and persisted
assistant character. Therefore #90 is complete only when the negative assertion
follows the value across all those sinks. A 403/404-only route test, or a
query-result-only test, does not establish adversarial isolation for the
grounded response.

## Isolation, teardown, and failure diagnostics

Use optional handles and teardown in `try/finally`:

1. close the Nest application if it initialized;
2. dispose the disposable database even if application close fails;
3. remove only the exact temporary storage directory even if either prior step
   fails.

Avoid broad shared-table cleanup as the primary isolation mechanism. A unique
database and storage root make reruns independent and allow the full suite to
run alongside other E2E files. Reset spy calls and any in-memory scheduler state
between scenarios.

Name the two tests after their observable stages, for example:

- `uploads, processes, grounds, persists, and reloads without hidden-course leakage`
- `blocks below-threshold evidence without invoking completion`

Inside the long happy-path test, keep short stage helpers such as
`uploadGateMaterial`, `processGateMaterial`, `seedHiddenAdversary`,
`sendGroundedTurn`, `expectPersistedIsolation`, and `reloadHistory`. If extra
failure context is needed, a small `runGateStage(name, action)` wrapper can
rethrow with the stage name and the original error as `cause`. Do not catch and
replace Jest assertion details with a generic message.

## Validation and likely change chunks

Reasonable implementation commits are:

1. `test(server): add deterministic gate 2 fixture harness`
2. `test(server): prove gate 2 adversarial isolation`
3. `chore(test): add gate 2 verification command`

Run the targeted command twice from a clean test state, then run the complete
server E2E command and `npm run check`. The exact-file command should remain a
stable local/CI entry point; the full E2E command proves the new harness does not
interfere with neighboring suites.

No new production module, database migration, generated Prisma code, or client
behavior is indicated by the issue or by this research. A Nest generator is not
useful for this bespoke cross-module E2E fixture; existing production
controllers/providers should be composed through `@nestjs/testing` rather than
scaffolding a duplicate application.

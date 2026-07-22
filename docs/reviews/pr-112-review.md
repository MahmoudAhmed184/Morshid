# PR #112 review — issue #87 completion-provider seam

## Review context

- **PR:** #112, `feat(completion): add safe deterministic completion provider`
- **Issue/spec:** GitHub issue #87, Sprint 2 task `S2-4.1`, and
  `docs/sprint-2-plan.md:306-350`
- **PR claims/security rationale:** PR #112 body and
  `docs/completion-provider-security-notes.md`
- **Reviewed HEAD:** `6d7570a48d2c5b820016287c3016deb3e7d1d9c1`
- **Fixed point / merge-base:** `origin/dev` at
  `8ff854872d7f39afa5906239c3ba169679e60f4b`
- **Range:** `git diff origin/dev...HEAD`
- **Net diff:** 17 files, 1,694 additions; 10 implementation/config/docs files
  and 7 co-located unit-test files
- **Commits:** `6d7570a`, `486b838`, `554669c`, and `6654d7a`
- **Remote state during review:** PR open against `dev`; GitHub `validate` check
  passed in 3m03s at the reviewed HEAD.

Standards sources were `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, current
repository patterns, the complete review smell baseline, and the relevant
NestJS guidance for feature/module sharing, interface-token DI, async error and
lifecycle handling, TestingModule/external mocks, input/config validation, and
safe logging. Spec sources were issue #87, the Sprint 2 plan, the PR body, and
the checked-in security notes. Every changed hunk and the relevant `AppModule`,
configuration, module-export, and prospective consumer boundaries were
inspected.

## Executive verdict

**Request changes.** The overall shape is strong: the PR supplies a narrow
symbol-token interface, offline provider, fixed privacy-safe error codes,
validated configuration, deadline/cancellation racing, extensive focused
tests, and no network or secret requirement. Nest module registration and
provider selection are clean.

It is not safe to merge as written, however. Both review axes independently
found that request/result objects are validated and then read again. Stateful
accessors or proxies can therefore substitute unvalidated data, and a request
getter can make a raw private exception escape the promised fixed error model.
The supposedly strict envelope parser also accepts arbitrary JSON shapes. The
runtime provider path does not actually exercise the delimiter envelope, the
factory's claimed second timeout check is absent, and the contract has no input,
context, or output resource bounds.

Axis totals are kept separate: **Standards has 5 findings; its worst is HIGH
(validation bypass/private error escape). Spec has 4 findings; its worst is
HIGH (the same defect violates issue #87's explicit safe-malformed-result and
privacy requirements).**

## Standards

### ST-1 — High — hard violation: validated values are re-read from untrusted objects

`server/src/modules/completion/validated-completion.provider.ts:131-165`
validates live request and context-entry properties, but `:203-227` reads those
properties again while minimizing. Results are checked at `:168-180` and
re-read at `:183-194` when constructing the returned object. Accessors and
proxies can change between reads.

An executable probe returned result content `changed-after-validation` after
the getter first supplied `validated`. A `studentQuestion` getter that threw on
its second read escaped as raw `Error: raw-private-getter-error`, with no
`CompletionProviderError.code`. This violates the Nest security rule to
validate all input before processing and defeats the file's claimed sole safe
boundary.

**Fix:** copy allowed properties exactly once into inert plain data inside the
safe guard, validate that snapshot, and use only the snapshot thereafter. Reject
accessor properties/proxies, or contain every read and never re-read. Add
stateful-getter/proxy regression tests for both directions and assert only fixed
safe errors escape.

### ST-2 — Medium — hard violation: the strict envelope parser does not validate its schema

`server/src/modules/completion/grounded-completion-envelope.ts:61-76` verifies
markers and JSON syntax, then returns `JSON.parse(...) as
GroundedCompletionInput`. Properly delimited `null`, arrays, `{}`, and wrong
field types are all accepted. The review probe confirmed a delimited `null`
returns `null`, contradicting the comment at `:57-60` that the parser is
intentionally strict.

This violates the same Nest input-validation rule and makes the exported return
type false at runtime.

**Fix:** parse to `unknown`, validate the exact object/array/entry schema and
field constraints, then return a minimized plain object. Reuse one contract
schema rather than maintaining divergent request and envelope validation.

### ST-3 — Low — judgement call: Speculative Generality in the production adapter

`server/src/modules/completion/deterministic-completion.provider.ts:18-40,61-77`
adds `'fail'` and `'wait-until-aborted'` branches to an injectable production
class, while `completion-provider.factory.ts:35-37` says they are explicitly
test-only.

**Fix:** keep production behavior singular and use dedicated test fakes for
rejecting and non-cooperative adapters.

### ST-4 — Low — judgement call: Duplicated Code in text normalization

`server/src/modules/completion/deterministic-completion.provider.ts:80-82`
duplicates the NFKC/trim/whitespace-collapse implementation at
`server/src/modules/embedding/deterministic-embedding.provider.ts:11-13`.

**Fix:** if both contracts intentionally share semantics, extract a small
shared server text-normalization utility and pin it once. If their future
semantics differ, document that ownership and keep separate tests.

### ST-5 — Low — test teardown can leak global spies after a failed assertion

The global `AbortSignal.prototype` and Nest `Logger.prototype` spies in
`server/src/modules/completion/validated-completion.provider.spec.ts:352-373`
and `:415-446` are restored only at the end of successful test bodies. An
earlier rejection or assertion failure leaves them installed and can
contaminate later tests.

**Fix:** register restoration in `afterEach` or use `try/finally`/automatic Jest
restore configuration.

### Standards validation gaps

- No regression covers stateful getters, proxies, or mutation between
  validation and minimization.
- Envelope tests cover malformed JSON and forged markers but not valid JSON of
  the wrong runtime shape.
- The abort-listener test checks that some add/remove calls occurred, not that
  the exact listener installed by this operation was removed on every settle
  path.
- Cancellation and timeout are tested independently, but not a near-simultaneous
  race that pins classification of the first abort.
- Testing modules created in completion specs are not explicitly closed. The
  current providers own no Nest lifecycle resources, and `--detectOpenHandles`
  passed, but closing them would future-proof the tests.

**Standards summary: 5 findings (2 hard, 3 judgement/testing concerns); worst
is the HIGH runtime-validation bypass and raw private error escape. No DI token,
module export, startup-config, external-network mock, or production logging
violation was found.**

## Spec

### SP-1 — High — implemented wrong: malformed/accessor-backed requests and results bypass the safe boundary

Issue #87 requires empty/malformed/failing provider cases to be explicit and
safe, with private content absent from errors. The double reads at
`validated-completion.provider.ts:131-194,203-227` let a stateful result getter
pass validation and then return different or oversized private content; a
stateful request getter emits its raw private error. Snapshot and validate once,
as described in ST-1.

### SP-2 — Medium — missing/partial: the required untrusted-context envelope is not in the selected provider path

Issue validation requires instruction-like text to remain "delimited as data in
the provider request"; the plan requires "authorized delimited course context"
(`docs/sprint-2-plan.md:318-321`). The builder exists only at
`grounded-completion-envelope.ts:37-55` and its tests. The sole factory path
selects `DeterministicCompletionProvider`
(`completion-provider.factory.ts:13-14`), which consumes raw entries directly
at `deterministic-completion.provider.ts:43-50`. Tests therefore prove an
isolated helper, not the selected runtime boundary.

**Fix:** define the adapter-facing prepared prompt/envelope seam and make the
selected provider path consume it, or revise the contract/spec with explicit
rationale if delimiting applies only to future model-backed adapters. Add an
integration-level factory/provider test that spies on the actual adapter input.

### SP-3 — Medium — missing/partial: the safe contract has no request/context/output bounds

Issue #87 asks for a safe provider contract. The security notes acknowledge
that OWASP calls for limits (`docs/completion-provider-security-notes.md:21-24`)
but exclude context limits at `:114-118` without support from the issue or plan.
Request validation at `validated-completion.provider.ts:131-159` has no maximum
question/title/content length, entry count, or aggregate budget; result
validation at `:168-180` requires only nonblank output. A deadline cannot
protect synchronous normalization or envelope serialization.

AISVS C2.1.4 requires rejecting model input beyond token limits, C7.1.2 requires
bounded model output, and OWASP RAG section 3 recommends bounded retrieved chunk
count and total size. At minimum, bound provider output here; enforce a
model-aware request/context budget at this seam or make an upstream invariant
explicit and test it.

### SP-4 — Low — implemented wrong/documentation mismatch: the factory does not independently validate timeout

Issue #87 asks for a "validated environment-selected provider factory," and
`docs/completion-provider-security-notes.md:92-93` claims startup validation and
the runtime factory independently reject invalid timeouts. In fact,
`completion-provider.factory.ts:20-43` validates only provider identity and
forwards `timeoutMs`. Executable probes constructed providers with `-1`, `0`,
`1.5`, `120001`, and `NaN`; some fail only on first completion and others bypass
the documented policy.

**Fix:** validate a safe integer in the inclusive configured range at factory
construction and fail with a fixed non-sensitive configuration error. Test both
factory and Nest startup paths.

No material scope creep was found. The optional failure/wait branches are a
Standards-axis design smell rather than user-visible product scope, and no
classifier, hint ladder, code diagnosis, output-policy agent, review flags,
streaming, live networking, retrieval, authorization, citation selection, or
persistence behavior was added.

**Spec summary: 4 findings; worst is the HIGH validation bypass/private-error
leak.**

## Issue #87 requirement matrix

| Requirement | Status | Evidence / qualification |
|---|---|---|
| One `CompletionProvider` request/result/error contract | Partial | Contract and fixed codes exist at `completion-provider.ts:1-69`; runtime safety is bypassable (ST-1/SP-1), and resource bounds are absent (SP-3). |
| Environment-selected, validated provider factory | Partial | Exhaustive provider map and unknown-provider guard at `completion-provider.factory.ts:11-42`; timeout is not independently validated (SP-4). |
| Nest symbol-token registration and export | Pass | `completion.module.ts:8-20`; module resolution test passes without network. Consumers must import `CompletionModule`, consistent with Nest module sharing. |
| Keep authorization/retrieval/citation/persistence outside adapter | Pass | Request is minimized to question/context/signal at `validated-completion.provider.ts:203-227`; no prohibited responsibility appears in the module. |
| Deterministic no-network mode | Pass | Factory selects only the offline deterministic adapter; no provider dependency, key, or network call exists. |
| Stable conceptual guidance derived only from supplied authorized context | Pass | Ordered normalized evidence digest at `deterministic-completion.provider.ts:43-58`; pinned stability/order/absent-context tests at `deterministic-completion.provider.spec.ts:46-170`. It relies on upstream retrieval to make context question-relevant. |
| Controlled failure/cancellation test behavior | Pass | Constructor modes and wrapper normalization are covered; production-mode separation is a low Standards concern (ST-3). |
| Authoritative system rules and separately delimited untrusted dynamic fields | Partial | Two-message escaped JSON builder exists at `grounded-completion-envelope.ts:22-55` with adversarial tests, but it is disconnected from selected provider execution (SP-2); parser schema is unsafe (ST-2). |
| Source titles and chunk indices treated as data | Partial | Builder serializes only allowed entry fields and escapes literal marker characters; runtime selected path does not use that envelope (SP-2). |
| Provider/model/prompt metadata and optional token counts | Partial | Fields are present and nominally bounded at `validated-completion.provider.ts:168-194`; stateful getters bypass those checks (SP-1). Token counts reject negative, fractional, non-finite, and unsafe values. |
| No keys/private prompts/messages/chunks in logs or errors | Partial | Module emits no logs and ordinary upstream failures/abort reasons normalize to fixed errors; a request accessor can leak its raw exception (SP-1). |
| Complete-response operation; streaming optional | Pass | `CompletionProvider.complete()` is the sole operation; streaming is not introduced. |
| Empty context explicit and fail-closed | Pass | Dedicated `COMPLETION_EMPTY_CONTEXT` at `validated-completion.provider.ts:136-141`; adapter is not called. |
| Malformed request/result explicit and safe | Partial | Broad nominal cases are covered, but accessor/proxy re-reads bypass validation and the exported envelope parser accepts wrong JSON shapes (SP-1/ST-2). |
| Timeout and provider failure explicit and prompt | Pass | Wrapper races abort against non-cooperative adapters at `validated-completion.provider.ts:75-128`; failure types/non-`Error` rejections are normalized. Factory config duplication remains partial (SP-4). |
| Caller cancellation/disconnect semantics available to orchestration | Pass | Optional caller `AbortSignal` is composed and distinguished from timeout. HTTP disconnect wiring correctly remains outside this issue. |
| Provider selection/configuration tests require no network | Pass | Factory/module/config suites pass offline. |
| Same context produces stable output and no absent variable knowledge | Pass | Deterministic suite pins output and verifies repeatability, order, normalization, excerpt bounds, and question non-echo. |
| Instruction-like input remains delimited data | Partial | Builder adversarial tests pass for markers, roles, fences, instructions, HTML-like text, and Unicode separators; actual selected provider execution does not traverse it (SP-2). |
| Empty/malformed/failing cases explicit and safe | Partial | Empty and ordinary malformed/failure paths pass; accessor-backed cases do not (SP-1). |
| No classifier/hint ladder/code diagnosis/output-policy agent/review flags | Pass | None added. |
| Configuration documented without secrets | Pass | `server/.env.example:20-24` documents deterministic provider and bounded deadline; no credentials/course/student data added. |
| `npm run check` passes | Partial / nondeterministic repository baseline | Remote `validate` passed. The local canonical run failed only in unchanged client admin UI tests after format/lint/typecheck and all server tests passed; see Validation. |

## NestJS and security notes

- The feature-module placement, symbol token, `useFactory`, explicit export, and
  typed `ConfigService<AppEnvironment, true>` follow the reviewed Nest module,
  custom-provider, interface-token, and configuration rules.
- The exported provider is created once inside its feature module; there is no
  duplicate provider registration or accidental global module.
- Unit tests are offline and external-provider behavior is represented by
  fakes. Nest assembly is covered with `Test.createTestingModule`.
- The fixed error code/message model deliberately discards provider causes and
  abort reasons. No implementation path calls `Logger`, `console`, or a
  telemetry exporter. This is good content minimization, subject to the raw
  getter escape in ST-1/SP-1.
- Deadline/caller cancellation uses Node 24's supported `AbortSignal.timeout`
  and `AbortSignal.any`, registers a one-shot listener, removes the wrapper's
  listener after settlement, and rejects even if the adapter ignores the
  signal. `--detectOpenHandles` found no current leak.
- A synchronous adapter or hostile thenable that monopolizes the event loop
  cannot be pre-empted by an `AbortSignal`; provider implementations must avoid
  blocking work or isolate it. No live adapter is in scope here.
- The cited Nest, Node 24, OWASP AISVS, OWASP RAG, and OpenTelemetry sources were
  reachable and support the token, abort, logging-sensitivity, delimiter, and
  schema-validation claims. The checked-in notes omit the adjacent AISVS input
  and output bound controls and overstate independent timeout validation (SP-3,
  SP-4). Their `main`/`latest-v24.x` URLs are primary but mutable rather than
  reproducibly pinned.

## Validation performed

| Command/check | Result |
|---|---|
| Fixed point, HEAD, and merge-base resolution | Exact expected SHAs; non-empty three-dot diff. |
| `git diff --check origin/dev...HEAD` | Pass. |
| `npm test --workspace server -- --runInBand modules/completion modules/config/env.schema.spec.ts` | Pass: 7 suites / 92 tests. |
| `npm test --workspace server -- --runInBand modules/completion --detectOpenHandles` | Pass: 6 suites / 80 tests; no open handle reported. |
| `npm run check` | Exit 1. Format, strict lint, typecheck, root tests, and server tests completed successfully; server result was 33 suites / 316 tests. One unchanged client admin test failed (211/212 passed), so the command stopped before its build phase. |
| `npm test --workspace client -- src/features/admin/components/admin-operations.test.tsx` immediately after the gate | Pass: 1 file / 4 tests, demonstrating nondeterminism. |
| Second `npm test --workspace client` | Exit 1: a different test in the same unchanged admin file failed; 29 files / 211 tests passed and 1 file / 1 test failed. |
| `git diff --exit-code origin/dev...HEAD -- client package.json package-lock.json` | Pass/no diff; the client failures are not caused by PR #112. |
| `npm run build` | Pass: client production/SSR and Nest server builds. |
| GitHub `gh pr checks 112` | Remote `validate` pass, 3m03s. |
| Accessor/parser executable probe | Reproduced two result reads and unvalidated replacement content, raw request getter error escape, and acceptance of delimited `null`. |
| Factory timeout executable probe against the production build | Providers constructed for `-1`, `0`, `1.5`, `120001`, and `NaN`; confirms the claimed runtime guard is absent. |

The local `npm run check` failure is a real repository gate reliability issue,
but it is not attributed to this PR and should not be fixed by broadening the
completion-provider branch. E2E/acceptance tests were not run: this PR adds no
HTTP/browser behavior, database schema, or external provider and the focused
module plus full server suites are proportionate. No live-model behavioral test
exists, so the delimiter design proves structural serialization, not prompt
injection immunity; the security notes correctly state that limitation.

## Validation gaps to close with the fixes

- Stateful request, context-entry, and result getters; proxies; accessors that
  throw private values; and mutation between checks and copying.
- Valid JSON envelopes with `null`, array, missing/extra keys, wrong field
  types, negative/unsafe indices, and oversized values.
- Factory construction with every invalid timeout boundary and confirmation
  that failure happens at startup, not first use.
- Selected-provider integration that captures the exact escaped/delimited
  adapter input rather than testing only the standalone helper.
- Explicit request/context aggregate and output limits, including exact
  boundary, one-over, many-chunk, Unicode/code-point or byte/token accounting,
  and synchronous oversize rejection before provider invocation.
- Caller-cancel versus timeout race ordering and exact listener identity/removal
  on resolve, reject, cancellation, and timeout.
- Repeat the canonical gate after fixes; do not treat a single green client run
  as proof until the unrelated admin interaction flake is stabilized on `dev`.

## Finite ordered fix list for the implementation agent

1. Refactor the provider boundary to snapshot each allowed request/result field
   once into inert plain data inside a catch-all safe guard; validate and return
   only that snapshot. Add accessor/proxy/mutation/privacy regression tests.
2. Introduce explicit model/request/result budgets (question, title, per-chunk,
   entry count, aggregate context, and output), or codify and test an upstream
   model-aware context-budget invariant while still bounding provider output at
   this seam.
3. Make envelope parsing schema-strict and share its schema/minimization logic
   with the provider request boundary.
4. Integrate the escaped `grounded-completion-v1` envelope into the selected
   adapter path, then add a factory-level spy test proving instruction-like
   question/title/chunk text reaches the actual adapter only as delimited data.
5. Validate `timeoutMs` synchronously in `createCompletionProvider` against the
   same integer/range contract as `envSchema`; update the security note's
   independent-guard claim and add direct factory boundary tests.
6. Move controlled reject/hang behavior into test fakes, centralize text
   normalization if the shared semantics are intentional, and make global spy
   teardown failure-safe.
7. Close TestingModules, add the cancellation-race/listener cleanup cases, run
   the focused suites with `--detectOpenHandles`, run the full server tests,
   both builds, and finally `npm run check`. Record any unchanged client flake
   separately rather than modifying unrelated frontend code in this PR.

## Resolution

Resolved on `codex/fix-pr-112` from the unchanged reviewed head
`6d7570a48d2c5b820016287c3016deb3e7d1d9c1`.

### Standards and spec findings

| Finding | Resolution |
|---|---|
| ST-1 / SP-1 | `completion-input.ts` is now the single input-contract owner. It reads each allowed request, context-entry, and signal value once inside fixed-error containment, validates explicit budgets, and freezes inert snapshots. Result validation likewise reads each allowed field once and returns only a frozen snapshot. Stateful accessors, throwing request/result proxies, mutation-after-read behavior, private sentinels, and a hostile thenable are covered through `CompletionProvider.complete()`. |
| ST-2 | `parseGroundedCompletionInputEnvelope()` parses to `unknown`, then reuses the input-contract schema to require exact root/entry keys, non-empty bounded strings, a non-empty bounded dense context array, and safe non-negative chunk indices. It returns minimized frozen data and rejects valid JSON with `null`, array, missing/extra keys, wrong types, negative/unsafe indices, empty context, and oversized values. |
| ST-3 | The production deterministic adapter has one behavior. Constructor-selected reject/hang modes were removed; wrapper failure and non-cooperation tests use the dedicated fake adapter at the real internal adapter seam. |
| ST-4 | Deterministic embedding and completion intentionally share `common/text/normalize-deterministic-text.ts`. Its NFKC/trim/whitespace semantics and ownership rationale are pinned once in a shared test. |
| ST-5 | The completion wrapper suite registers `jest.restoreAllMocks()` in `afterEach`, so AbortSignal/EventTarget and Logger spies are restored even when an assertion or awaited operation fails. |
| SP-2 | A small internal `CompletionAdapter` seam now accepts only frozen prepared messages and a composed signal. `ValidatedCompletionProvider` builds the escaped `grounded-completion-v1` messages after snapshot validation, and the selected deterministic adapter consumes the user envelope through the strict parser. The factory test captures the actual selected adapter call and proves instruction-like marker text in the question, title, and chunk remains escaped/delimited data. |
| SP-3 | The provider enforces maximums of 4,000 question code points, 300 title code points, 8,000 code points per chunk, 50 entries, 32,000 aggregate title-plus-content code points, and 16,000 result-content code points. Tests cover exact Unicode code-point boundaries, one-over rejection, aggregate and many-entry limits, and synchronous rejection before timeout construction or adapter invocation. The security notes now distinguish these provider-independent ceilings from future tokenizer-aware live-adapter limits. |
| SP-4 | `createCompletionProvider()` now independently requires a safe integer timeout in the same inclusive 1–120,000 ms range as `envSchema`. Invalid values fail synchronously with `COMPLETION_CONFIGURATION_INVALID`; direct factory boundary cases and Nest module assembly with an invalid timeout are covered. |

### Validation-gap closure

| Original gap | Closure |
|---|---|
| Stateful getters, proxies, mutation, and private thrown values | Request/root/context-entry/result accessor and proxy regressions assert one read, first-value snapshots, fixed error codes, adapter non-invocation where applicable, and absence of private sentinels. A provider thenable whose `then` accessor throws is normalized to `COMPLETION_PROVIDER_FAILURE`. |
| Valid JSON with the wrong envelope shape | The envelope matrix now covers `null`, arrays, missing/extra root and entry keys, wrong types, empty context, negative/unsafe indices, and oversized fields. |
| Listener identity and all settlement paths | EventTarget spies capture listeners on the exact caller and timeout signals and assert the identical functions are removed after resolve, provider reject, caller cancel, and timeout. Restoration is failure-safe. |
| Cancellation/timeout race | A non-cooperative fake adapter test aborts caller-then-timeout and timeout-then-caller and pins the first event to `COMPLETION_CANCELLED` or `COMPLETION_TIMEOUT`, respectively. |
| TestingModule lifecycle | Both successfully compiled completion TestingModules close in `finally`; the invalid startup module is expected to reject during compilation. |
| Factory boundary values | Direct tests reject `-1`, `0`, `1.5`, `120001`, `NaN`, and infinity and accept both inclusive boundaries. Existing `envSchema` coercion/startup tests retain their matching range coverage. |
| Runtime envelope integration | The factory-selected deterministic adapter is captured at its actual call and receives only `{ messages, signal }`; its user message round-trips hostile dynamic data through the strict escaped envelope. |
| Resource-bound boundaries | Focused tests cover code-point rather than UTF-16 accounting, exact/one-over question and output limits, title/chunk/count limits, and exact/one-over aggregate context. |
| Canonical gate and open handles | Focused completion/normalization/embedding validation passed with `--detectOpenHandles` (8 suites / 127 tests). Full-suite/build/gate results are recorded below after the final run. No unrelated client source or test was modified. |

### Ordered-fix disposition

1. Completed by the shared once-only request/result snapshot functions and
   accessor/proxy/thenable privacy regressions.
2. Completed with explicit request, entry-count, aggregate-context, and output
   code-point budgets at the provider seam.
3. Completed by the strict envelope parser reusing the shared input schema and
   minimizer.
4. Completed by the internal prepared-message adapter seam and factory-level
   selected-path capture test.
5. Completed by synchronous runtime timeout validation aligned with `envSchema`
   and the corrected security documentation.
6. Completed by fake-only controlled failure/non-cooperation behavior, shared
   deterministic normalization ownership, and failure-safe spy restoration.
7. Completed in code by `finally`-closed TestingModules and first-abort/exact-
   cleanup tests. Final full validation results follow in the next subsection.

### Post-fix validation

| Command/check | Result |
|---|---|
| `git diff --check` | Pass after both implementation commits. |
| Focused completion, normalization, and embedding tests with `--detectOpenHandles` | Pass: 8 suites / 127 tests; no open handle reported. |
| Server typecheck | Pass. |
| Server strict lint | Pass. |
| Server format check | Pass. |
| Full server tests with `--detectOpenHandles` | Pass: 34 suites / 350 tests; no open handle reported. Expected error-path log fixtures were emitted. |
| Client and server production builds (`npm run build`) | Pass: Vite client/SSR and Nest server builds completed. |
| `npm run check` | Exit 1 only in the unchanged client `admin-operations.test.tsx`: 29 files / 211 tests passed and 1 file / 1 test failed because the keyboard selection produced `STUDENT` instead of `INSTRUCTOR`. Format, strict lint, all typechecks, root tests, and the full server suite (34 / 350) passed before the gate stopped ahead of its build phase. |
| Focused unchanged admin test rerun | Same isolated failure: 3 / 4 tests passed. This branch has no client diff; the completion PR did not modify the flaky test or UI. |
| `git diff --exit-code origin/dev...HEAD -- client` | Pass/no client diff. |

### Deliberate remaining boundaries

Authorization, retrieval, citation selection, persistence, output-policy
classification, live provider networking, streaming, and HTTP disconnect wiring
remain outside issue #87 exactly as specified. Provider context budgets are a
defensive input invariant, not retrieval or authorization behavior. No claim of
live-model prompt-injection immunity is made; the envelope tests establish
structural separation and escaping only.

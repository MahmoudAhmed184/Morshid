# Production review: Nourhan PR #204

Review date: 2026-08-10 (Africa/Cairo)

## PR identification and scope

- Repository: `MahmoudAhmed184/Morshid`.
- Configured Git remote: the checkout has only `origin` (`git@github.com:MahmoudAhmed184/Morshid.git`); there is no separate remote literally named `morshid`. I refreshed `origin` branches and pull-request heads before resolving the review target.
- PR: [#204 — feat(socratic): deliver progressive Socratic Tutor V1](https://github.com/MahmoudAhmed184/Morshid/pull/204), open, authored by `nourhansinger`.
- Correct base: `dev` at `3a1f7fa205134ddbe5bd02e63b06781b29ff8b53`.
- Head: `feature/socratic-tutor-v1-phase2` at `94bd5e29be45bfa257e34cfb9a0396eae625becb`.
- Merge base: `3a1f7fa205134ddbe5bd02e63b06781b29ff8b53`, equal to the recorded base SHA. The reviewed range is therefore exactly `3a1f7fa..94bd5e`.
- Size: 135 commits, 154 changed files, 35,433 additions, and 2,313 deletions.
- Primary scope: the new Socratic Tutor module and orchestration path; student-chat replacement path; topic, state, turn, analysis, teaching-policy, generation, guard, and response-audit persistence; Prisma schema and migrations; model/configuration adapters; RAG query construction; client chat metadata; acceptance/E2E/unit coverage; Compose and environment configuration; architecture documentation.
- Review method: complete three-dot diff plus callers, callees, transaction boundaries, replacement code, existing shared infrastructure, schema/migration history, and tests. Existing user worktree changes in `server/README.md` and `server/prisma/migrations/20260726100158/` were excluded and left untouched.

## Executive assessment

**Recommendation: reject / request changes. Do not merge this head.**

The PR has several strong building blocks—typed ports, strict structured-output schemas, course-scoped retrieval, bounded individual upstream calls, explicit turn transitions, an audit graph, and substantial tests—but the production slice is not complete. Five High-severity defects remain in the actual runtime composition:

1. `UNSAFE` and `OFF_TOPIC` classifications do not alter behavior.
2. live chat cannot actually switch or resume topics even though a large topic subsystem was added;
3. completed turns do not apply the TopicState transition that the PR itself defines as a completion invariant;
4. the production Compose configuration is internally invalid by default and still permits canned analysis/tutor providers when made bootable; and
5. final authorization can race membership removal or session deletion.

There are also deterministic schema/acceptance failures, unbounded aggregate request duration, missing output-token limits, same-PR compatibility machinery, duplicated transports, obsolete old runtime stacks, and migration/test drift. Both required GitHub checks on the reviewed head are currently red: [validate](https://github.com/MahmoudAhmed184/Morshid/actions/runs/31373292794/job/93406845893) and [acceptance](https://github.com/MahmoudAhmed184/Morshid/actions/runs/31373292794/job/93406845972). GitHub reports the PR as textually mergeable but `mergeable_state: unstable`; that is not an acceptable production signal.

No Critical-severity issue was validated. Absence of a Critical finding does not change the merge recommendation.

## Validated findings

## Critical

None validated.

## High

### H1. Safety classifications are recorded and then ignored

- **Files/lines:** `server/src/modules/socratic-tutor/educational-analysis.schema.ts:28-36`; `server/src/modules/socratic-tutor/educational-analysis.reconciler.ts:5-24`; `server/src/modules/student-chat/socratic-chat.orchestrator.ts:151-255`; `server/src/modules/socratic-tutor/teaching-policy.selector.ts:96-152`.
- **Affected behavior:** a model result of `MessageRequestKind.UNSAFE` or `OFF_TOPIC` continues through teaching-decision selection, RAG retrieval, tutor generation, validation, and approval like an ordinary tutoring request.
- **Evidence:** both values are accepted analysis outputs. The reconciler intentionally preserves them, but the orchestrator has no branch on `analysisResult.analysis.result.requestKind`; it always proceeds to `selectDecision`, retrieval, and approval. Strategy selection keys off `studentState`, not `requestKind`. A repository-wide production-code search finds no downstream `UNSAFE`/`OFF_TOPIC` handling outside the analysis contract/prompt. This PR also removes the old `AutomaticSafetyRiskDetector` branch from `GroundedChatService`.
- **Why this is a problem:** the primary safety/off-topic decision has no enforcement effect. Unsafe input can reach generation as untrusted prompt content, while off-topic input consumes course retrieval/model capacity and receives a normal Socratic response instead of a bounded refusal or redirect.
- **Violated principle/rule:** correctness and security decisions must be authoritative; layers must compose into a working end-to-end behavior, not merely persist labels.
- **Recommended fix:** immediately branch after accepted analysis. Return and persist a deterministic safety refusal for `UNSAFE`, and a deterministic course-scope redirect for `OFF_TOPIC`; do not call teaching policy, retrieval, tutor generation, or semantic guard on either path. Add orchestration/E2E tests asserting those ports are not called.

### H2. The live topic resolver cannot switch topics and attaches messages to the wrong topic

- **Files/lines:** `server/src/modules/student-chat/socratic-chat.orchestrator.ts:98-141`; `server/src/modules/student-chat/socratic-chat.types.ts:9-24`; `server/src/modules/student-chat/grounded-chat.service.ts:214-222`; `server/src/modules/socratic-tutor/topic.service.ts:37-106`; `server/src/modules/socratic-tutor/retrieval-query.builder.ts:141-151`.
- **Affected behavior:** once a session has one active topic, every subsequent message is attached to that topic before the message is analyzed, even when the student clearly changes subject.
- **Evidence:** production orchestration calls `resolveTopic` with only `sessionId` and `courseId`. It never supplies `problemId`, `conceptId`, title, or message content. `TopicService` can select a different topic only from a stable problem/concept identity; with no identity and one active topic, lines 79-89 always return `CONTINUE_CURRENT_TOPIC`. `studentMessageContent` is passed into the input type but never read. Analysis later emits `topicRelation`, but no production code applies that result to topic persistence; retrieval alone uses it to decide how much old context to include. The new phase-1 tests that demonstrate switching explicitly inject stable IDs that the HTTP path never supplies.
- **Why this is a problem:** the feature advertises topic creation/switch/resume semantics, yet the actual chat path cannot invoke them. New-subject messages and their analysis/turn/response records are persisted under the prior topic, contaminating future history and teaching decisions.
- **Violated principle/rule:** smallest working end-to-end layer; truthful module boundaries; no abstractions for hypothetical requirements.
- **Recommended fix:** choose one real V1 contract. Either resolve from a stable problem/concept identity available at the API boundary, or analyze the current message before final topic attachment and atomically apply the resolved relation. If V1 intentionally supports only one topic per session, remove the unused switching/resume machinery and model that constraint directly.

### H3. A turn is marked completed without the required TopicState transition

- **Files/lines:** `server/src/modules/student-chat/socratic-chat.orchestrator.ts:125-181,232-271`; `server/src/modules/socratic-tutor/topic-state.service.ts:16-70`; `server/src/modules/socratic-tutor/turn.repository.ts:620-652`; `docs/MORSHID_SOCRATIC_TUTOR_ARCHITECTURE_V1.md:1246-1271`.
- **Affected behavior:** `summary`, `lastTutorQuestion`, `lastStudentAction`, guidance/progress state, and the state version remain default or stale across successfully completed turns.
- **Evidence:** the orchestrator only calls `TopicStateService.getOrCreate`; the only production definition of `applyTransition` has no production caller. Final approval writes the message/audit records and marks the turn `COMPLETED`, but does not update TopicState. The PR's architecture document explicitly admits the gap at lines 1246-1253, then states at line 1271 that a turn must not be reported completed until the response and required state transition are durably committed.
- **Why this is a problem:** subsequent policy selection consumes a stale snapshot, so guidance and pedagogical progression cannot reliably build on the prior turn. The database can represent a completed response and a contradictory educational state.
- **Violated principle/rule:** data integrity, stated architecture invariant, and complete vertical slicing. A documented “follow-up gap” is a temporary stopgap, not production architecture.
- **Recommended fix:** calculate and validate the post-response state patch, then commit it with the approved response, audit graph, citations, and turn completion in the same short transaction using the existing version/CAS check. If state transitions are not in V1, remove TopicState from the runtime and documentation instead of persisting misleading snapshots.

### H4. Production Compose is unbootable by default and permits canned core model roles when overridden

- **Files/lines:** `docker-compose.yml:55-92`; `server/src/modules/config/env.schema.ts:614-624`; `server/src/modules/config/env.schema.spec.ts:441-466`; `server/src/modules/socratic-tutor/analysis-model.provider.ts:371-415`; `server/src/modules/socratic-tutor/tutor-model.adapter.ts:362-396`.
- **Affected behavior:** the `server` Compose profile sets `NODE_ENV=production` while defaulting the semantic guard to `deterministic`; environment validation rejects that exact combination, so the default app profile cannot start. If an operator supplies a live guard, analysis and tutor generation still default to deterministic test adapters.
- **Evidence:** Compose lines 57 and 88 produce the rejected configuration. The schema only rejects deterministic semantic guard, not deterministic analysis/tutor; the production acceptance test at lines 452-466 proves a live guard with inherited deterministic analysis/tutor is accepted. Those adapters return a fixed low-confidence `AMBIGUOUS` analysis and a canned “one small step” tutor message rather than performing the advertised roles.
- **Why this is a problem:** the shipped production configuration is either unavailable or silently not the Socratic system described by the PR. This is not a legitimate production fallback and masks missing deployment configuration.
- **Violated principle/rule:** fail-valid configuration, production correctness, no compatibility/fallback paths or temporary stubs in the production graph.
- **Recommended fix:** require non-deterministic providers for all three Socratic roles in production and remove invalid deterministic defaults from the production service. Keep deterministic adapters in test-only module composition or explicit non-production diagnostics; add a test that the exact Compose production defaults validate and resolve to live roles.

### H5. Final authorization is vulnerable to revocation/session-deletion races

- **Files/lines:** `server/src/modules/socratic-tutor/turn.repository.ts:410-509,510-652`; comparison path `server/src/modules/student-chat/grounded-chat-turn.repository.ts:477-496,781-818`; revocation writer `server/src/modules/admin/courses/admin-courses.repository.ts:471-496`.
- **Affected behavior:** a response may be committed and returned after the student's membership is removed or the chat session is deleted concurrently with finalization.
- **Evidence:** `completeApprovedResponse` performs ordinary Prisma reads of the turn/session and membership, then writes the completed message/audit/turn. It does not lock either authoritative row. Under PostgreSQL's default Read Committed isolation, an ordinary `SELECT` does not prevent a concurrent update after the check. The existing grounded-chat finalizer already solves the same invariant by selecting both session and membership `FOR UPDATE`; the admin removal path updates the same membership row. PostgreSQL documents that `FOR UPDATE` prevents concurrent modification until transaction end: [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) and [row-level locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).
- **Why this is a problem:** authorization is checked but not held through the protected writes, creating a time-of-check/time-of-use security gap. The comment claiming that this mirrors `lockAuthorizedSession()` is factually incorrect.
- **Violated principle/rule:** authorization must be transactionally authoritative; consistency with the established repository pattern.
- **Recommended fix:** in the final transaction, lock the exact session and membership rows in the same established order before rechecking scope/role/removal and before any response write. Reuse the existing locking helper or a single shared authorization-lock primitive. Add two-transaction E2E tests for concurrent member removal and session deletion.

## Medium

### M1. There is no request-wide deadline, disconnect cancellation, or abandoned-turn recovery

- **Files/lines:** `server/src/modules/student-chat/student-chat.controller.ts:305-336`; `server/src/modules/student-chat/socratic-chat.types.ts:9-24`; `server/src/modules/student-chat/socratic-chat.orchestrator.ts:56-85,151-248`; `server/src/modules/socratic-tutor/analysis-retry-policy.ts:10-53`; `server/src/modules/socratic-tutor/tutor-infrastructure-retry.policy.ts:13-53`; `server/src/modules/socratic-tutor/response-validation.types.ts:9-12`; `server/src/modules/socratic-tutor/turn.service.ts:202-223`.
- **Affected behavior:** the pipeline keeps doing sequential upstream work after the client disconnects and can occupy a request for many minutes; a process interruption can leave the idempotency key permanently `ALREADY_PROCESSING`.
- **Evidence:** the controller does not derive/pass a request-close signal, the orchestration input has no signal/deadline, and the orchestrator supplies none to analysis, retrieval, generation, or guard. Individual defaults are 30 seconds for analysis/tutor/guard and 10 seconds for query embedding; default retries and three candidate attempts permit roughly 5 minutes 40 seconds of sequential timeout budget in the worst valid path. Allowed maximum settings permit much longer. Every nonterminal existing turn maps to `ALREADY_PROCESSING`; no lease or stale-claim recovery exists.
- **Why this is a problem:** resource use outlives demand, latency is not bounded at the user operation level, and transient worker death can make retry impossible without manual repair.
- **Violated principle/rule:** async cancellation, availability, bounded work, idempotent recovery.
- **Recommended fix:** create one overall deadline/AbortSignal at the HTTP boundary, propagate it through every upstream call and retry wait, and stop starting work when insufficient budget remains. Give processing turns a lease/heartbeat or deterministic stale-recovery rule.

### M2. “Grounding required” candidates can pass structural and deterministic validation with zero citations

- **Files/lines:** `server/src/modules/socratic-tutor/teaching-policy.selector.ts:56-66`; `server/src/modules/socratic-tutor/tutor-candidate.schema.ts:29-55,97-155`; `server/src/modules/socratic-tutor/response-validation.types.ts:90-99`; `server/src/modules/socratic-tutor/deterministic-guard.service.ts:53-63,236-240`; `server/src/modules/socratic-tutor/structural-response.validator.ts:115-143`.
- **Affected behavior:** a normal model candidate may be approved without citing any of the retrieved evidence even though every teaching decision sets `requireGrounding` and `enforceCitationSupport` to true.
- **Evidence:** `usedCitationIds` has only a maximum length. Candidate validation and the deterministic guard reject IDs outside the allow-list but never require one. `CandidateValidationContext` does not even carry `requireGrounding`; the structural regeneration text explicitly says “or use no citations.” A direct schema/guard reproduction using a nonempty allow-list and `usedCitationIds: []` returned structural success and deterministic approval.
- **Why this is a problem:** the semantic model becomes the only probabilistic line of defense for a deterministic policy invariant; an erroneous semantic approval persists an ungrounded response as `COURSE_GROUNDED`.
- **Violated principle/rule:** authoritative policy enforcement and truthful API metadata.
- **Recommended fix:** require at least one allow-listed citation for every non-fallback candidate whenever grounding is required and evidence is available. Safe fallback is already a distinct path and can remain citation-free.

### M3. A candidate that explicitly reports prohibited disclosure is still accepted

- **Files/lines:** `server/src/modules/socratic-tutor/tutor-prompt.builder.ts:185-200`; `server/src/modules/socratic-tutor/tutor-candidate.schema.ts:29-55,97-155`; `server/src/modules/socratic-tutor/deterministic-guard.service.ts:20-159`.
- **Affected behavior:** model output with `selfReportedCompliance.finalAnswerRevealed: true` and/or `completeSolutionRevealed: true` can pass parsing and deterministic validation.
- **Evidence:** the prompt contract requires both values to be false, but the Zod schema accepts arbitrary booleans and neither `validateCandidateResponse` nor the deterministic guard reads them. A direct reproduction with both values `true` returned `success: true`; the deterministic guard also approved when the message avoided its phrase patterns.
- **Why this is a problem:** the pipeline asks the model for an explicit safety signal and then ignores the model's admission that it violated policy. Later probabilistic review does not make this deterministic contradiction acceptable.
- **Violated principle/rule:** fail-closed validation and coherent contracts.
- **Recommended fix:** model these fields as `z.literal(false)` or deterministically reject either true value as a critical disclosure violation. If the fields are not trusted/useful, remove them from the output contract instead of carrying dead safety metadata.

### M4. “Absent” educational evidence can retain message IDs and influence retrieval

- **Files/lines:** `server/src/modules/socratic-tutor/educational-analysis.schema.ts:114-201`; `server/src/modules/socratic-tutor/educational-analysis.validator.ts:46-81`; `server/src/modules/socratic-tutor/retrieval-query.builder.ts:108-123,186-197`.
- **Affected behavior:** analysis may say effort or learning evidence is absent while still identifying historical evidence messages; those messages are then injected into the RAG query.
- **Evidence:** the schemas validate type/quality when `present` is false, but do not require `evidenceMessageIds` to be empty (nor false-only effort flags). The validator checks only that referenced IDs are in bounded context. The query builder unconditionally concatenates both nested ID arrays. Direct `safeParse` reproductions for absent effort and learning objects with valid IDs both succeeded.
- **Why this is a problem:** contradictory model output silently changes retrieval context, causing irrelevant prior work to bias evidence selection while the persisted analysis says no such evidence exists.
- **Violated principle/rule:** schema invariants and data integrity.
- **Recommended fix:** refine absent evidence to require empty ID arrays and false effort booleans, and defensively consume nested IDs only when `present` is true.

### M5. New retry loops immediately hammer rate-limited/unavailable providers and bypass the existing retry utility

- **Files/lines:** `server/src/modules/socratic-tutor/analysis-model.provider.ts:289-312`; `server/src/modules/socratic-tutor/educational-analysis.service.ts:133-162`; `server/src/modules/socratic-tutor/tutor-generation.service.ts:109-135`; existing implementation `server/src/common/upstream/upstream-retry-policy.ts:1-20,40-77,96-173`.
- **Affected behavior:** retryable analysis/tutor failures are retried immediately; analysis explicitly retries HTTP 429 but discards `Retry-After` metadata first.
- **Evidence:** both loops increment and `continue` without delay. The analysis adapter discards the response body and reduces failure state to a status/category, losing headers. Morshid already has a bounded, cancellation-aware utility that classifies 408/429/5xx, parses `Retry-After`/`retry-after-ms`, clamps the delay, and waits on an AbortSignal.
- **Why this is a problem:** immediate retries amplify throttling/outages, waste the retry budget, and duplicate already-solved infrastructure behavior.
- **Violated principle/rule:** prefer existing dependencies/utilities and proven retry conventions; avoid duplicate custom functionality.
- **Recommended fix:** preserve headers and use the existing shared upstream retry policy under the request-wide deadline. Do not retry deterministic invalid output with an identical temperature-0 request unless the second prompt includes bounded corrective feedback.

### M6. All three OpenAI-compatible calls omit an output-token limit

- **Files/lines:** `server/src/modules/socratic-tutor/analysis-model.provider.ts:289-304`; `server/src/modules/socratic-tutor/tutor-model.adapter.ts:283-299`; `server/src/modules/socratic-tutor/semantic-guard.adapter.ts:196-210`.
- **Affected behavior:** analysis, tutor generation, and semantic guard can generate to provider/model defaults; the 512 KiB response-reader limits network ingestion only after generation has consumed time/tokens.
- **Evidence:** all request bodies set model/messages/temperature/top-p/JSON response format but no `max_completion_tokens` or compatible `max_tokens`. The current official OpenAI Chat Completions API documents `max_completion_tokens` as the upper bound for generated completion/reasoning tokens: [official API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
- **Why this is a problem:** cost and latency are not bounded at generation time, and oversized output becomes a failure after resources were already consumed.
- **Violated principle/rule:** resource bounds, provider-contract correctness, operational reliability.
- **Recommended fix:** add small, validated per-role output budgets and send the provider-supported OpenAI-compatible limit in every request. Test the outbound request shape and reject configuration outside a safe range.

### M7. The new acceptance mock violates the client response schema

- **Files/lines:** `tests/acceptance/student-session-workspace.spec.ts:487-522`; `client/src/features/student/schemas/student-chat.schema.ts:140-160`; `client/src/features/student/data/student-sessions.api.ts:214-226`; `.github/workflows/ci.yml:97-116`.
- **Affected behavior:** the new multi-turn acceptance scenario rejects its mocked POST response before the UI can render it.
- **Evidence:** both mocked messages omit required key `reviewSummary`; the client schema requires the key with a nullable value and `sendStudentChatMessage` parses the response strictly. An exact `safeParse` reproduction returned two `invalid_type` issues at `studentMessage.reviewSummary` and `assistantMessage.reviewSummary`. The required acceptance job executes this file and is currently red.
- **Why this is a problem:** the test does not exercise the advertised multi-turn behavior and blocks CI.
- **Violated principle/rule:** tests must validate real contracts rather than maintain hand-written partial duplicates.
- **Recommended fix:** use the shared chat-message fixture/builder or include `reviewSummary: null` in both messages. Prefer a contract-shaped factory so future required fields cannot silently drift.

### M8. A same-PR migration adds permanent legacy bypasses for data that cannot exist on the base

- **Files/lines:** `server/prisma/migrations/20260810023000_add_socratic_response_audit/migration.sql:29-57,153-178`; `server/prisma/schema.prisma:149-156`; `server/test/socratic-response-audit-migration.e2e-spec.ts:12-128`.
- **Affected behavior:** `LEGACY_UNCLASSIFIED` and `validation_policy_version='legacy-unversioned'` permanently allow completed turns without the candidate/approval metadata required of current completions.
- **Evidence:** all Socratic tables and all migrations that could create pre-audit turns are new in this PR; the base branch has no such production data. The E2E test manufactures “legacy” state by stopping midway through this PR's own migration sequence, then enshrines the bypass as desired compatibility behavior.
- **Why this is a problem:** new schema begins life with an avoidable exceptional state, weaker constraint, extra enum value, backfill, and test burden.
- **Violated principle/rule:** explicit instruction not to preserve backward compatibility unless required; remove obsolete paths instead of adding fallbacks/migrations.
- **Recommended fix:** squash/reshape the not-yet-merged migrations so response-audit columns and strict constraints exist when `tutor_turns` is created. Remove `LEGACY_UNCLASSIFIED`, the synthetic backfill, the `legacy-unversioned` constraint bypass, and the compatibility test.

### M9. The PR drops the HNSW index while schema docs and E2E tests still require it

- **Files/lines:** `server/prisma/migrations/20260808133701/migration.sql:1-2`; original index `server/prisma/migrations/20260716224018_add_rag_persistence/migration.sql:49-55`; `server/prisma/schema.prisma:592-597`; `server/prisma/README.md:3-22`; `server/test/rag-persistence.e2e-spec.ts:201-212`; current query `server/src/modules/retrieval/course-retrieval.repository.ts:126-160`.
- **Affected behavior:** deploying migrations removes `idx_chunks_embedding_hnsw`, while repository documentation and an E2E invariant still assert that it exists.
- **Evidence:** the new migration is an unconditional drop. The schema comment and README say the migration-owned HNSW index must remain; the E2E test dereferences `indexes[0]` and requires `USING hnsw`. The PR description itself acknowledges the stale HNSW assertion in E2E, and the required `validate` job is currently red.
- **Why this is a problem:** migration history, schema documentation, and tests define mutually exclusive intended states. This is merge-blocking drift even though the current course-scoped retrieval query deliberately materializes an exact scan and therefore does not currently use HNSW.
- **Violated principle/rule:** database contract consistency and clean removal of obsolete paths.
- **Recommended fix:** make one intentional decision. If exact scanning is the V1 architecture, remove the obsolete index contract, stale schema/README text, and test in the same PR. If ANN remains required for another supported path, remove the drop and document/validate that path. Do not leave a knowingly failing invariant.

### M10. The replacement leaves the old completion/output-policy/tutor runtime behind

- **Files/lines:** `server/src/app.module.ts:6,41`; `server/src/modules/completion/completion.module.ts:23-94`; `server/src/modules/student-chat/student-chat.module.ts:28,45`; replacement diff in `server/src/modules/student-chat/grounded-chat.service.ts:86-225`; old directories `server/src/modules/output-policy/` and `server/src/modules/tutor/`.
- **Affected behavior:** the app still instantiates and configures a legacy completion provider and registers an unused request classifier after `GroundedChatService` removed every consumer. The old tutor/output-policy implementations and their tests remain as a parallel architecture.
- **Evidence:** repository-wide production-code search finds `COMPLETION_PROVIDER_TOKEN` only in `CompletionModule` itself; `CompletionModule` remains imported by `AppModule`. `CorrectnessSensitiveRequestClassifier` is registered but has no consumer. The PR diff removes completion, tutor-decision, output-policy, conflict-detector, and safety-detector dependencies from the sole chat orchestration path but does not remove their implementations/configuration.
- **Why this is a problem:** operators still face obsolete provider settings and startup work, while maintainers must distinguish two policy/generation systems. It directly violates the requested replacement policy and increases security review surface.
- **Violated principle/rule:** remove obsolete paths; avoid duplicate implementations and compatibility layers.
- **Recommended fix:** remove the old composition modules, providers, configuration, scripts, and behavior tests that no supported runtime calls. Retain only genuinely shared low-level utilities, relocating them to focused common modules.

### M11. Three role adapters duplicate nearly 1,900 lines of transport code

- **Files/lines:** `server/src/modules/socratic-tutor/analysis-model.provider.ts:260-369,418-716`; `server/src/modules/socratic-tutor/tutor-model.adapter.ts:257-360,409-717`; `server/src/modules/socratic-tutor/semantic-guard.adapter.ts:165-456`.
- **Affected behavior:** timeout composition, request construction, headers, bounded body reading, chat-completion parsing, metadata validation, HTTP classification, and error mapping are maintained separately for analysis, tutoring, and guard roles.
- **Evidence:** the files total 1,889 lines; the analysis and tutor files are near-structural copies and the guard repeats the same request/parser helpers. The duplication has already produced cross-cutting omissions in all three (M6) and inconsistent retry integration (M5).
- **Why this is a problem:** fixes to the OpenAI-compatible wire contract must be repeated and can diverge, while independent model roles do not require independent HTTP implementations.
- **Violated principle/rule:** modular focused responsibilities, simplicity, and avoiding duplicated custom implementations.
- **Recommended fix:** keep the three domain ports and independent role configurations, but back them with one small, tested internal structured-chat transport that owns URL/auth/request limits/timeouts/body bounds/parsing/retry metadata. Map transport failures into role-specific errors at each adapter boundary. No new dependency is necessary.

## Low

### L1. New migrations create redundant indexes and same-PR index churn

- **Files/lines:** `server/prisma/migrations/20260810023000_add_socratic_response_audit/migration.sql:125-139`; `server/prisma/schema.prisma:739-740,763-764`; `server/prisma/migrations/20260805090000_add_educational_analysis_fallback_metadata/migration.sql:1-8`; `server/prisma/migrations/20260806021758/migration.sql:1-2`.
- **Affected behavior:** each response-audit table maintains a standalone `turn_id` index in addition to a unique composite index with `turn_id` as its leftmost key. Another migration creates `idx_educational_analyses_source_reason` only for the next same-PR migration to drop it.
- **Evidence:** PostgreSQL B-tree left-prefix lookups are already served by `(turn_id, candidate_attempt)` and `(turn_id, candidate_attempt, validation_stage)`. Every listed migration is new in this unmerged PR.
- **Why this is a problem:** unnecessary indexes add write/storage/vacuum cost; create-then-drop migration history adds deployment work and obscures intended schema.
- **Violated principle/rule:** simplest current schema; no same-PR compatibility/churn.
- **Recommended fix:** remove the two redundant schema indexes and their SQL. Squash the educational-analysis migration intent so the unused index is never created.

### L2. OpenAPI marks always-present nullable fields as optional and omits hint bounds

- **Files/lines:** `server/src/modules/student-chat/student-chat.dto.ts:195-242`; presenter `server/src/modules/student-chat/student-chat-message.presenter.ts:46-75`; client contract `client/src/features/student/schemas/student-chat.schema.ts:140-160`.
- **Affected behavior:** generated API clients may treat `turnId` and `topicId` as absent even though every response contains the keys, and may accept `hintLevel` outside the runtime/client range 1-4.
- **Evidence:** both ID properties use `required: false`; the presenter always assigns them and the strict client schema requires nullable keys. `hintLevel` is documented only as nullable while the client enforces integer 1-4. Nest's official OpenAPI guidance distinguishes required/optional properties and supports numeric constraints: [types and parameters](https://docs.nestjs.com/openapi/types-and-parameters).
- **Why this is a problem:** the published API contract drifts from both producer and consumer, degrading generated-client correctness.
- **Violated principle/rule:** API contract consistency.
- **Recommended fix:** keep the keys required and nullable, and add `minimum: 1, maximum: 4` for `hintLevel`.

### L3. New dead declarations and stale documentation remain in the delivered slice

- **Files/lines:** `server/src/modules/student-chat/socratic-chat.types.ts:9-24`; `server/src/modules/student-chat/grounded-chat.service.ts:214-222`; `server/src/modules/socratic-tutor/safe-fallback.service.ts:14-19,58-64`; `docs/MORSHID_SOCRATIC_TUTOR_ARCHITECTURE_V1.md:1246-1253`.
- **Affected behavior:** `studentMessageContent` is populated but never read; `SAFE_FALLBACK_REASON.GROUNDING_UNAVAILABLE` and its message are unreachable because retrieval returns `blocked` before approval; documentation says request-kind reconciliation is still missing although the repository now performs it.
- **Evidence:** repository-wide production searches find only the declaration/construction for `studentMessageContent`, and only the declaration/special branch for `GROUNDING_UNAVAILABLE`. `educational-analysis.repository.ts:216-220,239-249` does reconcile the student message request kind, contradicting the follow-up-gap text.
- **Why this is a problem:** these declarations imply capabilities/paths that do not exist and make an already very large change harder to reason about.
- **Violated principle/rule:** no dead code, speculative paths, or obsolete documentation.
- **Recommended fix:** remove unused input and fallback reason/branch, and update the architecture document to describe only current behavior after H3 is resolved.

## Architecture and organization assessment

The intended layering is directionally sound: orchestration, topic, state, analysis, deterministic teaching policy, retrieval, generation, validation, approval, and persistence are named separately. Strict TypeScript types, Zod at untrusted model boundaries, repository interfaces, and short final database transactions are good choices.

The composition does not yet justify the breadth of the implementation. This is a 35k-line, 154-file replacement that ships multiple substantial subsystems before their end-to-end callers exist. Topic switching and TopicState transitions are the clearest examples: hundreds of lines of services/repositories/tests exist, but production chat cannot invoke the former correctly and never invokes the latter. The architecture document explicitly records an invariant violation as a future gap. Simultaneously, the replaced completion/tutor/output-policy graph remains in the application. That is the opposite of a smallest working vertical slice.

The long-term shape should retain domain ports and transactional auditability, but narrow V1 to behavior that is genuinely wired. Complete safety routing, real topic resolution, atomic state transition, request lifecycle control, and authorization locking first. Remove the superseded graph and same-PR compatibility paths. Consolidate the repeated OpenAI-compatible transport behind the already-separate role ports.

## Test, CI, and build validation

Validation was performed from a clean archive of exact head `94bd5e`, with locked dependencies installed using Node `v24.18.0` and npm `11.16.0` (the repository declares npm `11.18.0`, while its engine accepts npm 11).

| Validation | Result |
| --- | --- |
| Remote refresh, PR/base/head resolution | Passed; exact identities are listed above. |
| `git diff --check origin/dev...origin/pr/204` | Passed. |
| `npm ci` | Passed in the clean review tree. |
| `npm run format:check` | Passed. |
| `npm run lint:ci` | Passed with zero warnings. |
| `npm run typecheck` | Passed for root, client, and server. |
| Root tests | Passed: 9 tests. |
| Client tests | Passed: 60 suites, 476 tests. |
| Server tests | Passed when run with local-listen permission: 113 suites, 1,693 tests. The first sandboxed canonical run failed only because three Supertest controller suites could not bind `0.0.0.0`; rerunning outside that sandbox restriction passed all server tests. |
| `npm run build` | Passed for both client and server production builds. |
| Prisma schema validation | Passed. |
| Targeted persistence/security unit suites | Passed: 5 suites, 122 tests. |
| Targeted Socratic/RAG unit suites | Passed: 6 suites, 103 tests. |
| Direct schema reproductions | Confirmed M2 (empty citations accepted), M3 (both disclosure flags true accepted), M4 (absent evidence with IDs accepted), and M7 (two missing `reviewSummary` keys rejected). |
| Local server E2E and Playwright acceptance | Not runnable: this environment cannot access `/var/run/docker.sock`, even after requesting the available escalation. No local pass is claimed. |
| GitHub required checks on exact head | Both `validate` and `acceptance` are completed with `failure`. |
| `npm audit` on the exact lockfile | 17 advisories: 11 high, 6 moderate, 0 critical. No dependency version/integrity graph changed in this PR, so these are recorded but not attributed as PR findings. |

The canonical `npm run check` components all pass when executed with the permissions their tests require. That does not supersede the red integration/acceptance jobs or the deterministic contract reproductions above; most validated defects are missing behavior that the current unit suite does not assert.

## Dependency and library usage assessment

- No new runtime or development dependency is added. `package.json` and `server/package.json` changes add scripts; lockfile changes are npm metadata/peer/dev classification churn rather than version or integrity changes.
- Existing Zod, NestJS, Prisma, and pgvector usage is generally appropriate. There is no reason to add a new OpenAI SDK solely for this review's fixes.
- The PR does not reuse Morshid's existing `common/upstream/upstream-retry-policy.ts`, despite implementing new retry loops that need exactly its bounded `Retry-After` and cancellation behavior.
- The three OpenAI-compatible role adapters duplicate a transport layer instead of sharing a small internal implementation. Independent model identities and ports are correct; independent copies of HTTP parsing/retry/limits are not.
- Official documentation checks confirmed the PostgreSQL locking behavior used in H5, OpenAI's current generated-token limit in M6, and NestJS OpenAPI required/constraint semantics in L2.
- Audit advisories were not promoted to findings because the PR does not change the dependency graph. They still need normal repository-level remediation outside this PR review.

## Dead, obsolete, duplicated, or over-engineered code

- Obsolete production graph: root `CompletionModule`, its provider token/factory/configuration, the old `output-policy` and `tutor` behavior stacks, and the registered-but-unused request classifier after the new orchestrator became the only chat path (M10).
- Premature/unfinished domain machinery: topic switch/resume/reopen logic and TopicState transition support without a production caller that can satisfy their contracts (H2/H3).
- Same-PR compatibility: legacy response-audit enum/backfill/constraint bypass and its migration test (M8).
- Same-PR migration churn: create/drop educational-analysis index and redundant audit indexes (L1).
- Duplicated custom transport: 1,889 lines across three model role adapters, with repeated cross-cutting defects (M11).
- New dead declarations: `studentMessageContent`, `GROUNDING_UNAVAILABLE`, and stale architecture follow-up text (L3).

## Investigated concerns that were proven correct or non-findings

The following areas were traced and should not be raised as review comments without new evidence:

- **Course isolation:** retrieval SQL is parameterized and scopes eligible material/chunks to the authoritative course. No cross-course RAG leak was found.
- **Current exact retrieval:** dropping HNSW was not reported as a present query-performance regression because `course-retrieval.repository.ts` intentionally materializes a course-scoped exact scan. M9 is the verified migration/documentation/test contradiction.
- **Analysis evidence scope:** accepted evidence IDs are checked against bounded, completed, same-topic context; IDs outside that set are rejected.
- **Prompt trust boundaries:** untrusted conversation/context is delimited and serialized; backend policy and citation allow-lists are not taken from student text.
- **Approval atomicity:** approved message content, retrieval rows, citations, candidate attempts, guard results, and turn completion are written in one short transaction. Rejected candidates are not exposed as student-visible messages.
- **Turn/status concurrency:** status transitions and topic-state repository updates use conditional/CAS behavior. H3 concerns the absent runtime state transition, not the correctness of the unused CAS implementation.
- **No long database transaction over model calls:** upstream calls occur outside the final persistence transaction.
- **Evidence revalidation:** selected chunks/materials are rechecked against course/material eligibility before final persistence.
- **Client behavior:** optimistic message identity, retry handling, presenter output for new `turnId`/`topicId`, and chat rendering were traced and were otherwise consistent.
- **Individual upstream protections:** response bodies are size-bounded and each provider call has its own timeout. M1 concerns the missing aggregate operation deadline/cancellation; M6 concerns generation-token limits.
- **Dependency additions:** none were introduced; audit output is not attributable to this diff.

## Final prioritized remediation checklist

1. Add terminal `UNSAFE` refusal and `OFF_TOPIC` redirect paths; prove downstream model/retrieval ports are not called.
2. Decide and implement the real V1 topic contract, then ensure the HTTP path can create/switch/resume without attaching the message to the wrong topic.
3. Atomically persist the required TopicState transition before marking a turn completed.
4. Make the production configuration bootable and require live analysis, tutor, and semantic-guard providers in production.
5. Lock the authoritative session and membership rows during final response persistence; add revocation/deletion race tests.
6. Introduce one request-wide deadline/cancellation signal and stale processing-turn recovery.
7. Enforce nonempty allow-listed grounding citations, false disclosure flags, and consistent absent-evidence schemas deterministically.
8. Reuse the shared retry policy and add per-role output-token caps.
9. Fix the acceptance response fixture and get both required GitHub jobs green on this exact head.
10. Remove the same-PR legacy compatibility bypass; reconcile the HNSW migration with schema docs/tests; remove redundant migration/index churn.
11. Remove the superseded completion/output-policy/tutor runtime and other dead declarations.
12. Consolidate the repeated OpenAI-compatible transport while retaining separate domain ports/configuration.
13. Correct OpenAPI required/nullability and hint-level bounds, then rerun `npm run check`, full server E2E, and Playwright acceptance against a freshly migrated database.

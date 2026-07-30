# Automatic output-policy contract

Issue #141 establishes one decision point between a proposed Tutor completion
and persistence or Student display. The decision is made before
`GroundedChatTurnRepository.completeTurn` receives content. A proposed response
therefore either passes unchanged or is replaced with fixed, Student-safe text;
the proposed unsafe text is neither persisted nor presented.

## Decision surface

The policy receives a deterministic assessment from an upstream detector:

| Signal | Stable review trigger | Student presentation |
| --- | --- | --- |
| Course support not found | `GENERAL_NOT_FOUND` | Missing-support / awaiting-review label |
| Distinct course sources conflict | `SOURCE_CONFLICT` | Conflict disclosure; neither source is settled truth |
| Prompt or retrieved-document policy check fails | `POLICY_CHECK_FAILED` | Refusal / awaiting-review label |
| Proposed output is a direct final answer | `FINAL_ANSWER_RISK` | Refusal / awaiting-review label |
| Required citation is absent | `CITATION_MISSING` | Citation-missing / awaiting-review label |

Each decision explicitly records `display`, `safeRefusal`, `createReview`,
stable reasons, bounded review evidence, and a Student-visible status. Refusal
takes precedence when several reasons apply. The evaluator has no model or
database dependency, so safety decisions are deterministic and unit-testable.

When review is needed, the adapter calls `ReviewCaseCreator.createAutomatic`
once for every stable reason, using a deterministic per-message/per-reason
event key. The shared creator aggregates those triggers onto the database's one
review case per assistant message. Retrying the same message reuses the same
event key; no consumer reaches into review persistence directly.

Evidence is deliberately bounded before the creator sees it: a fixed policy
summary, at most 20 source excerpts, each reduced to 500 Unicode code points,
and small fixed facts. Proposed output, raw system prompts, credentials, hidden
reasoning, and unrestricted source text are excluded from policy logs and
review-detector metadata.

## Deterministic fixtures

`server/src/modules/output-policy/automatic-safety.fixtures.ts` is the CI
oracle and maps one-to-one to the Sprint 3 safety matrix:

| Fixture | Behavior | Expected trigger |
| --- | --- | --- |
| SCN-01 | Clear supported answer | none |
| SCN-02 | Insufficient evidence | `GENERAL_NOT_FOUND` |
| SCN-03 | Controlled conflicting sources | `SOURCE_CONFLICT` |
| SCN-04 | Direct final-answer risk | `FINAL_ANSWER_RISK` |
| SCN-05 | Prompt injection | `POLICY_CHECK_FAILED` |
| SCN-06 | Retrieved-document injection | `POLICY_CHECK_FAILED` |
| SCN-07 | Duplicate retry | `GENERAL_NOT_FOUND`, same event key |
| SCN-08 | Routine safe content | none |

The fixtures are synthetic and contain no course material, credentials, or
system prompt text.

## Provider boundary

The deterministic completion and embedding providers remain mandatory for CI
assertions. A live qualification run may use the approved
`COMPLETION_PROVIDER=aws-bedrock` completion path with the already guarded
`EMBEDDING_PROVIDER=gemini` profile. Gemini embedding additionally requires
`GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED` and its separate key/project/quota
configuration. Live runs use synthetic, permission-safe fixtures; they never
replace deterministic policy assertions.

## Delivery boundary

This task establishes the deterministic decision and review-creator seam. The
upstream signals are deliberately supplied as an assessment so the later
vertical slices can add their bounded responsibilities without duplicating
review persistence: unsupported correctness-sensitive handling (#142),
controlled source-conflict detection (#143), and prompt/document-injection plus
final-answer enforcement (#144). Until those slices provide their signals, the
ordinary grounded-chat path remains clean-only apart from the existing
retrieval/citation state.

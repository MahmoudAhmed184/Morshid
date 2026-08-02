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
final-answer enforcement (#144). Signals owned by #143 and #144 remain
clean-only on the ordinary grounded-chat path until those slices activate them.

## Unsupported correctness-sensitive slice

Issue #142 activates `GENERAL_NOT_FOUND` only for the bounded Sprint 3
assessment patterns: explicit graded/homework/quiz/exam language,
assignment/exercise/problem/task language paired with a request to solve or
complete it, and direct requests for a full answer, implementation, or code.
Routine conceptual prompts remain on the existing non-review missing-source
path. This is deliberately a small deterministic request classifier, not a
general-purpose correctness or fact checker.

When trusted retrieval is unavailable for a covered request, completion is not
called. The assistant message is completed directly with the fixed safe
replacement, `UNCERTAIN_AWAITING_REVIEW`, no citations, and a canonical policy
reason code. The shared creator then creates the automatic case before the
response is returned. The persisted reason code lets an idempotent delivery
retry repair an interrupted case creation without generating another assistant
message; the creator's source-event key and one-case-per-message constraint keep
the case and trigger unique.

## Controlled source conflict slice

Issue #143 activates `SOURCE_CONFLICT` for the controlled P0 Python
integer-division fixture and the SCN-003 Question X schedule fixture. The
Student question must ask either whether `/` on integer operands produces an
integer or decimal/float result, or which day Question X is scheduled. The
schedule fixture requires one Monday claim and one Tuesday claim. Both opposing
claims must occur in retrieval ranks 1–2 and come from distinct materials.
Agreement, same-material wording, unrelated text, ambiguous claims, and
conflicts below rank 2 remain clean.

The schedule response names the Monday and Tuesday claims, cites both selected
materials, and explicitly treats neither day as settled course guidance.

Detection runs before completion. A match skips the provider, persists the
fixed controlled response with the two selected retrievals and citations, and
stores those same two bounded sources in immutable automatic-review evidence.
Replay uses the canonical `SOURCE_CONFLICT` reason and persisted selected
evidence to repair case creation without broadening the detector.

## Injection and final-answer safety slice

Issue #144 uses the versioned `automatic-safety-risk-v3` detector at three
ordered boundaries. Compound Student instruction-override or hidden-prompt
disclosure intent is checked after the idempotent turn is opened but before
retrieval. Retrieved chunks are checked for compound instruction injection
before completion. Proposed completion content is checked before any content or
provider metadata reaches persistence or Student display; full-answer and
full-code delivery is blocked only for correctness-sensitive requests. The
correctness-sensitive boundary includes implicit requests to build a program,
script, CLI, application, or game; requests for final working code or a
complete example; and attempts to conceal a deliverable in comments or markup.
The proposed output check recognizes complete top-level programs as well as
function-shaped solutions and detects code concealed in comments or details
markup. Short teaching snippets, hints, and partial debugging guidance remain
allowed.

The Student boundary also treats a first-person claim of Instructor or teacher
permission combined with a request to obtain an answer key, official solution,
or hidden prompt as an attempted policy override. Claimed authorization does
not relax either boundary. General questions about answer keys, reported future
review, security discussion, and requests for a hint remain clean.

Each match completes the assistant message with the fixed refusal,
`REFUSAL`, and canonical `POLICY_CHECK_FAILED` and/or `FINAL_ANSWER_RISK`
reasons. The terminal record has no retrievals, citations, provider, model,
prompt version, token counts, or raw detector excerpt. Automatic-review
evidence contains fixed summaries and bounded version/count facts only. This
keeps injected document text and unsafe completion content out of messages,
review detail, and policy logs while preserving replay repair and the shared
case/trigger uniqueness guarantees.

Quoted security discussion, ordinary uses of “ignore”, conceptual explanations,
hints, and partial debugging guidance are negative controls and do not trigger
the refusal path.

## Automatic safety live smoke

The combined smoke command is opt-in and uses only the synthetic SCN-01–SCN-08
fixtures:

```sh
AUTOMATIC_SAFETY_LIVE_SMOKE_ACKNOWLEDGED=true \
COMPLETION_PROVIDER=aws-bedrock \
EMBEDDING_PROVIDER=gemini \
GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED=true \
npm run test:automatic-safety:smoke
```

The ordinary provider credentials and model/profile configuration must also be
present. Standard output is one JSON object containing only scenario IDs,
provider/model/prompt identifiers, embedding profile/protocol, the fixture
hash, and counts. Failure output contains only `outcome` and the failed stage.
Neither path prints prompts, responses, excerpts, vectors, URLs, credentials,
raw errors, or stack traces.

A provider evidence record may be committed only after an explicitly approved
successful live run. It must contain the tested commit SHA, timestamp, outcome,
provider/model/prompt version, embedding profile/protocol, fixture identifier
and hash, scenario IDs, and counts—never copied provider payloads or content.

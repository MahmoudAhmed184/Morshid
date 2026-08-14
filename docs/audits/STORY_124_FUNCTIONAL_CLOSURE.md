# Story #124 Functional Closure

Date: 2026-08-10
Branch: `feature/socratic-runtime-v1-hardening`
Story: [#124 — Student receives progressive Socratic hints for problems and attempts](https://github.com/MahmoudAhmed184/Morshid/issues/124)

> Historical/superseded audit: this closure was written before the approved
> whole-workspace architecture refactor. It records behavior-level evidence,
> but references to `TutorTurn` and the prior implementation are not current
> architecture. Use the approved [refactor plan](../architecture-refactor-plan-2026-08-11.md)
> and ADRs for current ownership and contracts.

## Verdict

**DONE — functionally complete under the current TeachingDecision, RevealPolicy,
SocraticDisclosureContract, and Candidate → ApprovedResponse architecture.**

The closure gate evaluates semantic behavior, not the original Sprint 3 names or
implementation technique. No Phase 6 or P2 work is included. All Story #124
acceptance and validation rows are DONE.

## Functional implementation evidence

- Accepted Educational Analysis now reconciles the authoritative
  `Message.requestKind` on the Student message transactionally, including
  idempotent reuse.
- `tutor-response-requirements.v1` converts accepted request kind, StudentState,
  effort evidence, and Guidance Level into explicit positive semantic response
  requirements. It encodes the no-attempt, misconception, partial-attempt, and
  Level 4 obligations without phrase or regex matching.
- Tutor Generation prompt `tutor-generation.mvp.v3` treats those requirements as
  trusted policy. Semantic Guard `semantic-guard.mvp.v5` independently checks
  semantic equivalence and rejects a materially missing behavior.
- Reveal Policy remains `NO_FINAL_ANSWER`. The mandatory Structural →
  Deterministic → Semantic pipeline still protects exact numeric/prose answers,
  queries, algorithms, assignment implementations, and corrected submitted code.
- Completed and terminal response paths reload the reconciled Student message.
  The HTTP DTO and client schema now carry nullable `promptVersion`; non-null
  `hintLevel` is bounded to 1–4. Request kind, level, label, prompt version,
  content, and citations therefore round-trip through reload.
- Provider infrastructure retry remains inside candidate attempt 1 and one
  TutorTurn. HTTP retry continues to reuse the original Student and assistant
  message identities.

## Golden behavior notes

These are behavior-level results against the category contracts in
`docs/golden-dataset-p0-v1.md`; they are not claims about legacy phrase matching.

| Golden cases | Result | Observed behavior-level note |
| --- | --- | --- |
| `gd-p0-v1-001` | PASS | The cited conceptual E2E path remains `CONCEPTUAL`, explains the supported concept, carries `COURSE_GROUNDED`, and reloads its citation unchanged. |
| `gd-p0-v1-002`, `006`, `010`, `014`, `018`, `022`, `026`, `030`, `034`, `038`, `042`, `046`, `050`, `054` (`ASSIGNMENT_LIKE`) | PASS | `PROBLEM_LIKE` Level 1 requires asking what was tried plus one small starting hint; `NO_FINAL_ANSWER` and all guard stages protect the requested exact submission, program, condition, query, or algorithm. The vertical E2E exercises the same assignment-like contract with a loop problem. |
| `gd-p0-v1-004`, `008`, `012`, `016`, `020`, `024`, `028`, `032`, `036`, `040`, `044`, `048`, `052`, `056` (`PRACTICE_ATTEMPT`) | PASS | `ATTEMPT_DIAGNOSIS` requires misconception repair at Level 2 and acknowledgement plus one unsolved next reasoning step at Level 3. The vertical E2E observes both behaviors and reaches bounded analogous guidance at Level 4 without an exact solution. |

## Story #124 acceptance matrix

| Acceptance Criterion | DONE / PARTIAL / MISSING | Implementation Evidence | Test Evidence |
| --- | --- | --- | --- |
| Supported direct conceptual question remains functionally `CONCEPTUAL`, course-grounded, and cited. | DONE | Accepted analysis is authoritative; candidate citations remain course-scoped and only an ApprovedResponse is persisted. | `socratic-chat.e2e-spec.ts`: “keeps a supported conceptual turn classified, course-grounded, cited, and unchanged after reload”. |
| Assignment/problem-like prompt with no attempt is `PROBLEM_LIKE`, starts at Level 1, asks what was tried, and gives one small starting hint. | DONE | `tutor-response-requirements.v1` sets `askWhatStudentTried` and `smallStartingHintCount: 1`; policy starts a new topic at Level 1. | Prompt-builder requirement test and Story #124 vertical E2E first turn. |
| Weak/incorrect attempt is `ATTEMPT_DIAGNOSIS`, identifies the likely misconception, uses Level 2, and asks one meaningful guiding question. | DONE | Accepted misconception evidence selects misconception repair; Level 2 requirements demand the misconception diagnosis and one semantic guiding question. | Story #124 vertical E2E second turn; Teaching Policy transition unit tests. |
| Partial attempt acknowledges the correct part, identifies the next reasoning step without solving, and reaches Level 3 when evidence justifies it. | DONE | Level 3 attempt requirements demand supported-work acknowledgement and the next unsolved reasoning step; escalation requires current meaningful evidence. | Story #124 vertical E2E third turn; Teaching Policy evidence tests. |
| Repeatedly stuck Student can reach Level 4 and receive an analogous example or equivalently strong bounded guidance while the original solution remains protected. | DONE | Level 4 requires analogous or bounded strong guidance; independent Reveal Policy remains `NO_FINAL_ANSWER`. Duplicate/non-responsive effort does not game escalation, while successive meaningful attempts can reach Level 4. | Story #124 vertical E2E fourth turn; Level 4 and repeated-effort policy unit tests. |
| Problem/attempt responses never reveal the protected exact numeric answer, prose answer, query, algorithm, assignment implementation, or corrected submitted code. | DONE | Candidate boundary plus Structural → Deterministic → Semantic approval; disclosure contract, canonical `FINAL_ANSWER_DISCLOSURE`, `DIRECT_ANSWER_DISCLOSURE`, `COMPLETE_SOLUTION_DISCLOSURE`, `CODE_LEAKAGE`, and `SUBMISSION_READY_CODE` enforcement; cumulative disclosure is checked. | Deterministic Guard disclosure table; Semantic Guard target-inference/CODE_LEAKAGE tests; semantic over-reveal regeneration E2E; vertical E2E forbidden-output assertions. |
| Request kind, hint level, source label, prompt version, content, and citations survive reload unchanged; exact DTO fields remain populated. | DONE | Educational Analysis reconciles Student `requestKind`; approved assistant persists `hintLevel`, `guidanceLabel`, `promptVersion`, content, and citation graph; presenter and client schema expose them. | Conceptual response-versus-reload deep equality E2E; Educational Analysis repository persistence E2E; client schema metadata/bounds test. |
| Provider failure/retry reuses Student message/turn identity and does not advance the pedagogical ladder twice. | DONE | Infrastructure retry is internal to candidate attempt 1 and the same TutorTurn. Failed HTTP retry reuses the existing Student/assistant message records and accepted analysis/decision. | Timeout E2E: two provider calls, one candidate row, one TeachingDecision, same message/turn links, Level 1; failed/retried-turn E2E: identical message IDs. |
| Hint/progression history is isolated by Student chat session. | DONE | Previous TeachingDecision and TopicState loads are session/topic scoped. | `socratic-chat.e2e-spec.ts`: “isolates guidance history by chat session” observes `[1,2]` versus independent `[1]`. |
| Unit coverage proves classification/equivalent request-kind behavior and all Level 1–4 transitions. | DONE | Canonical enums are validated and accepted classification is persisted; Teaching Policy bounds and evidence rules select each level. | Educational Analysis classification parameterization; Teaching Policy selector suite; prompt response-requirement parameterization. |
| Unit/integration coverage proves failed/retried turns do not skip a level. | DONE | Infrastructure retry metadata is operational, not pedagogical evidence. | Tutor infrastructure retry policy unit tests and timeout/failed retry Socratic E2E cases. |
| Repository/service coverage proves request-kind and guidance/hint persistence. | DONE | Student request kind is reconciled in the accepted-analysis transaction; assistant level is written only with approved output. | `educational-analysis-persistence.e2e-spec.ts`, `message-turn-topic-linkage.e2e-spec.ts`, and conceptual reload E2E. |
| One vertical E2E covers no-attempt problem followed by Student attempts. | DONE | Production orchestration path is used with deterministic model ports only at external provider boundaries. | Story #124 four-turn E2E observes request kinds and levels `[1,2,3,4]`. |
| Existing cited conceptual chat has explicit regression coverage. | DONE | Conceptual behavior remains separate from problem/attempt response requirements. | Cited conceptual response/reload E2E and Student chat citation presentation unit test. |
| Relevant problem-like and practice-attempt golden cases have behavior-level pass/fail notes. | DONE | Category behavior is mapped to current request-kind, TeachingDecision, response-requirement, Reveal Policy, and guard contracts. | Golden behavior notes table above; representative Story #124 vertical E2E is PASS. |
| Canonical check and relevant server/browser suites pass. | DONE | No live-provider dependency is needed to prove deterministic policy, persistence, retry, or UI contracts. | `npm run check`, Story-relevant server E2E suites, Gate 2, and the progressive-hint Student workspace Playwright scenario pass. Gated Gemini checks were not needed for this closure gate. |

## Validation summary

- `npm run check`: PASS — 48 client suites/332 tests, 79 server
  suites/1,306 tests, plus formatting, strict lint, type checks, and both
  production builds.
- Story-relevant persistence/orchestration E2E: PASS — Socratic chat 19/19,
  Teaching Decision plus Socratic persistence 10/10, and Gate 2 2/2.
- Client chat contract: PASS — 14/14, including exact `promptVersion` presence
  and Guidance Level bounds.
- Progressive Level 1–4 browser proof: PASS — 1/1. The local `.env` files were
  not edited; a command-scoped distinct Semantic Guard model name was used only
  to satisfy the H-06 startup role-isolation check for this route-mocked proof.
- Live-provider output was not used as acceptance evidence. A diagnostic run of
  the existing conceptual browser path received an analysis-provider 429, so
  deterministic provider-boundary tests remain the reproducible closure gate.

## Exhaustive-suite observations outside Story #124

The exhaustive server E2E command was also run. It retains two failures that
are outside the H-09 functional closure scope:

- `materials-persistence.e2e-spec.ts` has two five-second timeouts while the
  local Gemini embedding provider is quota-denied. The other two tests in that
  suite pass.

These observations do not exercise a Story #124 acceptance row and no P2 index
or live-provider test-infrastructure work was pulled into H-09. Deterministic
provider-boundary coverage supplies the required Story evidence.

The current local runtime also aliases `ANALYSIS_MODEL_NAME` and
`SEMANTIC_GUARD_MODEL_NAME`. H-06 correctly refuses that configuration; local
manual/live runs require distinct deployed model identifiers. Repository
configuration was not weakened or changed to bypass this check.

## Scope boundary

- No Phase 6 work was started.
- No streaming or RetrievalQueryBuilder redesign was introduced.
- No course isolation, grounding, Reveal Policy, Semantic Guard, fail-closed,
  rejected-candidate isolation, or Candidate → ApprovedResponse boundary was
  weakened.
- No P2 work was pulled into H-09.

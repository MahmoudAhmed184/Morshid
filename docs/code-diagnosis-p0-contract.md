# Python Code Diagnosis P0 Contract

Task: #132 / stable task ID `S3.2.1`

Parent story: #125 / stable plan ID `S3.2`

Policy version: `python-code-diagnosis-policy-v1`

## Purpose and Ownership

This document locks the contract and deterministic fixtures that later tasks
use to implement the Python diagnosis journey. It does not add a chat endpoint,
Tutor orchestrator, persisted strategy, browser flow, live-provider call, or
production Output Guard.

The implementation reuses these existing boundaries:

- `GroundedChatService` remains the only persisted chat orchestration path.
- `MessageRequestKind.CODE_DIAGNOSIS` and
  `MessageGuidanceLabel.COURSE_GROUNDED` remain the persistence/API vocabulary.
- Course authorization and retrieval remain in the shared course-scoped path.
- Completion remains textual, with citations persisted from retrieved evidence.
- The existing grounded completion envelope treats Student text and retrieved
  content as untrusted data.

The `TutorDecision` schema added for this task is the minimum contract seam
needed because the S3.1.1 implementation was not present on the baseline. It is
not a classifier or executable strategy. A code diagnosis decision has:

- request kind `CODE_DIAGNOSIS`;
- strategy `PYTHON_CODE_DIAGNOSIS`;
- no Socratic hint level;
- required authorized course evidence;
- the `COURSE_GROUNDED` label;
- explicit prohibitions on corrected code, prompt disclosure, execution claims,
  and invented citations.

## Python and Scope Boundary

`PYTHON_CODE_DIAGNOSIS_MAX_LINES` is exactly `100`.

Line normalization is deterministic:

1. Normalize CRLF and lone CR to LF.
2. Remove surrounding blank lines.
3. Ignore a trailing newline as a line of code.
4. Count every remaining line, including internal blank and comment lines.
5. When one fenced code block is present, count the code inside that fence.

| Boundary state             | Meaning                                                                              | Safe expected state                                                  |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `SUPPORTED`                | Strong Python signal and at most 100 normalized lines.                               | Eligible for the shared `CODE_DIAGNOSIS` decision.                   |
| `CLEARLY_NON_PYTHON`       | A labelled non-Python fence or multiple strong JavaScript, Java, or C-style signals. | Explain that P0 supports Python only; do not pretend to diagnose.    |
| `INSUFFICIENT_INFORMATION` | The input is ambiguous rather than clearly non-Python.                               | Ask for a short Python snippet or more information.                  |
| `TOO_MANY_LINES`           | Python signal with more than 100 normalized lines.                                   | Request reduction; no diagnosis and zero completion-provider calls.  |
| `UNSUPPORTED_SCOPE`        | More than one code block, representing multi-file scope.                             | Explain the single-snippet boundary; zero completion-provider calls. |

Detection is intentionally conservative and does not claim perfect
programming-language identification. Words such as `ignore`, `system`, and
`prompt` do not make otherwise supported Python invalid.

P0 is static reasoning only. It excludes interpreters, subprocesses, shells,
VMs, sandboxes, `eval`, dynamic imports of Student-controlled modules, package
installation, repository analysis, multi-file analysis, profiling, corrected
downloads, and execution claims.

## Diagnosis Semantics

The internal semantic schema contains only:

```text
likelyDefect
location
conceptExplanation
nextInspectionStep
citations
```

It has no corrected-program, patch, execution-output, or code-ran field.
`nextInspectionStep` is one field, and fixtures additionally lock
`nextInspectionStepCount: 1`.

The schema is not a parallel public response model. Task #133 must serialize
these semantics through the existing textual completion and chat citation
contracts. When a response is course-grounded, its material/chunk citation
references must resolve to authorized retrieved evidence. No source claim may
be invented.

## Untrusted Input Boundary

All dynamic fields stay untrusted:

- Student message and code;
- comments, strings, and identifiers inside code;
- error text;
- retrieved course content.

Instruction-like comments and strings remain eligible fixture data. They cannot
change the authoritative strategy, reveal prompts, or authorize a full rewrite.
The existing authoritative-first grounded completion envelope remains the
provider trust boundary.

## Problem-Based Retrieval Query

The retrieval-query builder accepts only:

- language `python`;
- a controlled suspected-category enum;
- a controlled location-hint enum;
- controlled diagnostic-signal enums;
- at most two short identifiers, only for diagnostically useful name lookup.

It has no field for a Student message, raw code, comment, string, or error
payload. For `gd-p0-v1-058`, the locked query is problem-based:

```text
Python a possible variable-name mismatch or unresolved name near the loop body;
study name lookup and local scope. Diagnostic signals: singular and plural
identifiers may not match. Relevant identifiers: num, nums.
```

The query describes a suspected problem rather than claiming certainty. Task
#133 may pass the result into the existing authorized retrieval path; it must
not replace course scoping or embed the complete Student program by default.

## Fixtures and Scenario Linkage

The machine-readable dataset is
`fixtures/golden-dataset/python-code-diagnosis-p0.json`. It uses behavior-level
semantic fields instead of exact response paragraphs and covers:

- syntax, name lookup, index access, loop/indentation, function usage,
  dictionary access, string handling, and file handling;
- clearly JavaScript, Java, and C inputs;
- ambiguous input;
- 99, 100, and 101 normalized lines;
- a full-correction request;
- instruction-like text in a comment and in a string;
- multi-block/multi-file scope.

`gd-p0-v1-058` has `linkedDemoScenarioId: "SCN-005"`. It locks the `num`/`nums`
mismatch, the `len(num)` return expression, name lookup and local scope, exactly
one next inspection step, `p0-npt-part-02` citation support, and the prohibition
on a corrected function.

## Output Guard Contract for Task #134

The later pre-display guard must return one of:

- `ALLOWED_DIAGNOSIS`;
- `INVALID_RESPONSE_SHAPE`;
- `FULL_REWRITE_SUSPECTED`;
- `CODE_BLOCK_TOO_LARGE`;
- `PROMPT_DISCLOSURE`;
- `EXECUTION_CLAIM`;
- `INVALID_CITATION`;
- `UNSUPPORTED_SCOPE`.

Task #134 should combine structured-response validation, deterministic
heuristics, regular expressions, bounded code-block line counting, and citation
validation. Representative checks include missing required semantic fields,
large code fences, complete `def` or `class` bodies, complete-correction
phrasing, hidden-prompt disclosure, execution claims, and citations outside the
authorized evidence set. It must not add a second LLM reviewer.

## Validation Modes

### Deterministic mode

Deterministic validation is required for CI and pull requests. It uses no
network, credentials, completion provider, embeddings, interpreter, or Student
code execution. Focused tests validate the contracts, fixtures, boundaries,
retrieval-query builder, and architecture assertion. The repository gate
remains:

```bash
npm run check
```

### Later live-provider mode

Live validation is intentionally deferred until Tasks #133-#135 provide the
strategy and complete journey. It must be opt-in, use approved synthetic and
permission-safe inputs, retain the same fixture expectations, and record only
redaction-safe provider/model/profile metadata and pass/fail results. A live
result never replaces or weakens deterministic CI assertions.

## Deferred Work

- #133: production strategy, authorized retrieval integration, provider call,
  persistence, citations, UI rendering, reload recovery, and real-provider path.
- #134: complete pre-provider rejection, call-count enforcement in the live
  chat path, and production pre-display Output Guard/fallback.
- #135: full golden-suite report, browser acceptance proof, live-provider
  validation, and fresh-seed Gate rehearsal.

The referenced `docs/sprint-3-plan.md` was absent from the implementation
baseline. Scope was cross-checked against GitHub issues #125, #128, and #132
without inventing the missing Sprint plan document.

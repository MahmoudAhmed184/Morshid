# Python Code Diagnosis: Value and Scope

> Historical research evidence: this note describes the pre-refactor
> completion/GroundedChat/Python diagnosis paths. Those paths were removed by
> the approved architecture; the current generic debugging-guidance workflow
> is documented by the plan and tutoring ADRs.

## Question

M10 retained the legacy completion/output-policy runtime because the supported
Python diagnosis flow still depends on it. This note verifies what that flow
does, whether it has product value, and whether the product is intended to be
general rather than Python-only.

## What the runtime actually does

The public Student chat path selects a strategy before creating a turn. When a
supported diagnosis is selected, `GroundedChatService` branches to
`orchestrateDiagnosis`; ordinary non-diagnosis requests continue through the
Socratic orchestrator instead. See [`grounded-chat.service.ts`](../../server/src/modules/student-chat/grounded-chat.service.ts#L174-L252)
and [`grounded-chat.service.ts`](../../server/src/modules/student-chat/grounded-chat.service.ts#L316-L423).

For a diagnosis request, the implementation:

1. Accepts one Python snippet, or plain Python code, with a normalized limit of
   100 lines. It rejects clearly non-Python input, ambiguous input, multiple
   code blocks, and oversized input at the boundary.
2. Performs deterministic static pattern analysis. The current categories are
   syntax, name lookup, index access, loop/indentation, function usage,
   dictionary access, string handling, and file handling. It does not execute
   the code or invoke a Python interpreter.
3. Builds a bounded retrieval query from the suspected category, location, and
   diagnostic signals rather than sending the complete raw snippet as a search
   query.
4. Retrieves course evidence and invokes the completion provider with the
   explicit `PYTHON_CODE_DIAGNOSIS` strategy. The legacy completion provider is
   therefore an active production dependency, not dead code.
5. Requires four constrained sections: likely defect, relevant location, Python
   concept, and exactly one next inspection step. A course citation is required
   in the concept explanation.
6. Runs output and safety checks, blocks prompt disclosure, execution claims,
   invalid citations, excessive code, and full corrected programs, then uses a
   safe fallback if the generated response fails validation.
7. Evaluates the result through the output-policy service and persists the
   response, model metadata, prompt version, evidence, citations, and possible
   review state.

The active dependency is visible at
[`grounded-chat.service.ts`](../../server/src/modules/student-chat/grounded-chat.service.ts#L425-L639):
the code calls the completion provider at lines 505–520, validates the result at
523–539, evaluates output policy at 563–584, and persists the finalized turn at
586–629.

## Does it have actual value?

Yes, as a deliberately narrow educational feature. For a beginner who asks
why a short Python program fails, it can transform a vague debugging request
into a bounded learning prompt: identify a likely defect, locate it, explain the
relevant concept using course material, and ask the student to perform one
inspection. For example, the existing `num` versus `nums` fixture can point to
the likely name/scope mismatch without handing back the corrected program.

That is materially different from either returning a generic refusal or
generating a complete solution. It supports the product's stated learning
objective: guidance that helps the student reason rather than replacing the
student's work. The repository's product description explicitly defines code
diagnosis as identifying bugs, explaining the concept, and giving a hint while
not fixing the code; see [`project-description.md`](../project-description.md#L197-L206).

The educational rationale is also consistent with primary research. A
systematic review of 43 debugging interventions found promising improvements
in debugging accuracy and learning, while noting that systematic-strategy
adoption and transfer remain difficult. See [Yang et al., *Decoding Debugging
Instruction*](https://doi.org/10.1145/3690652). A large ICSE experiment found
that automated feedback helped novices resolve compilation errors more
efficiently, but the advantage was primarily logistical and disappeared on
exams when feedback was withdrawn. See [Ahmed et al., *Characterizing the
Pedagogical Benefits of Adaptive Feedback for Compilation Errors*](https://2020.icse-conferences.org/details/icse-2020-Software-Engineering-Education-and-Training/5/Characterizing-the-Pedagogical-Benefits-of-Adaptive-Feedback-for-Compilation-Errors-b).

Therefore the precise claim is:

- The feature has real product value as guided, course-grounded static
  diagnosis and is behaviorally validated in this repository.
- The feature is not proven, by the current repository, to improve learning,
  retention, or independent debugging skill. The current tests establish
  routing, safety, output shape, persistence, and citation behavior; they are
  not a learning-outcome study.
- It is not a general debugger. It is heuristic static triage plus constrained
  grounded feedback; it does not provide runtime traces, test execution, AST or
  compiler diagnostics, multi-file analysis, or broad language support.

## Is the product supposed to be general?

There are two different scopes, and they should not be conflated.

The product vision is broader than Python. The MVP is framed around computing
courses including programming, software engineering, databases, networks, AI,
and theoretical computing; see [`project-description.md`](../project-description.md#L46-L59).
The generic Socratic architecture also models `CODE_DIAGNOSIS` as a request
kind without making the generic tutoring loop Python-specific.

However, the protected P0 implementation contract is explicitly Python-only:

- [`morshid-decisions.md`](../morshid-decisions.md#L99-L109) says P0 supports
  static Python diagnosis, approximately 100 lines, with no execution.
- [`project-delivery-plan.md`](../project-delivery-plan.md#L214-L224) calls the
  outcome “Python-only static code diagnosis.”
- The scope guardrails protect one seeded Python course and static Python
  diagnosis; see [`project-delivery-plan.md`](../project-delivery-plan.md#L778-L789).
- The implementation contract, retrieval query, prompt, strategy, and output
  guard are all Python-specific.

So the correct product statement is: **Morshid is a broader Socratic learning
assistant, with Python-only static code diagnosis in the protected P0 slice.**
It would be inaccurate to claim that the current code diagnosis implementation
already supports arbitrary languages or all computing courses.

## M10 conclusion

M10's removal recommendation was reasonable for the earlier reviewed graph if
no production consumer remained. In the current supported graph, removing the
legacy completion/output-policy runtime without migrating this branch would
break the Student chat diagnosis endpoint. Retaining it is justified for P0,
but it should be described as a compatibility boundary for the Python diagnosis
slice, not as the architecture for the general Socratic tutor.

If broader code diagnosis is required later, the durable path is to define a
language-neutral diagnosis contract and put language-specific boundary,
static-analysis, retrieval, prompt, and output-validation adapters behind it.
Python should become the first adapter, and a second language should be added
with its own fixtures and end-to-end tests before claiming general support.
The shared policy should remain static-only, course-grounded where required,
cited, Socratic, and resistant to full-solution leakage.

## Local validation

The focused validation for this audit passed: 6 server suites and 118 tests,
including strategy decisions, golden diagnosis fixtures, output guards,
grounded-chat diagnosis behavior, and completion-envelope behavior. The
repository's previously completed full check, server E2E, and acceptance runs
also passed before this research-only note was created.

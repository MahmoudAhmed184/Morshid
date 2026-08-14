# 11. Tutoring Engine & Socratic Runtime

The Tutoring subsystem implements Morshid's core Socratic teaching workflow. Governed by [ADR 0002](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0002-one-tutoring-runtime-and-attempt.md), it exposes a single external execution seam: `TutoringRuntime.run(command): Promise<TutoringTurnReceipt>`.

---

## 1. The 7-Phase Socratic Runtime Pipeline

Every student message is processed through a strict, multi-stage educational workflow:

```mermaid
flowchart TD
    Start([Student Sends Turn]) --> P1[Phase 1: Admission & Concurrency Lock]
    P1 --> P2[Phase 2: Topic Resolution & TopicState Snapshot]
    P2 --> P3[Phase 3: Educational Analysis]
    
    P3 --> SpecialCheck{Unsafe / Off-Topic?}
    SpecialCheck -->|Yes| Canned[Emit Policy Response & Skip to Finalize]
    SpecialCheck -->|No| P4[Phase 4: Pedagogical Decision & Policy Selection]
    
    P4 --> P5[Phase 5: Evidence Query & Vector Retrieval]
    P5 --> P6[Phase 6: Tutor Generation & 3-Stage Validation Loop]
    
    subgraph ValLoop["3-Stage Validation Loop (Up to 3 Attempts)"]
        G1[Generate Candidate Response] --> V1{Stage 1: Structural Validator}
        V1 -->|Pass| V2{Stage 2: Deterministic Guard}
        V2 -->|Pass| V3{Stage 3: Semantic Guard}
        V3 -->|Approved| Approved[Approved Socratic Response]
        
        V1 -->|Fail| Retry{Retries < 3?}
        V2 -->|Fail| Retry
        V3 -->|Fail| Retry
        Retry -->|Yes| G1
        Retry -->|Exhausted| Fallback[SafeFallbackService: Deterministic Probe]
    end
    
    P6 --> ValLoop
    Approved --> P7[Phase 7: Atomic Finalization & Receipt Emission]
    Fallback --> P7
    Canned --> P7
    P7 --> End([Return TutoringTurnReceipt to Client])
```

---

## 2. Detailed Phase-by-Phase Breakdown

### Phase 1: Turn Admission & Row Locking
- **Files**: [`tutoring-turn.repository.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/attempt/tutoring-turn.repository.ts) (`beginTurn`) and [`prisma-conversation-turns.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/conversations/prisma-conversation-turns.ts) (`admit`).
- **Concurrency Locking**: Executes a PostgreSQL `SELECT ... FOR UPDATE` row lock on `chat_sessions` and `course_memberships`.
- **Idempotency**: Verifies `clientMessageId`. If the message was already processed for this session, replays the existing receipt immediately.
- **Turn Allocation**: Inserts the student `Message` row (`status: COMPLETED`) and allocates a pending assistant `Message` row (`status: PENDING`, `responseToMessageId: studentMessage.id`).
- **Attempt Initialization**: Inserts a `tutoring_attempts` record with status `RECEIVED` and a 5-minute lease (`leaseExpiresAt`).

### Phase 2: Topic Resolution & `TopicState` Snapshot
- **Files**: [`topic.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/topic/topic.service.ts) and [`topic-state.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/topic/topic-state.service.ts).
- **Resolution**: Maps the inquiry to a curriculum `Topic` node or falls back to `TopicType.UNCLASSIFIED`.
- **State Snapshot**: Loads the student's `TopicState` record containing cumulative attempt counts, current guidance level (1–4), detected misconceptions, and mastery level.

### Phase 3: Educational Analysis
- **Files**: [`educational-analysis.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/analysis/educational-analysis.service.ts) and [`educational-analysis.prompt.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/analysis/educational-analysis.prompt.ts).
- **Model Role**: `ANALYSIS_MODEL_*` (`Qwen/Qwen2.5-14B-Instruct`).
- **Untrusted Boundary Isolation**:
  ```text
  <<<BEGIN_MORSHID_UNTRUSTED_ANALYSIS_CONTEXT_V1>>>
  {"studentMessage":..., "selectedHistory":..., "activeTopic":..., "topicState":...}
  <<<END_MORSHID_UNTRUSTED_ANALYSIS_CONTEXT_V1>>>
  ```
- **Output Schema (`EducationalAnalysisResult`)**:
  - `requestKind`: `CONCEPTUAL | PROBLEM_LIKE | ATTEMPT_DIAGNOSIS | CODE_DIAGNOSIS | AMBIGUOUS | OFF_TOPIC | UNSAFE`
  - `studentState`: `UNKNOWN | NO_PRIOR_KNOWLEDGE | PARTIAL_UNDERSTANDING | MISCONCEPTION | DEBUGGING_ISSUE | NEAR_SOLUTION`
  - `effortEvidence`: Assesses student reasoning quality and whether previous hints were applied.
  - `misconceptions`: Identified misconception codes and confidence scores.
  - `recommendedStrategy` & `recommendedGuidanceLevel` (1 to 4).

### Phase 4: Teaching Policy Selection
- **Files**: [`teaching-policy.selector.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts).
- **Strategy Mapping**:
  - `NO_PRIOR_KNOWLEDGE` -> `GUIDED_EXPLANATION`
  - `PARTIAL_UNDERSTANDING` / `NEAR_SOLUTION` -> `SOCRATIC_QUESTIONING`
  - `MISCONCEPTION` -> `MISCONCEPTION_REPAIR`
  - `DEBUGGING_ISSUE` -> `DEBUGGING_GUIDANCE`
- **Non-Negotiable Guard Policy (`fixedGuardPolicy`)**:
  ```typescript
  export const fixedGuardPolicy = {
    preventDirectAnswer: true,
    preventFinalResult: true,
    preventCompleteSolution: true,
    preventSubmissionReadyCode: true,
    preventProtectedCodeLeakage: true,
    requireStudentReasoning: true,
    requireGrounding: true,
    enforceCitationSupport: true,
    maximumDisclosedSteps: 1,
  }
  ```

### Phase 5: Evidence Query & Vector Retrieval (RAG)
- **Files**: [`retrieval-query.builder.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/evidence-query/retrieval-query.builder.ts) and [`materials-course-evidence.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/materials/evidence/materials-course-evidence.ts).
- **Course Readiness Verification**: Checks that 100% of candidate materials in the course are indexed in the active vector space.
- **Cosine Similarity Search**: Performs pgvector `<=>` distance scan, filtering by `RETRIEVAL_MIN_SIMILARITY` (0.62) and selecting top-K (5).

### Phase 6: Tutor Candidate Generation & 3-Stage Response Approval
- **Files**: [`tutor-generation.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/generation/tutor-generation.service.ts) and [`response-approval.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/response-approval.service.ts).
- **Prompt Boundaries**:
  - `<<<TRUSTED_BACKEND_POLICY>>>`: Instructions, reveal policy, and maximum disclosure limits.
  - `<<<UNTRUSTED_CONVERSATION_CONTENT>>>`: Recent conversation history.
  - `<<<UNTRUSTED_RETRIEVED_CONTENT>>>`: Ranked course chunks with assigned citation IDs (`CIT-1`, `CIT-2`).
- **Validation Pipeline (3 Stages)**:
  1. **Stage 1: Structural Validation** ([`structural-response.validator.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/structural-response.validator.ts)): Enforces JSON schema, non-empty response, and valid citation ID allowlist.
  2. **Stage 2: Deterministic Guard** ([`deterministic-guard.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/deterministic-guard.service.ts)): Regular expression evaluation detecting direct solutions, full function definitions, executable code blocks, or excessive step disclosure.
  3. **Stage 3: Semantic Guard** ([`semantic-guard.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.service.ts)): Evaluates candidate via `SEMANTIC_GUARD_MODEL_*` for subtle over-reveal, answer leakage, or educational non-compliance.
- **Safe Fallback ([`safe-fallback.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/safe-fallback.service.ts))**: If all 3 generation attempts are rejected, constructs a deterministic Socratic probing question tailored to the selected pedagogical strategy without failing the request.

### Phase 7: Atomic Finalization
- **Files**: [`tutoring-turn.repository.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/attempt/tutoring-turn.repository.ts) and [`prisma-conversation-turns.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/conversations/prisma-conversation-turns.ts).
- **Database Transaction (ADR 0007)**:
  1. Updates assistant `Message` (`status: COMPLETED`, content, citations).
  2. Updates student `Message` with detected `topicId` and `requestKind`.
  3. Persists `TopicState` with optimistic locking (`WHERE topic_id = id AND version = expectedVersion`).
  4. Inserts `MessageRetrieval` and `MessageCitation` records.
  5. Inserts `TutoringCandidateAttempt` and `GuardResult` records for auditability.
  6. Sets `TutoringAttempt.status = COMPLETED` and clears lease.
  7. Emits structured `audit_logs` entry.
- **Receipt Returned**: Returns `TutoringTurnReceipt` containing presented messages and citations.

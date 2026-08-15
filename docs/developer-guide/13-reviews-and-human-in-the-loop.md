# 13. Reviews and human-in-the-loop workflow

The reviews subsystem handles human oversight, moderation queues, automated safety escalation, and instructor feedback delivery. Per [ADR 0003](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0003-reviews-owned-student-inbox.md), the `reviews` module owns review case intake, instructor queue workflows, resolution actions, and the student review inbox in one domain.

---

## 1. System architecture and lifecycle

```mermaid
graph LR
    subgraph Triggers["Review triggers"]
        T1["Student flag<br/>(STUDENT_REQUEST)"]
        T2["Policy check failed<br/>(POLICY_CHECK_FAILED)"]
        T3["Missing citation<br/>(CITATION_MISSING)"]
        T4["Source conflict<br/>(SOURCE_CONFLICT)"]
    end

    subgraph CoreReview["Reviews module (server/src/modules/reviews)"]
        Intake["Review case intake<br/>(ReviewCaseCreator)"]
        Queue["Instructor review queue<br/>(InstructorReviewQueueService)"]
        Resolution["Review resolution<br/>(InstructorReviewActionService)"]
        Inbox["Student review inbox<br/>(StudentReviewInboxService)"]
    end

    subgraph Actors["Actors"]
        Inst[Instructor]
        Student[Student]
    end

    T1 & T2 & T3 & T4 --> Intake
    Intake --> Queue
    Inst -->|Resolves or rejects| Resolution
    Queue -.-> Inst
    Resolution --> Inbox
    Student -->|Reads resolution| Inbox
```

---

## 2. Data model and enums

Defined in [`server/prisma/reviews.prisma`](file:///home/mahmoud-ahmed/Projects/Morshid/server/prisma/reviews.prisma).

### 2.1 Enums

- `ReviewTriggerType`:
  - `STUDENT_REQUEST`. Student requested review on a specific chat turn.
  - `POLICY_CHECK_FAILED`. Safety or teaching policy check failed.
  - `CITATION_MISSING`. Assistant turn produced assertions without supporting citations.
  - `SOURCE_CONFLICT`. Retrieved chunks contained conflicting claims.
  - `FINAL_ANSWER_RISK`. Assistant response risked leaking direct solutions.
  - `GENERAL_NOT_FOUND`. Retrieval found no relevant course material chunks.
- `ReviewStatus`:
  - `PENDING`. Waiting in the instructor moderation queue.
  - `IN_REVIEW`. Currently claimed or viewed by an instructor.
  - `RESOLVED`. Instructor approved, edited, or replaced the guidance.
  - `REJECTED`. Instructor rejected the student review request.
- `StudentFlagReason`:
  - `INCORRECT`. Student flagged the response as factually wrong.
  - `CONFUSING`. Student flagged the explanation as unclear.
  - `UNHELPFUL`. Student flagged the guidance as unhelpful.
  - `COURSE_MISMATCH`. Content did not match the course syllabus.
  - `TOO_MUCH_ANSWER`. Content gave away the solution directly.
  - `OTHER`. Student entered a custom reason.
- `ReviewOutcome`:
  - `APPROVED`. Instructor confirmed the original Socratic response was accurate.
  - `EDITED`. Instructor modified the response text.
  - `REPLACED`. Instructor wrote a new explanation.
  - `REQUEST_REJECTED`. Instructor rejected the review request.

---

## 3. End-to-end review lifecycle trace

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Chat as Student chat UI
    participant Intake as ReviewCaseController
    actor Instructor
    participant Queue as Instructor review workspace
    participant ResSvc as InstructorReviewResolutionController
    participant Inbox as Student review inbox
    participant DB as PostgreSQL (Tx)

    Note over Student,Chat: Phase 1: Review intake
    Student->>Chat: Clicks 'Request Instructor Review' with reason
    Chat->>Intake: POST /api/v1/messages/:messageId/review-requests (Idempotency-Key)
    Intake->>DB: BEGIN Tx -> INSERT INTO review_cases (status=PENDING, version=1)
    Intake->>DB: INSERT INTO review_triggers (type=STUDENT_REQUEST)
    Intake->>DB: INSERT INTO audit_logs (action=review.case_created)
    Intake->>DB: COMMIT Tx
    Intake-->>Chat: 201 Created (Review Case ID)
    Chat->>Student: Shows 'Under Instructor Review' badge

    Note over Instructor,Queue: Phase 2: Moderation queue
    Instructor->>Queue: Opens /instructor/reviews -> GET /api/v1/instructor/reviews
    Queue-->>Instructor: Returns pending review cases for assigned courses
    
    Note over Instructor,ResSvc: Phase 3: Resolution action
    Instructor->>ResSvc: POST /api/v1/instructor/reviews/:id/resolve (Idempotency-Key)
    Note over ResSvc: Payload: { expectedVersion: 1, outcome: 'EDITED', content: '...', reason: '...' }
    ResSvc->>DB: BEGIN Tx (pg_advisory_xact_lock on reviewCaseId)
    ResSvc->>DB: UPDATE review_cases SET status=RESOLVED, outcome=EDITED, version=2, resolved_at=NOW()
    ResSvc->>DB: INSERT INTO review_actions (action_type=EDITED, case_version=2)
    ResSvc->>DB: INSERT INTO review_inbox_items (type=REVIEW_RESOLVED, status=UNREAD)
    ResSvc->>DB: INSERT INTO audit_logs (action=review.case_resolved)
    ResSvc->>DB: COMMIT Tx
    ResSvc-->>Queue: 200 OK resolution saved

    Note over Student,Inbox: Phase 4: Student notification and review consumption
    Inbox->>Inbox: Polls unread count via GET /api/v1/reviews/inbox/unread-count
    Inbox->>Student: Unread notification badge appears in navbar
    Student->>Inbox: Opens inbox -> clicks resolved item
    Inbox->>Chat: Deep-links to /chat with review indicator
    Student->>Inbox: POST /api/v1/reviews/inbox/:inboxItemId/read -> marks item read
```

---

## 4. Concurrency, locking, and draft persistence

To support multiple instructors reviewing cases without data loss or race conditions:

1. **Transactional advisory locks.** During mutation, [`PrismaInstructorReviewActionRepository`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/reviews/instructor-resolution/instructor-review-action.repository.ts) acquires a PostgreSQL transaction-level advisory lock on the idempotency scope key, then on the review case ID (`pg_advisory_xact_lock`). This serializes concurrent resolutions for the same case.
2. **Optimistic version locking.** Every resolution or rejection payload passes `expectedVersion: number`. If another instructor resolves the case first, the version counter increments, the conditional update matches zero rows, and the API returns `STALE_REVIEW_VERSION` (HTTP 409 Conflict).
3. **Idempotency keys.** The API requires an `Idempotency-Key` header (1 to 200 characters). Successful resolutions record a SHA-256 fingerprint in `idempotency_records` with a 7-day retention period. Retried requests with matching fingerprints return the original response without re-executing database mutations.
4. **Tab-isolated draft persistence.** The instructor workspace saves in-progress drafts to browser `sessionStorage` keyed by case ID (`morshid:review-draft:<reviewCaseId>`). This isolates draft content across browser tabs when an instructor works on multiple review cases in parallel.

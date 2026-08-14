# 13. Reviews & Human-in-the-Loop (HITL) Workflow

The Reviews subsystem provides human oversight, moderation queues, automated safety escalation, and direct instructor feedback delivery. Governed by [ADR 0003](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0003-reviews-owned-student-inbox.md), the `Reviews` module owns review case intake, instructor workflows, and the **Student Review Inbox** in a single atomic domain.

---

## 1. Reviews Mental Model & Architecture

```mermaid
graph LR
    subgraph Triggers["Review Triggers"]
        T1["Student Flag<br/>(STUDENT_REQUEST)"]
        T2["Semantic Guard Flag<br/>(SAFETY_GUARD_FLAG)"]
        T3["Low Model Confidence<br/>(LOW_CONFIDENCE_FALLBACK)"]
        T4["Repeated Struggle<br/>(UNRESOLVED_MISCONCEPTION)"]
    end

    subgraph CoreReview["Reviews Capability (server/src/modules/reviews)"]
        Intake["Review Intake Service (Atomic DB Tx)"]
        Queue["Instructor Review Queue (15-min Lease Locking)"]
        Resolution["Review Resolution Engine"]
        Inbox["Student Review Inbox (Notifications & Deep-links)"]
    end

    subgraph Actors["Human Actors"]
        Inst[Instructor]
        Student[Student]
    end

    T1 & T2 & T3 & T4 --> Intake
    Intake --> Queue
    Inst -->|Claims & Resolves| Queue
    Queue --> Resolution
    Resolution --> Inbox
    Student -->|Reads Resolution| Inbox
```

---

## 2. Review Data Model & Enums

Defined in [`server/prisma/reviews.prisma`](file:///home/mahmoud-ahmed/Projects/Morshid/server/prisma/reviews.prisma):

### 2.1 Enums:
- **`ReviewTriggerType`**:
  - `STUDENT_REQUEST`: Student explicitly requested review on a specific chat turn.
  - `POLICY_CHECK_FAILED`: Automated safety or teaching policy violation detected.
  - `CITATION_MISSING`: Turn produced assertions without supporting citations.
  - `SOURCE_CONFLICT`: Retrieved chunks contained conflicting claims.
  - `FINAL_ANSWER_RISK`: Potential solution leak detected.
  - `GENERAL_NOT_FOUND`: Retrieval produced no relevant course material chunks.
- **`ReviewCaseStatus`**:
  - `OPEN`: Waiting in the instructor moderation queue.
  - `RESOLVED`: Instructor approved, edited, or replaced the guidance.
  - `DISMISSED`: Review request was rejected with reason.
- **`ReviewOutcome`**:
  - `APPROVED`: Instructor confirmed the original Socratic response was accurate and appropriate.
  - `EDITED`: Instructor edited the response text.
  - `REPLACED`: Instructor provided a completely rewritten explanation.
  - `REQUEST_REJECTED`: Instructor rejected the student's review request.

---

## 3. End-to-End Review Lifecycle Trace

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Chat as Student Chat UI
    participant Intake as ReviewCaseController
    actor Instructor
    participant Queue as Instructor Review Workspace
    participant ResSvc as InstructorReviewResolutionController
    participant Inbox as Student Review Inbox
    participant DB as PostgreSQL (Tx)

    Note over Student,Chat: Phase 1: Review Intake
    Student->>Chat: Clicks "Request Instructor Review" (with reason)
    Chat->>Intake: POST /api/v1/messages/:messageId/review-requests (Idempotency-Key)
    Intake->>DB: BEGIN Tx -> INSERT into review_cases (status=OPEN, evidence_snapshot)
    Intake->>DB: INSERT into review_triggers (trigger_type=STUDENT_REQUEST)
    Intake->>DB: INSERT into audit_logs (review.case_created)
    Intake->>DB: COMMIT Tx
    Intake-->>Chat: 201 Created (Review Case #42)
    Chat->>Student: Displays "Under Instructor Review" badge

    Note over Instructor,Queue: Phase 2: Moderation Queue
    Instructor->>Queue: Visits /instructor/review-queue -> GET /api/v1/instructor/reviews
    Queue-->>Instructor: List of pending review cases for assigned courses
    
    Note over Instructor,ResSvc: Phase 3: Resolution Action
    Instructor->>ResSvc: POST /api/v1/instructor/reviews/42/resolve (Idempotency-Key)
    Note over ResSvc: Payload: { expectedVersion: 1, outcome: 'EDITED', content: '...', reason: '...' }
    ResSvc->>DB: BEGIN Tx (pg_advisory_xact_lock on reviewCaseId)
    ResSvc->>DB: UPDATE review_cases SET status=RESOLVED, outcome=EDITED, published_content=..., resolved_at=NOW(), version=version+1
    ResSvc->>DB: INSERT into review_actions (action_type=RESOLVED, outcome=EDITED)
    ResSvc->>DB: INSERT into review_inbox_items (is_read=false, note=reason)
    ResSvc->>DB: INSERT into audit_logs (review.case_resolved)
    ResSvc->>DB: COMMIT Tx
    ResSvc-->>Queue: 200 OK Resolution Saved

    Note over Student,Inbox: Phase 4: Student Notification & Review Consumption
    Inbox->>Inbox: Background polling detects unread item
    Inbox->>Student: Unread notification badge appears in navbar
    Student->>Inbox: Opens Inbox -> clicks resolved item
    Inbox->>Chat: Deep-links to /chat with review indicator
    Student->>Inbox: POST /api/v1/reviews/inbox/:inboxItemId/read -> Marks item read
```

---

## 4. Concurrency, Leases & Optimistic Locking

To support multiple instructors reviewing tickets concurrently without colliding:

1. **Moderation Leases**:
   - Claiming a ticket (`POST /reviews/:id/claim`) grants an exclusive 15-minute lease (`claimedById`, `leaseExpiresAt`).
   - If an instructor abandons a ticket without resolving it, the lease expires and the ticket automatically returns to the `PENDING` queue for other instructors to claim.
2. **Optimistic Version Locking**:
   - Every mutation payload requires `expectedVersion: number`.
   - If another instructor claims or resolves the ticket in the interim, the database mutation fails with `STALE_REVIEW_VERSION` (HTTP 409 Conflict), preventing overwrites.
3. **Tab-Isolated Draft Persistence**:
   - The instructor workspace persists resolution drafts in browser `sessionStorage` keyed by review case ID (`morshid:review-draft:<reviewCaseId>`), preventing cross-tab pollution when working on multiple cases simultaneously.

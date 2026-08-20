# Morshid domain glossary

Use these terms consistently in code, documentation, tasks, and review.

- **Module:** behavior with one intentional interface and a private
  implementation. The term is scale-independent.
- **Interface:** everything a caller must know, including types, invariants,
  errors, ordering, configuration, and performance constraints.
- **Implementation:** behavior hidden behind a module's interface.
- **Seam:** the location of a module's interface.
- **Adapter:** a concrete implementation at a seam.
- **Deep module:** substantial functionality behind a small interface.
- **Capability:** cohesive domain behavior that changes for one reason.
- **Workspace:** role-specific frontend composition and presentation.
- **Platform:** technical infrastructure with no dependency on product modules.

## Canonical domain language

- **Identity:** authentication, credentials, refresh sessions, users, and user
  administration.
- **Course:** catalog, membership, assignments, and access policy.
- **Material:** an uploaded course knowledge source and its ingestion lifecycle.
- **Conversation:** a Student-owned chat session and its ordered Student and
  Assistant messages.
- **Tutoring Attempt:** the one authoritative execution record for a submitted
  Student turn.
- **Tutoring Runtime:** the single external interface that processes a
  Tutoring Attempt.
- **Socratic Workflow:** the one pedagogy, retrieval, generation, and approval
  path for every supported learning turn, including code diagnosis.
- **Debugging Guidance:** language-neutral, course-grounded diagnosis that
  identifies a likely issue and relevant location, explains the concept, and
  asks for one bounded inspection or trace action. Student code is never
  executed and a complete solution is never returned.
- **Response Governance:** shared safety and grounding decisions applied once
  to a proposed response.
- **Review Case:** the human-review aggregate, including intake, evidence,
  triggers, resolution, history, and Student visibility.
- **Student Review Inbox:** the current review-owned notification experience;
  it is not a generic notification system.
- **Audit Event:** an immutable record created with its owning state transition
  when atomicity is required.
- **Policy Day:** the calendar-day window used for daily product allowances,
  calculated in the deployment's configured IANA time zone.
- **Tutoring Allowance:** the number of distinct Student turns a Student may
  admit for AI tutoring in one Course during one Policy Day. Replays and
  retries of the same Student turn do not consume another unit.
- **Review Allowance:** the number of manual Review Requests a Student may make
  for one Course during one Policy Day. Automatic review triggers do not
  consume it.
- **Review Request:** a Student-initiated request for Instructor review of one
  Assistant message.
- **AI Readiness:** Morshid's locally derived ability to admit the AI work
  required for supported product flows. It does not assert external provider
  reachability.
- **AI Capacity Pressure:** a locally observed reduction in usable AI capacity
  caused by Morshid budget guards or passively observed provider rate limits.
  It is not provider-reported quota remaining.
- **Course Policy Override:** a Course-specific policy value that replaces the
  deployment default for that Course while the override exists.
- **Allowance Reset:** an audited support intervention that clears a Student's
  current Policy Day consumption without deleting Tutoring Attempts, Review
  Cases, or Audit Events.
- **Conversation Archive:** a Student-controlled state that hides a Conversation
  from its active list without deleting its messages.
- **Reviewed Guidance Entry:** Instructor-approved or Instructor-authored
  guidance stored for one Course with version and lifecycle state. It is not an
  answer key and does not enter retrieval unless that separate capability is
  enabled.

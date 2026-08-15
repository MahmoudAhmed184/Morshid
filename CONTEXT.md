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

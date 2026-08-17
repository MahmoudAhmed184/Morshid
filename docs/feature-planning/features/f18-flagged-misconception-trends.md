# F18: Flagged misconception trends

**Difficulty:** Hard  
**Dependencies:** F17

## Outcome

Show recurring misconception and flag patterns derived only from exchanges an
Instructor is already authorized to review.

## Contract

- Start every query from authorized Review Cases, then join the accepted
  Educational Analysis for the reviewed Student message when available.
- Aggregate normalized misconception codes, Student Flag Reasons, automatic
  triggers, and guidance labels for 7-, 30-, and 90-day windows.
- Return counts and trends only. Never return Student identity, message content,
  model prose descriptions, Review Evidence, or links to unflagged messages.
- Group missing, invalid, and legacy misconception data as `Unclassified`.
  Limit high-cardinality output to a stable top set plus `Other`.
- Explain that the view represents flagged exchanges, not Course mastery or the
  full Student population.
- Use no new model call to classify or summarize the data.

## Acceptance criteria

- [ ] Every counted analysis traces to an authorized Review Case and Course.
- [ ] Counts remain stable under pagination and deterministic tie ordering.
- [ ] Membership removal immediately removes inaccessible Course aggregates.
- [ ] Sparse and unclassified data states do not make mastery claims.
- [ ] Charts have accessible text/table equivalents and locale-aware labels.
- [ ] Privacy E2E tests prove unflagged and cross-Course analyses never enter
      results.

## Out of scope

Student-level analytics, predictive risk, grades, cohort mastery, free-text LLM
summaries, and access to unflagged Conversation content.


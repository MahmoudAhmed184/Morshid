# F17: Review workload summary

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Give Instructors an actionable snapshot of Review Case workload across assigned
Courses without broadening access to Student Conversations.

## Contract

- Return pending count, in-review count, claimed-by-me count, oldest pending
  age, and counts grouped by Student Flag Reason and automatic trigger.
- Scope every aggregate through active Instructor Course membership and Review
  Cases. Do not query unflagged Conversations.
- Support all assigned Courses or one selected Course and refresh through the
  existing polling policy.
- Each metric links to the Review Queue with the equivalent filters. A zero
  state explains that no cases need attention.
- Display timestamps and age using the current locale. Charts, if used, include
  an equivalent table and do not rely on color alone.

## Acceptance criteria

- [x] Counts reconcile with the same filtered Review Queue at one database
      snapshot.
- [x] An Instructor cannot infer counts for an unassigned or archived Course.
- [x] Empty, loading, stale, error, and partial-Course states are explicit.
- [x] Metric links produce the intended queue filter and preserve navigation.
- [x] Repository E2E and Instructor acceptance tests cover multiple Courses,
      mixed statuses, membership removal, and no-case state.

## Out of scope

Performance scoring, grading, Student rankings, SLA promises, notification
delivery, and aggregates from unflagged Conversations.


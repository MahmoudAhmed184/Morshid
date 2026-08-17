# F19: Material failure alerts

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Make failed course-material processing visible and actionable across the
Instructor workspace.

## Contract

- Derive alerts from assigned-Course Materials in `FAILED` or actionable
  `WARNING` state. Do not create a generic notification record.
- Show an aggregate count in Instructor navigation, a Course-scoped alert on
  the Dashboard, and the existing detailed state on Materials.
- Add an idempotent reprocess command for eligible failed Materials. It resets
  processing ownership safely, queues one durable processing command, and
  creates an Audit Event.
- A Material leaves the failure count when reprocessing starts, reaches Ready,
  or is archived. A repeated failure returns with the latest safe reason code.
- Never expose parser stack traces, provider responses, storage paths, or
  content excerpts in alerts.
- Poll with the existing Materials policy and stop polling when all visible
  records are terminal.

## Acceptance criteria

- [ ] Counts reconcile across navigation, Dashboard, and Materials for every
      assigned Course.
- [ ] Membership removal immediately removes the Course's alerts.
- [ ] Concurrent reprocess requests queue one command and replay one result.
- [ ] Reprocess is unavailable for Ready, Processing, archived, deleted, or
      inaccessible Materials.
- [ ] Loading, stale, empty, failure, reprocessing, and repeated-failure states
      are accessible and actionable.
- [ ] E2E and Instructor acceptance tests cover status transitions and privacy.

## Out of scope

Email or browser alerts, automatic retry schedules, generic notifications, and
showing raw infrastructure errors.


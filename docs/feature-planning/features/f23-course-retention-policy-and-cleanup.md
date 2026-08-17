# F23: Course retention policy and cleanup

**Difficulty:** Very hard  
**Dependencies:** F01

## Outcome

Apply an inspectable, recoverable execution process to private data after a
Course has remained archived for its retention period.

## Contract

- Courses owns one deployment retention period from 30 through 365 days,
  defaulting to 90. Eligibility begins at `archivedAt`; active Courses never
  qualify.
- Admin policy edits require version, reason, and Audit Event. Policy changes
  alter eligibility only; they do not start cleanup automatically.
- Preview one Course at a time. Show cutoff, Conversations, messages, Review
  Cases, inbox items, Material records/chunks, and stored PDF objects affected.
- Execution requires the Course code, policy version, preview token, and an
  idempotency key. Recalculate eligibility before mutation.
- Use a durable cleanup operation with retryable steps. Remove private
  Conversation content, Review Evidence, Reviewed Guidance, Material chunks,
  and stored PDFs. Preserve the archived Course tombstone and content-free Audit
  Events required to prove what happened.
- Each capability supplies a small named cleanup interface. Courses coordinates
  them without importing private repositories or Prisma types.
- Partial filesystem failure leaves a visible failed operation that retries
  remaining object keys without restoring deleted database content.

## Acceptance criteria

- [ ] Active, recently archived, changed, or inaccessible Courses cannot run.
- [ ] Preview performs no mutation and execution reports actual final counts.
- [ ] Replaying an operation cannot delete unrelated or newly created data.
- [ ] Failure and restart resume safely from durable state.
- [ ] Audit metadata contains counts and IDs but no deleted content.
- [ ] Disposable-database and filesystem E2E tests cover every dependency,
      partial failure, retry, and cross-Course isolation.

## Out of scope

Scheduled cleanup, legal holds, per-Course retention overrides, restoration,
cloud-object storage, and deleting the Course or Audit Events themselves.


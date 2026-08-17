# F26: Contextual policy history

**Difficulty:** Moderate after dependencies  
**Dependencies:** F07, F08, F10, F22, F23, F24

## Outcome

Show the audit history relevant to the policy an Admin is viewing without
duplicating the full Audit Logs workspace.

## Contract

- Standardize Audit Event target types and safe metadata for Policy Day,
  Tutoring Allowance, Review Allowance, upload size, retention, and session
  lifetime changes.
- Each policy panel lists newest-first actor, time, scope, old value, new value,
  reason, and operation result. Course overrides identify the Course safely.
- Query Audit through its public filtered interface. Policy capabilities remain
  responsible for writing their event atomically with state changes.
- Paginate with a stable cursor and link to the full Audit Logs page with the
  same filters.
- Unknown legacy metadata renders a generic change row instead of guessing.
  Never expose IP, user agent, secrets, or unrelated Audit metadata here.

## Acceptance criteria

- [ ] Every successful policy mutation in the dependency features appears once.
- [ ] Failed or rolled-back mutations do not appear as successful changes.
- [ ] Course-scoped history never leaks an inaccessible Course.
- [ ] Pagination is stable when a new event arrives between requests.
- [ ] Loading, empty, legacy, error, and conflict states are accessible.
- [ ] E2E tests reconcile contextual rows with the full Audit Logs filters.

## Out of scope

Editing Audit Events, rollback buttons, diffing arbitrary JSON, and replacing
the Audit Logs page.


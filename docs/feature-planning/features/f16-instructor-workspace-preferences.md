# F16: Instructor workspace preferences

**Difficulty:** Easy  
**Dependencies:** None

## Outcome

Restore an Instructor's last active Course and reusable Review Queue filters on
the same device.

## Contract

- Namespace preferences by authenticated Instructor.
- Remember the last selected assigned Course. If it is no longer assigned or
  active, choose the existing deterministic fallback and remove the stale value.
- Let an Instructor save, apply, rename, and delete up to ten named queue
  filters. Names are trimmed, 1 through 40 characters, and unique
  case-insensitively for that Instructor.
- A filter may contain Course, Review Case status, Student Flag Reason,
  assignee, and age. Validate stored filters against current enum values and
  available Courses.
- Applying a saved filter updates the visible URL query so refresh and sharing
  within the same authorized account remain predictable.
- Storage failure does not block the workspace or queue.

## Acceptance criteria

- [ ] Different accounts on one browser never share preferences.
- [ ] Removed Courses and obsolete filter values recover without blank pages.
- [ ] Filter creation, rename, apply, delete, limit, and duplicate-name states
      are keyboard and screen-reader accessible.
- [ ] Applying a filter produces the same query as setting controls manually.
- [ ] Unit and workspace tests cover corrupt storage and account switching.

## Out of scope

Cross-device synchronization, shared team filters, notification preferences,
and changing server-side queue semantics.


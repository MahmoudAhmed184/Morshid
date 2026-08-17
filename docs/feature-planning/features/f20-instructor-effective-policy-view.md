# F20: Instructor effective-policy view

**Difficulty:** Easy after dependencies  
**Dependencies:** F08, F10

## Outcome

Let an Instructor understand the Student limits currently applied to each
assigned Course without granting policy mutation rights.

## Contract

- The Workspace settings tab shows the effective Tutoring Allowance, Review
  Allowance, Policy Day time zone, and next reset for a selected assigned Course.
- For each allowance, label whether the value comes from the deployment default
  or a Course Policy Override.
- Fetch values through read-only interfaces owned by Tutoring, Reviews, and
  Policy Day. Do not proxy them through a generic settings endpoint.
- Never show Student consumption, deployment-cap consumption, other Courses, or
  policy mutation controls.
- Explain that Admins own policy changes and that current Review Cases and
  Tutoring Attempts are never removed by a limit change.

## Acceptance criteria

- [ ] Values match the Admin effective-policy view for the same Course.
- [ ] Course switching updates every value and reset timestamp together.
- [ ] Removed, archived, and unassigned Courses are unavailable without leaking
      policy existence.
- [ ] Loading, stale, error, no-Course, inherited, and overridden states are
      explicit and accessible.
- [ ] E2E tests cover cross-Course and cross-role denial.

## Out of scope

Editing policy, seeing individual Student usage, resetting allowances, and
requesting exceptions.


# F02: Self-service profile

**Difficulty:** Easy  
**Dependencies:** F01

## Outcome

Let an authenticated user update their own display name while preserving
Admin ownership of identity and enrollment fields.

## Contract

- Account shows display name, email, role, and status. Only display name is
  editable.
- Trim the submitted name and require 2 through 120 characters.
- Update the authenticated session summary after the server confirms the
  mutation so the sidebar and settings page agree immediately.
- Record an Audit Event containing the actor, user ID, old display name, and
  new display name. Never record credentials or bearer tokens.
- Reject disabled accounts, invalid payloads, and attempts to submit email,
  role, status, or course changes through this interface.
- Use explicit success and error status messages. A failed save preserves the
  user's entered value for correction.

## Key interfaces

- `AccountProfile` exposes the authorized identity summary.
- `updateOwnProfile({ displayName })` is the only self-service profile command.
- Identity owns validation, persistence, and auditing. The account-settings
  feature consumes the Identity interface.

## Acceptance criteria

- [ ] All three roles can update their own valid display name.
- [ ] Leading and trailing whitespace is removed consistently.
- [ ] Invalid or extra fields cannot change server state.
- [ ] The settings page, avatar initials, and sidebar reflect the saved name.
- [ ] Concurrent updates have a defined last-write result and return the saved
      server representation.
- [ ] Unit, server E2E, and role-boundary tests cover success and denial paths.

## Out of scope

Email changes, role changes, profile photos, biographies, public profiles, and
course membership management.


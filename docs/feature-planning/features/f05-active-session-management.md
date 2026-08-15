# F05: Active session management

**Difficulty:** Moderate  
**Dependencies:** F01

## Outcome

Show users their logical browser sessions and let them revoke remote access.

## Current state

Identity rotates refresh tokens and stores creation time, expiry, IP, user
agent, revocation, and replacement links. It does not expose token families as
user-facing sessions.

## Contract

- Give each sign-in one stable session-family ID. Rotation stays inside that
  family and updates its last-active time.
- List active families with parsed browser/device label, masked IP, created,
  last active, expiry, and a current-session marker. Return no token or hash.
- Revoke one non-current family or all other families. Each command is
  idempotent and audited.
- Expired and fully revoked families disappear. Revocation invalidates the
  server session immediately even if an access token has time remaining.
- Treat malformed user agents as `Unknown device`; do not add IP geolocation.

## Acceptance criteria

- [ ] Token rotation never creates duplicate rows in the user-facing list.
- [ ] The current family is identified from the HttpOnly refresh session.
- [ ] A revoked family cannot refresh or access protected routes afterward.
- [ ] A user cannot list or revoke another user's sessions.
- [ ] Confirmation, pending, success, empty, and failure states are keyboard and
      screen-reader accessible.
- [ ] Migration and E2E tests cover existing token chains, concurrent rotation,
      individual revocation, and revoke-all-others.

## Out of scope

Location lookup, trusted-device scoring, remote push alerts, and revoking the
current session from this list. Normal sign-out owns the current session.


# F04: Self-service password change

**Difficulty:** Moderate  
**Dependencies:** F01

## Outcome

Let an authenticated user replace their password without weakening the current
session model.

## Contract

- Require the current password, new password, and confirmation.
- Require at least 15 characters, allow at least 128 characters, Unicode,
  spaces, paste, autofill, and password managers. Do not impose character-class
  composition or periodic expiry.
- Reject common, compromised, context-specific, and current passwords through
  a local server-side blocklist. Do not send candidate passwords to a third
  party.
- On success, update `passwordChangedAt`, revoke every other logical session,
  rotate the current session, and return a replacement access session without
  forcing a sign-in round trip.
- Record one password-changed Audit Event without password material. Use a
  generic failure for an incorrect current password.
- Apply the same password rules to Admin account creation and password reset so
  Identity has one policy implementation.

## Acceptance criteria

- [ ] The old password and every other session fail immediately after success.
- [ ] The current browser continues with only the newly rotated session.
- [ ] Password validation follows the fixed policy and does not trim spaces.
- [ ] The form supports paste and browser password-manager semantics.
- [ ] Concurrent change and refresh attempts cannot preserve an old session.
- [ ] Unit and E2E tests cover policy failures, current-password failure,
      rotation, revocation, audit failure, and disabled accounts.

## Out of scope

Forgot-password email flows, MFA, periodic rotation, security questions, and
Admin controls that weaken the fixed password standard.


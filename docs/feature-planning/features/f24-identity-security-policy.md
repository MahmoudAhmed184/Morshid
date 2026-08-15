# F24: Identity security policy

**Difficulty:** Hard  
**Dependencies:** F01, F04

## Outcome

Give Admins one accurate security-policy view and one bounded session-lifetime
control without allowing standards to be weakened.

## Contract

- Show fixed password requirements read-only: 15-character minimum, at least
  128 accepted characters, Unicode and spaces allowed, local blocklist,
  Argon2id storage, no composition rule, and no periodic expiry.
- Show access-token lifetime, cookie protections, and F09 abuse limits read-only
  from effective server configuration.
- Let Admins configure refresh-session lifetime from 1 through 30 days, default
  7. The hard maximum cannot be raised from the UI.
- A session-lifetime update requires expected version, reason, and Audit Event.
  It applies to newly created or rotated sessions; existing expiry instants do
  not extend retroactively.
- Clearly separate policy status, editable values, and deployment-only values.
  Never return hashes, secrets, cookies, or full configuration objects.

## Acceptance criteria

- [ ] The view reports effective values, not duplicated client constants.
- [ ] Admins cannot submit weaker password, cookie, access-token, or throttle
      values through hidden fields or direct requests.
- [ ] New and rotated sessions receive the configured lifetime; existing
      sessions keep their earlier expiry until rotation.
- [ ] Version conflicts and audit failures leave policy unchanged.
- [ ] Unit and E2E tests cover bounds, transitions, authorization, and redaction.

## Out of scope

MFA, SSO, password expiry, editable composition rules, global forced sign-out,
and secrets management.


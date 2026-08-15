# F22: Material upload-size policy

**Difficulty:** Moderate  
**Dependencies:** F01

## Outcome

Let Admins change the enforced PDF upload-size ceiling without redeploying the
server.

## Contract

- Materials owns one deployment policy in whole megabytes, from 1 through 100,
  defaulting to 10 MB.
- Seed the authoritative database value during migration. Remove the runtime
  dual path once persistence is active; environment configuration remains only
  a bootstrap/migration concern.
- Admin edits require expected version, reason, and an Audit Event containing
  old and new byte values.
- The upload interceptor reads the effective policy for each request through a
  bounded Materials-owned cache. Cache invalidation follows a confirmed update.
- Instructor and Admin upload forms query and display the current limit. Server
  validation remains authoritative and returns the effective limit in a safe
  oversized-file error.
- A lower limit never changes existing Materials or in-progress accepted
  uploads.

## Acceptance criteria

- [ ] Files at the byte limit are accepted and files one byte over are rejected.
- [ ] All upload entry points show and enforce the same value.
- [ ] Concurrent Admin edits report version conflicts rather than overwriting.
- [ ] Cache failure cannot silently accept a larger file.
- [ ] Unit, API E2E, and upload acceptance tests cover boundaries and updates.

## Out of scope

Allowed-file-type controls, Course overrides, storage quotas, multi-format
ingestion, and reverse-proxy body-size configuration.


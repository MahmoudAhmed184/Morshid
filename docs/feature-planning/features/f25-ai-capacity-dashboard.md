# F25: AI capacity dashboard

**Difficulty:** Hard  
**Dependencies:** F01

## Outcome

Give Admins a safe operational view of AI readiness and local quota pressure
without probing providers or exposing credentials.

## Contract

- Present Analysis, Tutor, Semantic Guard, and Embedding roles with configured
  provider/model, configured project count, available count, and status:
  Healthy, Cooling down, Unavailable, or Configuration error.
- Show opaque project aliases, local budget utilization when authoritative,
  earliest retry time, last safe status change, and Redis coordination health.
- Do not invent vendor quota remaining. When the provider does not expose an
  authoritative value, say so plainly.
- Build snapshots from existing quota guards, credential pools, and validated
  configuration. Reading the dashboard never sends an AI or embedding request.
- Never expose API keys, authorization headers, salted Redis keys, raw provider
  bodies, prompts, or Student content.
- Poll every 30 seconds while visible, stop when hidden, and preserve the last
  successful snapshot as visibly stale after a failure.
- Include F09's active abuse-limit values and storage health read-only.

## Acceptance criteria

- [ ] Every status maps from a documented internal state and has a safe reason.
- [ ] A dashboard read has no provider-side effect.
- [ ] Cross-role requests are denied and audited under existing RBAC policy.
- [ ] Secret-shaped fixture values never appear in API or rendered output.
- [ ] Healthy, partial cooldown, exhausted pool, Redis failure, invalid config,
      deterministic provider, stale, and recovery states are tested.

## Out of scope

Editing provider credentials, changing models, vendor billing, quota purchase,
manual cooldown clearing, and exact remaining quota when unavailable.


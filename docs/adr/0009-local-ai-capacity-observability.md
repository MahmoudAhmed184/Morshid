# ADR 0009: Keep AI capacity observability local and credential-opaque

- **Status:** Accepted
- **Date:** 2026-08-20

## Context

Admins need operational visibility into AI readiness and capacity pressure (such
as Gemini chat pool health and local embedding budget utilization) without
introducing new failure modes, consuming billable or rate-limited provider
capacity, or leaking sensitive credentials. Probing AI providers from admin
observation pages creates artificial provider load, can advance round-robin pool
cursors, can trigger or clear cooldowns, and risks exposing API keys, project
identifiers, Redis keys, or raw provider error payloads in responses.

## Decision

Derive AI readiness and capacity pressure exclusively from validated local
configuration, local quota and cooldown coordination state in Redis, and
passively observed provider failures during normal product traffic. Loading the
admin AI capacity view makes zero network calls to external AI providers.

Expose only aggregate, allowlisted, credential-opaque operational metadata:
- Aggregate Gemini chat-pool availability and cooldown counts.
- Local Gemini embedding budget utilization across configured dimensions.
- Derived operational readiness: `Ready`, `Pressured`, `Blocked`, or `Unknown`.

Never return or render:
- API keys, key fragments, or credential hashes/digests.
- Quota project identifiers or pool-member identifiers.
- Redis keys or internal state digests.
- Raw provider error payloads or request bodies.
- Fabricated "provider quota remaining" percentages.

Platform observer seams (`GeminiChatProjectPool.snapshot()` and
`GeminiQuotaService.snapshot()`) are strictly read-only and must never mutate
cursor positions, reservations, debits, or cooldown state. Responses carry
`Cache-Control: no-store`.

## Rejected alternatives

- Active synthetic health probes to AI providers on page load.
- Exposing Google Cloud project IDs or API key hashes for debugging in the UI.
- Reporting an invented "percentage of Google quota remaining" when Morshid only
  tracks local rate limits and passive cooldowns.
- Coupling student allowance limits to provider capacity.

## Consequences

Admins receive a deterministic, safe, and immediate snapshot of system readiness
that cannot consume quota, trigger rate limits, or leak secrets. In exchange,
Morshid does not assert external provider reachability when idle, which aligns
with Morshid's separation between durable student entitlements and technical
infrastructure capacity.

## References

- [docs/ai-capacity-and-allowances/feature-design.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/ai-capacity-and-allowances/feature-design.md)
- [ADR 0008: Use a project-aware Gemini chat credential pool](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0008-project-aware-gemini-chat-pool.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)

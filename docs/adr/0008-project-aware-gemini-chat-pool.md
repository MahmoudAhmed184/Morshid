# ADR 0008: use a project-aware Gemini chat credential pool

- **Status:** Accepted
- **Date:** 2026-08-13

## Context

Tutoring's analysis, generation, and semantic-guard roles may call Gemini
through the shared OpenAI-compatible transport. One credential per role leaves
an otherwise healthy deployment unavailable when that credential's Google
Cloud project receives HTTP 429. Several API keys created in the same project
do not provide independent capacity because Gemini rate limits are applied per
project, not per key. Morshid may run several API replicas, so an in-memory
cursor or cooldown would also let replicas continue selecting a project that
another replica already observed as limited.

## Decision

Treat every chat pool member as one distinct Google Cloud quota project with an
opaque deployment id and one credential. Select healthy projects round-robin
through Redis. On an authoritative HTTP 429, consume the refused response,
record a project-wide bounded exponential cooldown with jitter, and try each
remaining project at most once inside the same request deadline. Surface one
rate-limited failure when the pool is exhausted. Do not rotate on timeouts,
transport ambiguity, non-429 HTTP failures, or malformed output.

Keep the OpenAI-compatible wire implementation singular. The pool is a fetch
collaborator below the existing structured-chat transport and is selected only
for Google's pinned compatibility base URL. Other OpenAI-compatible gateways
retain their existing single authorization value. Redis contains only salted
digests of opaque project labels; credentials remain in process memory and are
used only to construct the outbound Authorization header. Invalid configuration
or unavailable/corrupt Redis state fails closed.

The pool is limited to interactive chat roles. Gemini embedding retains its
separate credential, project identity, SDK composition, data-governance policy,
and quota guard until a separately approved embedding-pool decision is made.

## Rejected alternatives

- Rotate several keys from one Google Cloud project as if they had separate
  quota.
- Keep per-process cursors and cooldowns that diverge across API replicas.
- Retry timeouts or ambiguous network failures with another credential, which
  can duplicate processed and billed work.
- Add a second Gemini-specific chat request/response implementation beside the
  shared OpenAI-compatible transport.
- Fold embedding into the chat pool and allow ingestion to starve interactive
  tutoring traffic.

## Consequences

Deployments using Gemini chat must configure between one and 256 distinct
project entries, keep the corresponding role `*_API_KEY` values blank, and
provide Redis. The maximum is a Morshid-owned defensive operational bound, not
a Gemini API constraint. Every attempted chat call performs a small atomic
Redis selection with a linear scan over member digests; only a 429 performs the
cooldown write. A 429 conservatively cools the project for all three roles
because the compatibility response does not reliably identify a narrower
enforced quota dimension. An all-429 request may try every configured project
once within its request deadline. Operators remain responsible for ensuring
labels actually refer to distinct authorized projects and for using
provider-supported tier upgrades or quota increases for sustained capacity.

## References

- `docs/architecture-refactor-plan-2026-08-11.md`, sections 6 and 7
- Google Gemini API rate limits: <https://ai.google.dev/gemini-api/docs/rate-limits>
- Google Gemini API key and project management: <https://ai.google.dev/gemini-api/docs/api-key>
- Google Cloud project quotas: <https://cloud.google.com/resource-manager/docs/creating-managing-projects#managing_project_quotas>
- Google Gemini API troubleshooting and retry guidance: <https://ai.google.dev/gemini-api/docs/troubleshooting>
- Google Gemini API billing and project/key behavior: <https://ai.google.dev/gemini-api/docs/billing>
- Google Gemini OpenAI compatibility: <https://ai.google.dev/gemini-api/docs/openai>

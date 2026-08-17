# ADR 0002: One tutoring runtime and one tutoring attempt

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The approved architecture requires one supported tutoring workflow and one
authoritative attempt state. Before the cutover, the workspace had multiple
execution paths and duplicate ownership of submitted turns, terminal status,
and responses.

## Decision

Tutoring owns one authoritative `TutoringAttempt` aggregate and exposes one
external `TutoringRuntime.run(command): Promise<TutoringTurnReceipt>` seam.
Conversations owns session and ordered message records through its
transaction-aware `ConversationTurns` interface. Every supported request,
including code diagnosis, goes through one Socratic workflow. Code diagnosis
is generic debugging guidance inside that workflow; student code is never
executed and a complete solution is never returned.

## Rejected alternatives

- Keeping GroundedChat, Socratic, and Python tutor runtimes side by side.
- A generic workflow registry or speculative language-adapter framework.
- Forwarding wrappers or a second attempt state that preserves the old paths.

## Consequences

Tutoring has a small public seam and can keep model, governance, retrieval,
and persistence details private. Conversations and Reviews participate in the
same local transaction through opaque interfaces. Existing callers and tests
must be cut over directly, and obsolete modules and schemas are deleted after
the new path is green.

## References

- [docs/developer-guide/11-tutoring-engine-and-socratic-runtime.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/11-tutoring-engine-and-socratic-runtime.md)
- [docs/developer-guide/06-api-and-communication.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/06-api-and-communication.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)

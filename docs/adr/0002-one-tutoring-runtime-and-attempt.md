# ADR 0002: one Tutoring Runtime and one Tutoring Attempt

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

The current workspace contains overlapping Student chat, grounded-chat,
Socratic, completion, and Python diagnosis paths. They duplicate execution
state and make it unclear which path owns a submitted turn, terminal status,
or response. The product has one supported tutoring workflow.

## Decision

Tutoring owns one authoritative `TutoringAttempt` aggregate and exposes one
external `TutoringRuntime.run(command): Promise<TutoringTurnReceipt>` seam.
Conversations owns session and ordered message records through its
transaction-aware `ConversationTurns` interface. Every supported request,
including code diagnosis, goes through one Socratic Workflow. Code diagnosis
is generic Debugging Guidance inside that workflow; student code is never
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

- `docs/architecture-refactor-plan-2026-08-11.md`, sections 4, 8, 9, 10, and 17
- `docs/research/whole-workspace-broad-refactor-safety-2026-08-11.md`
- `docs/morshid-decisions.md`, P0 tutoring scope

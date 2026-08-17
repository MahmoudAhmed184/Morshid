# ADR 0001: Capability-first ownership and platform separation

- **Status:** Accepted
- **Date:** 2026-08-11

## Context

Morshid's current server and client structures mix business capabilities with
technical taxonomies and composition shells. That makes ownership unclear,
encourages cross-module reach-through, and increases the cost of navigating a
change. The approved refactor is pre-deployment and can make direct breaking
cutovers.

## Decision

Organize product behavior by named capability. Server capabilities are
Identity, Courses, Materials, Conversations, Tutoring, Reviews, Audit, and
Health. Shared framework primitives live in `server/src/common`; technical
adapters, configuration, database, cache, AI, and document storage live in
`server/src/platform`. Platform and common code do not depend on product
modules. Each capability exposes a small intentional interface and keeps its
implementation private. Client domain features, role workspaces, and app
composition follow the same ownership vocabulary.

## Rejected alternatives

- Universal `services/`, `controllers/`, and `repositories/` directories,
  which scatter one capability across unrelated ownership buckets.
- One package or TypeScript project per feature, which adds build and package
  machinery without independent consumers.
- Keeping every file flat, which fails navigation once a capability is deep.

## Consequences

Cross-capability calls must use a named interface or capability module file.
Small capabilities remain flat, while a folder is justified by a cohesive
capability or independent change reason. Direct moves and deletions are part
of the migration; compatibility wrappers are not permitted.

## References

- [docs/developer-guide/03-architecture-and-boundaries.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/03-architecture-and-boundaries.md)
- [docs/developer-guide/05-backend-architecture.md](file:///home/mahmoud-ahmed/Projects/Morshid/docs/developer-guide/05-backend-architecture.md)
- [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md)
- [CONTEXT.md](file:///home/mahmoud-ahmed/Projects/Morshid/CONTEXT.md)

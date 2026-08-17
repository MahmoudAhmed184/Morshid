# Features ranked by implementation ease

This ranking estimates intrinsic implementation difficulty on the current
codebase. A low rank means fewer moving parts, not higher product priority.
“After dependencies” means the feature is easy only once its prerequisites
exist.

## Ease ranking

| Rank | ID | Feature | Effort | Main reason |
|---:|---|---|---|---|
| 1 | F16 | Instructor workspace preferences | Easy | Device-local state around existing filters and Course selection |
| 2 | F12 | Student draft autosave | Easy | Isolated browser persistence with no server contract |
| 3 | F01 | Role-aware settings shell | Easy | Route and composition change around an existing page |
| 4 | F03 | Appearance and accessibility | Easy | Extends the existing theme provider and tokens |
| 5 | F02 | Self-service profile | Easy | One existing User field, one mutation, and session refresh |
| 6 | F20 | Instructor effective-policy view | Easy after dependencies | Read-only composition of existing policy interfaces |
| 7 | F17 | Review workload summary | Moderate | Bounded aggregates over existing Review Cases |
| 8 | F19 | Material failure alerts | Moderate | Existing states, plus one safe reprocess command |
| 9 | F15 | Explanation detail preference | Moderate | Small persistence change plus prompt-contract coverage |
| 10 | F22 | Material upload-size policy | Moderate | One policy record, dynamic upload enforcement, and cache invalidation |
| 11 | F14 | Conversation Markdown export | Moderate | New authorized read model, escaping, and audit behavior |
| 12 | F27 | Audit CSV export | Moderate | Streaming and strict spreadsheet-injection defenses |
| 13 | F09 | API abuse protection | Moderate | Redis windows, proxy correctness, and HTTP error semantics |
| 14 | F26 | Contextual policy history | Moderate after dependencies | Mostly presentation once all Audit Events are standardized |
| 15 | F13 | Conversation pinning and archive | Moderate | Schema, ordering, pagination, and lifecycle interactions |
| 16 | F04 | Self-service password change | Moderate | Credential verification, fixed policy, token rotation, and audit |
| 17 | F05 | Active session management | Moderate | Refresh-token families and immediate remote revocation |
| 18 | F25 | AI capacity dashboard | Hard | Several platform snapshots with strict secret redaction |
| 19 | F18 | Flagged misconception trends | Hard | Privacy-safe joins and stable aggregate semantics |
| 20 | F07 | Policy Day configuration | Hard | Time-zone boundaries, DST, scheduling, and shared semantics |
| 21 | F24 | Identity security policy | Hard | Runtime session policy mixed with fixed security guarantees |
| 22 | F10 | Review Allowance | Hard | Migration from query-count enforcement to resettable atomic usage |
| 23 | F08 | Tutoring Allowance | Hard | Atomic Student/Course and deployment reservations in the runtime |
| 24 | F11 | Allowance Reset operations | Hard | Cross-policy support flow with races, idempotency, and audit atomicity |
| 25 | F21 | Reviewed Guidance Library | Very hard | New versioned aggregate and Material-driven revalidation lifecycle |
| 26 | F06 | Arabic localization and RTL | Very hard | Whole-application catalogs, SSR direction, and mixed bidi content |
| 27 | F23 | Course retention policy and cleanup | Very hard | Irreversible multi-capability and filesystem deletion workflow |

## Dependency-aware build order

1. F16, F12, F17: isolated QoL and reporting slices.
2. F01, then F02, F03, F04, F05, and F15: establish the settings and account
   foundations.
3. F07, F09, F22, and F24: establish operational policy interfaces.
4. F08 and F10, then F11 and F20: implement allowances before their consumers.
5. F13, F14, F19, F18, F21, F25, and F27: finish the broader domain and
   operational slices.
6. F23, then F26: run destructive-retention work only after the affected
   capabilities are stable, then complete history across every policy.
7. F06 last: translate and verify the complete release interface.

F26 is intentionally late despite its importance because “complete Arabic” can
only be verified against the final set of release screens. Every earlier feature
must still use semantic markup and logical layout so F06 does not require a
visual rewrite.

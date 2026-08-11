# Prisma net-live migration inventory

**Scope:** Milestone 2 clean-slate foundation, captured before replacing the
historical migration chain.

This is historical migration evidence, not a second schema source of truth.
The authored multi-file Prisma schema and the rolling initial migration are the
current sources after the cutover. Upgrade-only SQL is intentionally omitted
from blank-database history.

## Historical directories

The source history contained these 18 migration directories, in order:

1. `20260704152000_enable_pgvector`
2. `20260706210027_add_p0_domain_schema`
3. `20260714114707_add_chat_sequence_and_membership_removed_at`
4. `20260716224018_add_rag_persistence`
5. `20260721100000_add_material_processing_claim`
6. `20260721110000_add_material_processing_commands`
7. `20260722015955_enforce_grounded_chat_response_identity`
8. `20260727220000_add_review_creation_seam`
9. `20260801083000_add_student_flag_reason`
10. `20260801110000_enforce_student_flag_reason_trigger_shape`
11. `20260803125913_add_socratic_tutor_persistence`
12. `20260803190200_link_messages_to_tutor_turns_and_topics`
13. `20260805031000_add_educational_analysis_records`
14. `20260805090000_add_educational_analysis_fallback_metadata`
15. `20260805110000_add_teaching_decisions`
16. `20260808133701`
17. `20260810023000_add_socratic_response_audit`
18. `20260810023920`

`migration_lock.toml` is retained. The 18 directories are replaced by one
initial directory once the generated SQL is reconciled and verified.

## Extensions and types

The initial migration must create these extensions before dependent objects:

- `pgcrypto` for UUID defaults;
- `citext` for case-insensitive user email uniqueness;
- `vector` for `material_chunks.embedding vector(1536)`.

The net-live enum set is the enum set represented by the current Prisma model:
identity and membership status/role enums; material status; message role,
status, request kind, and guidance label; topic, tutor, guard, teaching,
learning, and educational-analysis enums; review, student-flag, action,
outcome, and notification enums. Enum labels and order are generated from the
authored schema and checked by catalog assertions.

## Retained relational objects

The blank initial migration retains all current tables, columns, relations,
foreign keys, and Prisma-declared indexes for:

- `users`, `refresh_tokens`;
- `courses`, `course_memberships`, `materials`,
  `material_processing_commands`, `material_chunks`;
- `chat_sessions`, `messages`, `message_retrievals`, `message_citations`;
- `topics`, `topic_states`, `tutor_turns`, `tutor_candidate_attempts`,
  `guard_results`, `educational_analyses`, `teaching_decisions`,
  `educational_analysis_evidence_links`,
  `educational_analysis_misconceptions`;
- `review_cases`, `review_triggers`, `review_evidence_snapshots`,
  `review_actions`, `idempotency_records`, `notifications`;
- `audit_logs`.

The migration must retain the exact mapped uniqueness and lookup indexes,
including response identity, session sequence, active membership lookup,
material processing lease, course-scoped material status, review queue/action
indexes, notification partial indexes, idempotency expiry, tutoring attempt
and candidate/guard identity, and retrieval/citation identity.

## Handwritten SQL reconciliation

Prisma's generated SQL does not express all of the repository's deliberate
database contracts. The initial SQL must therefore add and catalog-assert:

- `users_disabled_shape_check` (disabled users have a timestamp and actor;
  active users do not);
- nonnegative material extracted length/chunk count and processing fields;
- message sequence, hint level, token counts, and completed-at/status shape;
- retrieval rank/similarity and citation order bounds;
- review case version, resolution shape, target uniqueness, trigger shape,
  evidence JSON/hash/size, action version/reason/metadata, idempotency key/
  fingerprint/status, and notification metadata/state checks;
- tutoring topic/state/turn, candidate, guard, educational-analysis, and
  teaching-decision checks recorded in the historical SQL;
- audit action/target/metadata checks;
- the review target function `enforce_review_case_target()` and its deferred
  `review_cases_target_check` constraint trigger.

All foreign keys from the historical net-live schema are retained, including
the composite `(course_id, user_id)` membership reference used by chat
sessions. Active-membership authorization is a later application-ownership
change; it does not belong in this semantic M2 schema split.

## Deliberate omissions

- The old `idx_messages_response_to` is omitted because the final net-live
  contract is the unique `messages_response_to_message_id_key`.
- The HNSW index `idx_chunks_embedding_hnsw` is absent. The historical
  `20260808133701` drop is evidence of that deliberate final state; the initial
  migration must never create it.
- The duplicate-response PL/pgSQL preflight and the message-sequence backfill
  are upgrade-only guards/backfills. A blank database has no legacy rows and
  must not contain compatibility migration behavior.
- The final constraint name `guard_results_turn_id_candidate_fkey` is retained;
  the preceding historical name is not recreated.

## Required proof

The M2 gate must run the initial migration from empty, run `prisma db seed`
explicitly, execute the catalog assertions, and run Prisma drift detection
against the same authored schema. The assertions must prove the three
extensions, table/enum/index/check/FK/trigger contracts, vector dimension,
absence of every HNSW index, and one applied migration directory.

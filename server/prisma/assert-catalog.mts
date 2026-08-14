import assert from 'node:assert/strict'
import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'
import { Client } from 'pg'

import { assertCatalogSemanticFingerprint } from '../../scripts/catalog-semantics.mts'

loadEnv({ path: resolve(import.meta.dirname, '../.env') })
loadEnv({ path: resolve(import.meta.dirname, '../../.env') })

const databaseUrl = process.env.DATABASE_URL

// Reviewed from a clean application of the sole initial migration. This covers
// enum label order plus every public index, CHECK/FK definition and action,
// application trigger definition, and application function body queried below.
const expectedCatalogSemanticFingerprint =
  '8ef054a9f721b9b7ff761b32cea6fc5fc4e09d134a641fbe097d72f9f7d15b12'

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required for Prisma catalog assertions')
}

const expectedTables = [
  'audit_logs',
  'chat_sessions',
  'course_memberships',
  'courses',
  'educational_analyses',
  'educational_analysis_evidence_links',
  'educational_analysis_misconceptions',
  'guard_results',
  'idempotency_records',
  'material_chunks',
  'material_processing_commands',
  'materials',
  'message_citations',
  'message_retrievals',
  'messages',
  'refresh_tokens',
  'review_actions',
  'review_cases',
  'review_evidence_snapshots',
  'review_inbox_items',
  'review_triggers',
  'teaching_decisions',
  'topic_states',
  'topics',
  'tutoring_attempts',
  'tutoring_candidate_attempts',
  'users',
]

const expectedIndexes = [
  'audit_logs_pkey',
  'chat_sessions_pkey',
  'course_memberships_course_id_user_id_key',
  'course_memberships_pkey',
  'courses_code_key',
  'courses_pkey',
  'educational_analyses_pkey',
  'educational_analyses_attempt_id_attempt_key',
  'educational_analysis_evidence_links_analysis_kind_ordinal_key',
  'educational_analysis_evidence_links_pkey',
  'educational_analysis_misconceptions_pkey',
  'guard_results_pkey',
  'guard_results_attempt_stage_key',
  'idempotency_records_actor_scope_key_key',
  'idempotency_records_pkey',
  'idx_audit_actor_created',
  'idx_audit_course_created',
  'idx_citations_material',
  'idx_courses_archived_at',
  'idx_courses_created_by',
  'idx_educational_analyses_student_message',
  'idx_educational_analyses_topic_created',
  'idx_educational_analysis_evidence_links_message',
  'idx_educational_analysis_misconceptions_analysis',
  'idx_educational_analysis_misconceptions_evidence',
  'idx_idempotency_records_expires',
  'idx_material_processing_commands_lease',
  'idx_materials_course_status',
  'idx_materials_uploaded_by',
  'idx_memberships_course_role_active',
  'idx_memberships_created_by',
  'idx_memberships_user',
  'idx_messages_author',
  'idx_messages_topic',
  'idx_messages_attempt',
  'idx_review_inbox_items_recipient_created',
  'idx_refresh_tokens_replaced_by',
  'idx_refresh_tokens_user',
  'idx_retrievals_chunk',
  'idx_review_actions_case_created',
  'idx_review_cases_assignee_status_updated',
  'idx_review_cases_course_status_created',
  'idx_review_cases_requester_created',
  'idx_review_triggers_case_created',
  'idx_review_triggers_type_created',
  'idx_sessions_course',
  'idx_sessions_course_student',
  'idx_sessions_student_course',
  'idx_teaching_decisions_policy_version',
  'idx_teaching_decisions_topic_created',
  'idx_topics_course_concept',
  'idx_topics_course_problem',
  'idx_topics_session_status',
  'idx_tutoring_attempts_student_message',
  'idx_tutoring_attempts_session_status_lease',
  'idx_tutoring_attempts_topic',
  'idx_users_disabled_by',
  'material_chunks_material_id_chunk_index_key',
  'material_chunks_pkey',
  'materials_processing_attempt_id_key',
  'material_processing_commands_pkey',
  'materials_pkey',
  'message_citations_message_id_citation_order_key',
  'message_citations_pkey',
  'message_retrievals_message_id_rank_key',
  'message_retrievals_pkey',
  'messages_response_to_message_id_key',
  'messages_session_id_sequence_key',
  'messages_pkey',
  'review_inbox_items_recipient_review_case_key',
  'review_inbox_items_pkey',
  'refresh_tokens_pkey',
  'refresh_tokens_token_hash_key',
  'review_actions_case_version_key',
  'review_actions_operation_id_key',
  'review_actions_pkey',
  'review_cases_target_message_id_key',
  'review_cases_pkey',
  'review_evidence_snapshots_pkey',
  'review_triggers_manual_actor_case_key',
  'review_triggers_source_event_key_key',
  'review_triggers_pkey',
  'teaching_decisions_analysis_id_key',
  'teaching_decisions_pkey',
  'teaching_decisions_attempt_id_key',
  'topic_states_pkey',
  'topic_states_topic_id_key',
  'topics_pkey',
  'tutoring_candidate_attempts_pkey',
  'tutoring_candidate_attempts_attempt_key',
  'tutoring_attempts_pkey',
  'tutoring_attempts_session_id_client_message_id_key',
  'users_email_key',
  'users_pkey',
]

const expectedChecks = [
  'audit_logs_action_check',
  'audit_logs_target_type_check',
  'guard_results_approval_check',
  'guard_results_severity_check',
  'guard_results_violations_check',
  'idempotency_records_fingerprint_check',
  'idempotency_records_response_status_check',
  'material_chunks_chunk_index_check',
  'material_processing_commands_lease_check',
  'materials_chunk_count_check',
  'materials_extracted_text_length_check',
  'message_citations_citation_order_check',
  'message_retrievals_rank_check',
  'message_retrievals_similarity_score_check',
  'messages_hint_level_check',
  'messages_input_tokens_check',
  'messages_output_tokens_check',
  'messages_sequence_check',
  'review_inbox_items_state_shape_check',
  'review_actions_case_version_check',
  'review_actions_metadata_object_check',
  'review_actions_reason_check',
  'review_cases_resolution_reason_check',
  'review_cases_terminal_shape_check',
  'review_cases_version_check',
  'review_evidence_content_hash_check',
  'review_evidence_object_check',
  'review_evidence_schema_version_check',
  'review_evidence_size_check',
  'review_triggers_metadata_object_check',
  'review_triggers_reason_check',
  'review_triggers_shape_check',
  'review_triggers_student_flag_reason_shape_check',
  'teaching_decisions_guidance_level_check',
  'topic_states_guidance_level_check',
  'topic_states_version_check',
  'tutoring_candidate_attempts_attempt_check',
  'tutoring_candidate_attempts_content_check',
  'tutoring_candidate_attempts_time_check',
  'tutoring_candidate_attempts_tokens_check',
  'tutoring_attempts_approval_metadata_check',
  'users_disabled_status_check',
]

const expectedForeignKeys = [
  'audit_logs_actor_user_id_fkey',
  'audit_logs_course_id_fkey',
  'chat_sessions_course_id_fkey',
  'chat_sessions_course_id_student_id_fkey',
  'chat_sessions_student_id_fkey',
  'course_memberships_course_id_fkey',
  'course_memberships_created_by_fkey',
  'course_memberships_user_id_fkey',
  'courses_created_by_fkey',
  'educational_analyses_student_message_id_fkey',
  'educational_analyses_topic_id_fkey',
  'educational_analyses_attempt_id_fkey',
  'educational_analysis_evidence_links_analysis_id_fkey',
  'educational_analysis_evidence_links_message_id_fkey',
  'educational_analysis_misconceptions_analysis_id_fkey',
  'educational_analysis_misconceptions_evidence_message_id_fkey',
  'guard_results_attempt_id_candidate_attempt_fkey',
  'idempotency_records_actor_user_id_fkey',
  'material_chunks_material_id_fkey',
  'material_processing_commands_material_id_fkey',
  'materials_course_id_fkey',
  'materials_uploaded_by_fkey',
  'message_citations_material_id_fkey',
  'message_citations_message_id_fkey',
  'message_retrievals_chunk_id_fkey',
  'message_retrievals_message_id_fkey',
  'messages_author_user_id_fkey',
  'messages_response_to_message_id_fkey',
  'messages_session_id_fkey',
  'messages_topic_id_fkey',
  'messages_attempt_id_fkey',
  'review_inbox_items_course_id_fkey',
  'review_inbox_items_message_id_fkey',
  'review_inbox_items_recipient_user_id_fkey',
  'review_inbox_items_review_case_id_fkey',
  'review_inbox_items_session_id_fkey',
  'refresh_tokens_replaced_by_token_id_fkey',
  'refresh_tokens_user_id_fkey',
  'review_actions_actor_user_id_fkey',
  'review_actions_review_case_id_fkey',
  'review_cases_assigned_instructor_id_fkey',
  'review_cases_course_id_fkey',
  'review_cases_requested_by_user_id_fkey',
  'review_cases_resolved_by_user_id_fkey',
  'review_cases_target_message_id_fkey',
  'review_evidence_snapshots_review_case_id_fkey',
  'review_triggers_actor_user_id_fkey',
  'review_triggers_review_case_id_fkey',
  'teaching_decisions_analysis_id_fkey',
  'teaching_decisions_topic_id_fkey',
  'teaching_decisions_attempt_id_fkey',
  'topic_states_topic_id_fkey',
  'topics_course_id_fkey',
  'topics_session_id_fkey',
  'tutoring_candidate_attempts_attempt_id_fkey',
  'tutoring_attempts_assistant_message_id_fkey',
  'tutoring_attempts_retry_of_attempt_id_fkey',
  'tutoring_attempts_session_id_fkey',
  'tutoring_attempts_student_message_id_fkey',
  'tutoring_attempts_topic_id_fkey',
  'users_disabled_by_fkey',
]

const sorted = (values: string[]): string[] => [...values].sort()

const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  const extensions = await client.query<{ extname: string }>(`
    SELECT extname
    FROM pg_extension
    WHERE extname IN ('citext', 'pgcrypto', 'vector')
    ORDER BY extname
  `)
  assert.deepEqual(
    extensions.rows.map(({ extname }) => extname),
    ['citext', 'pgcrypto', 'vector'],
  )

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `)
  assert.deepEqual(
    tables.rows.map(({ table_name }) => table_name),
    expectedTables,
  )

  const indexes = await client.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY indexname
  `)
  assert.deepEqual(
    indexes.rows.map(({ indexname }) => indexname),
    sorted(expectedIndexes),
  )

  const checks = await client.query<{ conname: string }>(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'c'
    ORDER BY conname
  `)
  assert.deepEqual(
    checks.rows.map(({ conname }) => conname),
    sorted(expectedChecks),
  )

  const foreignKeys = await client.query<{ conname: string }>(`
    SELECT conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype = 'f'
    ORDER BY conname
  `)
  assert.deepEqual(
    foreignKeys.rows.map(({ conname }) => conname),
    sorted(expectedForeignKeys),
  )

  const vectorColumns = await client.query<{ data_type: string }>(`
    SELECT format_type(a.atttypid, a.atttypmod) AS data_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'material_chunks'
      AND a.attname = 'embedding'
      AND NOT a.attisdropped
  `)
  assert.deepEqual(vectorColumns.rows, [{ data_type: 'vector(1536)' }])

  const triggers = await client.query<{
    tgname: string
    tgenabled: string
    tgdeferrable: boolean
    tginitdeferred: boolean
  }>(`
    SELECT tgname, tgenabled, tgdeferrable, tginitdeferred
    FROM pg_trigger
    WHERE tgrelid = 'public.review_cases'::regclass
      AND NOT tgisinternal
  `)
  assert.deepEqual(triggers.rows, [
    {
      tgname: 'review_cases_target_check',
      tgenabled: 'O',
      tgdeferrable: true,
      tginitdeferred: true,
    },
  ])

  const functions = await client.query<{ proname: string }>(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'enforce_review_case_target'
  `)
  assert.deepEqual(functions.rows, [{ proname: 'enforce_review_case_target' }])

  const enumSemantics = await client.query<{
    enum_name: string
    label: string
    sort_order: string
  }>(`
    SELECT
      t.typname AS enum_name,
      e.enumlabel AS label,
      e.enumsortorder::text AS sort_order
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `)
  const indexSemantics = await client.query<{
    name: string
    definition: string
  }>(`
    SELECT indexname AS name, indexdef AS definition
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY indexname
  `)
  const constraintSemantics = await client.query<{
    name: string
    type: string
    definition: string
    foreign_key_update_action: string
    foreign_key_delete_action: string
  }>(`
    SELECT
      conname AS name,
      contype AS type,
      pg_get_constraintdef(oid, false) AS definition,
      confupdtype::text AS foreign_key_update_action,
      confdeltype::text AS foreign_key_delete_action
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND contype IN ('c', 'f')
    ORDER BY conname
  `)
  const triggerSemantics = await client.query<{
    table_name: string
    name: string
    enabled: string
    deferrable: boolean
    initially_deferred: boolean
    definition: string
  }>(`
    SELECT
      c.relname AS table_name,
      t.tgname AS name,
      t.tgenabled AS enabled,
      t.tgdeferrable AS deferrable,
      t.tginitdeferred AS initially_deferred,
      pg_get_triggerdef(t.oid, true) AS definition
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `)
  const functionSemantics = await client.query<{
    name: string
    definition: string
  }>(`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'enforce_review_case_target'
    ORDER BY p.proname
  `)

  assertCatalogSemanticFingerprint(expectedCatalogSemanticFingerprint, {
    enums: enumSemantics.rows,
    indexes: indexSemantics.rows,
    constraints: constraintSemantics.rows,
    triggers: triggerSemantics.rows,
    functions: functionSemantics.rows,
  })

  const hnswIndexes = await client.query<{ indexname: string }>(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND (indexname ILIKE '%hnsw%' OR indexdef ILIKE '%USING hnsw%')
  `)
  assert.deepEqual(hnswIndexes.rows, [])

  console.log('Prisma catalog assertions passed')
} finally {
  await client.end()
}

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
  'b0a41e46b6a1eee7319d93e7c2df5eafbfc643c7ad16c3930ffdef374dbb32c5'

if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is required for Prisma catalog assertions')
}

const expectedTables = [
  'allowance_resets',
  'audit_logs',
  'chat_sessions',
  'course_memberships',
  'course_policy_overrides',
  'courses',
  'debugging_diagnoses',
  'deployment_policy_defaults',
  'educational_analyses',
  'educational_analysis_evidence_links',
  'educational_analysis_misconceptions',
  'global_pricing_configs',
  'guard_results',
  'idempotency_records',
  'material_chunks',
  'material_processing_commands',
  'materials',
  'message_citations',
  'message_retrievals',
  'messages',
  'output_risk_events',
  'refresh_tokens',
  'review_actions',
  'review_cases',
  'review_evidence_snapshots',
  'review_inbox_items',
  'review_triggers',
  'student_tutoring_preferences',
  'subscription_invoices',
  'teaching_decisions',
  'topic_states',
  'topics',
  'tutoring_attempts',
  'tutoring_candidate_attempts',
  'universities',
  'university_monthly_usages',
  'university_subscriptions',
  'user_import_rows',
  'user_imports',
  'users',
]

const expectedIndexes = [
  'allowance_resets_pkey',
  'audit_logs_pkey',
  'chat_sessions_pkey',
  'course_memberships_course_id_user_id_key',
  'course_memberships_pkey',
  'course_policy_overrides_course_id_key',
  'course_policy_overrides_pkey',
  'courses_pkey',
  'courses_university_id_code_active_key',
  'debugging_diagnoses_attempt_id_key',
  'debugging_diagnoses_pkey',
  'deployment_policy_defaults_pkey',
  'educational_analyses_attempt_id_attempt_key',
  'educational_analyses_pkey',
  'educational_analysis_evidence_links_analysis_kind_ordinal_key',
  'educational_analysis_evidence_links_pkey',
  'educational_analysis_misconceptions_pkey',
  'global_pricing_configs_pkey',
  'guard_results_attempt_stage_key',
  'guard_results_pkey',
  'idempotency_records_actor_scope_key_key',
  'idempotency_records_pkey',
  'idx_allowance_resets_student_course_created',
  'idx_audit_actor_created',
  'idx_audit_course_created',
  'idx_audit_university_created',
  'idx_citations_material',
  'idx_courses_archived_at',
  'idx_courses_created_by',
  'idx_courses_university',
  'idx_debugging_diagnoses_location_message',
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
  'idx_messages_attempt',
  'idx_messages_author',
  'idx_messages_topic',
  'idx_output_risk_events_attempt',
  'idx_refresh_tokens_family',
  'idx_refresh_tokens_replaced_by',
  'idx_refresh_tokens_user',
  'idx_refresh_tokens_user_family',
  'idx_retrievals_chunk',
  'idx_review_actions_case_created',
  'idx_review_cases_assignee_status_updated',
  'idx_review_cases_course_status_created',
  'idx_review_cases_requester_created',
  'idx_review_inbox_items_recipient_created',
  'idx_review_triggers_case_created',
  'idx_review_triggers_type_created',
  'idx_sessions_course',
  'idx_sessions_course_student',
  'idx_sessions_student_course',
  'idx_subscription_invoices_status_grace',
  'idx_teaching_decisions_policy_version',
  'idx_teaching_decisions_topic_created',
  'idx_topics_course_concept',
  'idx_topics_course_problem',
  'idx_topics_session_status',
  'idx_tutoring_attempts_session_status_lease',
  'idx_tutoring_attempts_student_message',
  'idx_tutoring_attempts_topic',
  'idx_universities_status',
  'idx_university_monthly_usage_uni',
  'idx_university_subscriptions_status',
  'idx_user_import_rows_import_status',
  'idx_user_imports_creator_created',
  'idx_users_disabled_by',
  'idx_users_university_role',
  'material_chunks_material_id_chunk_index_key',
  'material_chunks_pkey',
  'material_processing_commands_pkey',
  'materials_course_id_sha256_hash_active_key',
  'materials_pkey',
  'materials_processing_attempt_id_key',
  'message_citations_message_id_citation_order_key',
  'message_citations_pkey',
  'message_retrievals_message_id_rank_key',
  'message_retrievals_pkey',
  'messages_pkey',
  'messages_response_to_message_id_key',
  'messages_session_id_sequence_key',
  'output_risk_events_pkey',
  'refresh_tokens_pkey',
  'refresh_tokens_token_hash_key',
  'review_actions_case_version_key',
  'review_actions_operation_id_key',
  'review_actions_pkey',
  'review_cases_pkey',
  'review_cases_target_message_id_key',
  'review_evidence_snapshots_pkey',
  'review_inbox_items_pkey',
  'review_inbox_items_recipient_review_case_key',
  'review_triggers_manual_actor_case_key',
  'review_triggers_pkey',
  'review_triggers_source_event_key_key',
  'student_tutoring_preferences_pkey',
  'subscription_invoices_pkey',
  'subscription_invoices_uni_period_key',
  'teaching_decisions_analysis_id_key',
  'teaching_decisions_attempt_id_key',
  'teaching_decisions_pkey',
  'topic_states_pkey',
  'topic_states_topic_id_key',
  'topics_pkey',
  'tutoring_attempts_pkey',
  'tutoring_attempts_session_id_client_message_id_key',
  'tutoring_candidate_attempts_attempt_key',
  'tutoring_candidate_attempts_pkey',
  'universities_code_key',
  'universities_owner_id_key',
  'universities_pkey',
  'university_monthly_usage_uni_period_key',
  'university_monthly_usages_pkey',
  'university_subscriptions_pkey',
  'university_subscriptions_university_id_key',
  'user_import_rows_import_row_key',
  'user_import_rows_pkey',
  'user_imports_pkey',
  'users_email_key',
  'users_pkey',
]

const expectedChecks = [
  'allowance_resets_reason_check',
  'audit_logs_action_check',
  'audit_logs_target_type_check',
  'course_policy_overrides_limit_present_check',
  'course_policy_overrides_review_limit_check',
  'course_policy_overrides_tutoring_limit_check',
  'deployment_policy_defaults_review_limit_check',
  'deployment_policy_defaults_tutoring_limit_check',
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
  'review_inbox_items_state_shape_check',
  'review_triggers_metadata_object_check',
  'review_triggers_reason_check',
  'review_triggers_shape_check',
  'review_triggers_student_flag_reason_shape_check',
  'teaching_decisions_guidance_level_check',
  'topic_states_guidance_level_check',
  'topic_states_version_check',
  'tutoring_attempts_approval_metadata_check',
  'tutoring_candidate_attempts_attempt_check',
  'tutoring_candidate_attempts_content_check',
  'tutoring_candidate_attempts_time_check',
  'tutoring_candidate_attempts_tokens_check',
  'users_disabled_status_check',
  'users_role_university_scope_check',
]

const expectedForeignKeys = [
  'allowance_resets_course_id_fkey',
  'allowance_resets_created_by_id_fkey',
  'allowance_resets_student_id_fkey',
  'audit_logs_actor_user_id_fkey',
  'audit_logs_course_id_fkey',
  'audit_logs_university_id_fkey',
  'chat_sessions_course_id_fkey',
  'chat_sessions_course_id_student_id_fkey',
  'chat_sessions_student_id_fkey',
  'course_memberships_course_id_fkey',
  'course_memberships_created_by_fkey',
  'course_memberships_user_id_fkey',
  'course_policy_overrides_course_id_fkey',
  'courses_created_by_fkey',
  'courses_university_id_fkey',
  'debugging_diagnoses_tutoring_attempt_id_fkey',
  'educational_analyses_attempt_id_fkey',
  'educational_analyses_student_message_id_fkey',
  'educational_analyses_topic_id_fkey',
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
  'messages_attempt_id_fkey',
  'messages_author_user_id_fkey',
  'messages_response_to_message_id_fkey',
  'messages_session_id_fkey',
  'messages_topic_id_fkey',
  'output_risk_events_attempt_id_fkey',
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
  'review_inbox_items_course_id_fkey',
  'review_inbox_items_message_id_fkey',
  'review_inbox_items_recipient_user_id_fkey',
  'review_inbox_items_review_case_id_fkey',
  'review_inbox_items_session_id_fkey',
  'review_triggers_actor_user_id_fkey',
  'review_triggers_review_case_id_fkey',
  'student_tutoring_preferences_student_id_fkey',
  'subscription_invoices_subscription_id_fkey',
  'subscription_invoices_university_id_fkey',
  'teaching_decisions_analysis_id_fkey',
  'teaching_decisions_attempt_id_fkey',
  'teaching_decisions_topic_id_fkey',
  'topic_states_topic_id_fkey',
  'topics_course_id_fkey',
  'topics_session_id_fkey',
  'tutoring_attempts_assistant_message_id_fkey',
  'tutoring_attempts_retry_of_attempt_id_fkey',
  'tutoring_attempts_session_id_fkey',
  'tutoring_attempts_student_message_id_fkey',
  'tutoring_attempts_topic_id_fkey',
  'tutoring_candidate_attempts_attempt_id_fkey',
  'universities_owner_id_fkey',
  'university_monthly_usages_university_id_fkey',
  'university_subscriptions_university_id_fkey',
  'user_import_rows_import_id_fkey',
  'user_imports_created_by_id_fkey',
  'users_disabled_by_fkey',
  'users_university_id_fkey',
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

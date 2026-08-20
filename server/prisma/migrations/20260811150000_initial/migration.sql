-- Final audited initial migration regenerated from the final multi-file Prisma schema.
-- Handwritten extension requirements precede the generated schema objects.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('STUDENT', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "message_status" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "message_request_kind" AS ENUM ('CONCEPTUAL', 'PROBLEM_LIKE', 'ATTEMPT_DIAGNOSIS', 'CODE_DIAGNOSIS', 'UNSAFE', 'OFF_TOPIC', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "message_guidance_label" AS ENUM ('COURSE_GROUNDED', 'GENERAL_NOT_FOUND', 'UNCERTAIN_AWAITING_REVIEW', 'INSTRUCTOR_REVIEWED', 'REFUSAL');

-- CreateEnum
CREATE TYPE "course_membership_role" AS ENUM ('INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "material_status" AS ENUM ('PROCESSING', 'READY', 'WARNING', 'FAILED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "university_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "user_import_status" AS ENUM ('PENDING', 'APPROVED');

-- CreateEnum
CREATE TYPE "user_import_row_status" AS ENUM ('VALID', 'INVALID', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "review_trigger_type" AS ENUM ('STUDENT_REQUEST', 'GENERAL_NOT_FOUND', 'CITATION_MISSING', 'SOURCE_CONFLICT', 'POLICY_CHECK_FAILED', 'FINAL_ANSWER_RISK');

-- CreateEnum
CREATE TYPE "student_flag_reason" AS ENUM ('INCORRECT', 'CONFUSING', 'UNHELPFUL', 'COURSE_MISMATCH', 'TOO_MUCH_ANSWER', 'OTHER');

-- CreateEnum
CREATE TYPE "review_action_type" AS ENUM ('CREATED', 'TRIGGER_ADDED', 'CLAIMED', 'DRAFT_SAVED', 'APPROVED', 'EDITED', 'REPLACED', 'REJECTED');

-- CreateEnum
CREATE TYPE "review_outcome" AS ENUM ('APPROVED', 'EDITED', 'REPLACED', 'REQUEST_REJECTED');

-- CreateEnum
CREATE TYPE "review_inbox_item_type" AS ENUM ('REVIEW_RESOLVED', 'REVIEW_REJECTED');

-- CreateEnum
CREATE TYPE "review_inbox_item_status" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "topic_status" AS ENUM ('ACTIVE', 'PAUSED', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "explanation_detail_level" AS ENUM ('CONCISE', 'STANDARD', 'DETAILED');

-- CreateEnum
CREATE TYPE "tutoring_attempt_status" AS ENUM ('RECEIVED', 'ANALYZING', 'RETRIEVING', 'DECIDING', 'GENERATING', 'VALIDATING', 'REGENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "tutoring_attempt_failure_code" AS ENUM ('ANALYSIS_FAILED', 'RETRIEVAL_FAILED', 'GENERATION_FAILED', 'STRUCTURAL_VALIDATION_FAILED', 'DETERMINISTIC_GUARD_REJECTED', 'SEMANTIC_GUARD_REJECTED', 'REGENERATION_EXHAUSTED', 'PERSISTENCE_FAILED');

-- CreateEnum
CREATE TYPE "tutoring_candidate_generation_outcome" AS ENUM ('GENERATED', 'INVALID_OUTPUT', 'INFRASTRUCTURE_EXHAUSTED');

-- CreateEnum
CREATE TYPE "guard_validation_stage" AS ENUM ('STRUCTURAL', 'DETERMINISTIC', 'SEMANTIC');

-- CreateEnum
CREATE TYPE "guard_recommended_action" AS ENUM ('APPROVE', 'REGENERATE', 'USE_SAFE_FALLBACK');

-- CreateEnum
CREATE TYPE "tutoring_approval_source" AS ENUM ('VALIDATED_CANDIDATE', 'SAFE_FALLBACK', 'CLASSIFIED_RESPONSE');

-- CreateEnum
CREATE TYPE "tutoring_safe_fallback_reason" AS ENUM ('VALIDATION_EXHAUSTED', 'GUARD_UNAVAILABLE', 'GENERATION_RETRY_FAILED');

-- CreateEnum
CREATE TYPE "student_state" AS ENUM ('UNKNOWN', 'NO_PRIOR_KNOWLEDGE', 'PARTIAL_UNDERSTANDING', 'MISCONCEPTION', 'DEBUGGING_ISSUE', 'NEAR_SOLUTION');

-- CreateEnum
CREATE TYPE "teaching_strategy" AS ENUM ('GUIDED_EXPLANATION', 'SOCRATIC_QUESTIONING', 'MISCONCEPTION_REPAIR', 'DEBUGGING_GUIDANCE');

-- CreateEnum
CREATE TYPE "teaching_technique" AS ENUM ('ORIENTATION_QUESTION', 'FOCUSED_QUESTION', 'DECOMPOSITION', 'ANALOGY', 'COMPARISON', 'COUNTEREXAMPLE', 'TRACE_EXECUTION', 'BOUNDARY_CHECK', 'SELF_EXPLANATION', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "reveal_policy" AS ENUM ('NO_FINAL_ANSWER', 'PARTIAL_RESULT_ALLOWED', 'FINAL_REASONING_ALLOWED', 'COMPLETE_SOLUTION_ALLOWED');

-- CreateEnum
CREATE TYPE "reflection_mode" AS ENUM ('NONE', 'SELF_EXPLANATION', 'VERIFICATION', 'TRANSFER');

-- CreateEnum
CREATE TYPE "misconception_status" AS ENUM ('SUSPECTED', 'ACTIVE', 'CORRECTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "topic_type" AS ENUM ('PROBLEM', 'CONCEPT', 'DEBUGGING_TASK', 'ASSIGNMENT_ITEM', 'MISCONCEPTION_REPAIR', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "learning_status" AS ENUM ('UNKNOWN', 'IN_PROGRESS', 'DEMONSTRATED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "resolution_evidence_strength" AS ENUM ('NONE', 'WEAK', 'MODERATE', 'STRONG');

-- CreateEnum
CREATE TYPE "educational_analysis_evidence_kind" AS ENUM ('TOP_LEVEL', 'EFFORT', 'LEARNING');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" UUID,
    "course_id" UUID,
    "ip" INET,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "last_message_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "attempt_id" UUID,
    "topic_id" UUID,
    "sequence" INTEGER NOT NULL,
    "role" "message_role" NOT NULL,
    "author_user_id" UUID,
    "response_to_message_id" UUID,
    "content" TEXT NOT NULL,
    "status" "message_status" NOT NULL,
    "request_kind" "message_request_kind",
    "guidance_label" "message_guidance_label",
    "hint_level" SMALLINT,
    "provider" VARCHAR(80),
    "model" VARCHAR(120),
    "prompt_version" VARCHAR(80),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_retrievals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "chunk_id" UUID,
    "rank" INTEGER NOT NULL,
    "similarity_score" DECIMAL(8,6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_retrievals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_citations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "citation_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "status" "university_status" NOT NULL DEFAULT 'ACTIVE',
    "owner_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "university_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "created_by" UUID,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "course_membership_role" NOT NULL,
    "created_by" UUID,
    "removed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "sha256_hash" CHAR(64),
    "status" "material_status" NOT NULL DEFAULT 'PROCESSING',
    "processing_attempt_id" UUID,
    "extracted_text_length" INTEGER,
    "chunk_count" INTEGER,
    "error_message" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_processing_commands" (
    "material_id" UUID NOT NULL,
    "processing_attempt_id" UUID,
    "lease_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_processing_commands_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "material_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "embedding_model" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "display_name" VARCHAR(120) NOT NULL,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "university_id" UUID,
    "password_hash" TEXT NOT NULL,
    "disabled_at" TIMESTAMPTZ(6),
    "disabled_by" UUID,
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "family_created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" UUID,
    "ip" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_message_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "assigned_instructor_id" UUID,
    "resolved_by_user_id" UUID,
    "status" "review_status" NOT NULL DEFAULT 'PENDING',
    "outcome" "review_outcome",
    "draft_content" TEXT,
    "published_content" TEXT,
    "resolution_reason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "assigned_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_triggers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_case_id" UUID NOT NULL,
    "type" "review_trigger_type" NOT NULL,
    "actor_user_id" UUID,
    "student_flag_reason" "student_flag_reason",
    "reason" VARCHAR(200),
    "source_event_key" VARCHAR(200),
    "detector_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_evidence_snapshots" (
    "review_case_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "evidence" JSONB NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_evidence_snapshots_pkey" PRIMARY KEY ("review_case_id")
);

-- CreateTable
CREATE TABLE "review_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_case_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action_type" "review_action_type" NOT NULL,
    "from_status" "review_status",
    "to_status" "review_status" NOT NULL,
    "content" TEXT,
    "reason" VARCHAR(1000),
    "case_version" INTEGER NOT NULL,
    "operation_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID NOT NULL,
    "operation_scope" VARCHAR(80) NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "request_fingerprint" CHAR(64) NOT NULL,
    "resource_id" UUID NOT NULL,
    "response_status" SMALLINT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_inbox_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "recipient_user_id" UUID NOT NULL,
    "review_case_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "type" "review_inbox_item_type" NOT NULL,
    "status" "review_inbox_item_status" NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "problem_id" UUID,
    "concept_id" UUID,
    "title" VARCHAR(160) NOT NULL,
    "topic_type" "topic_type" NOT NULL DEFAULT 'UNCLASSIFIED',
    "status" "topic_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "request_kind" "message_request_kind",
    "student_state" "student_state" NOT NULL DEFAULT 'UNKNOWN',
    "active_strategy" "teaching_strategy",
    "primary_technique" "teaching_technique",
    "supporting_technique" "teaching_technique",
    "guidance_level" SMALLINT NOT NULL DEFAULT 1,
    "reveal_policy" "reveal_policy" NOT NULL DEFAULT 'NO_FINAL_ANSWER',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "meaningful_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "misconception_status" "misconception_status",
    "learning_status" "learning_status" NOT NULL DEFAULT 'UNKNOWN',
    "resolution_evidence_strength" "resolution_evidence_strength" NOT NULL DEFAULT 'NONE',
    "summary" TEXT,
    "last_tutor_question" TEXT,
    "last_student_action" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoring_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "topic_id" UUID,
    "student_message_id" UUID,
    "assistant_message_id" UUID,
    "retry_of_attempt_id" UUID,
    "client_message_id" VARCHAR(160) NOT NULL,
    "request_kind" "message_request_kind",
    "status" "tutoring_attempt_status" NOT NULL DEFAULT 'RECEIVED',
    "explanation_detail_level" "explanation_detail_level" NOT NULL DEFAULT 'STANDARD',
    "failure_code" "tutoring_attempt_failure_code",
    "lease_expires_at" TIMESTAMPTZ(6),
    "safe_fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "approval_source" "tutoring_approval_source",
    "approved_candidate_attempt" SMALLINT,
    "safe_fallback_reason" "tutoring_safe_fallback_reason",
    "validation_policy_version" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tutoring_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutoring_candidate_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "candidate_attempt" SMALLINT NOT NULL,
    "generation_outcome" "tutoring_candidate_generation_outcome" NOT NULL,
    "generation_failure_code" VARCHAR(80),
    "content_hash" VARCHAR(64),
    "provider" VARCHAR(80),
    "model" VARCHAR(200),
    "prompt_version" VARCHAR(80),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "infrastructure_retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutoring_candidate_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guard_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "candidate_attempt" SMALLINT NOT NULL,
    "validation_stage" "guard_validation_stage" NOT NULL,
    "approved" BOOLEAN NOT NULL,
    "violations" JSONB NOT NULL,
    "maximum_severity" VARCHAR(16),
    "recommended_action" "guard_recommended_action" NOT NULL,
    "provider" VARCHAR(80),
    "model" VARCHAR(200),
    "prompt_version" VARCHAR(80),
    "validation_policy_version" VARCHAR(80) NOT NULL,
    "teaching_policy_version" VARCHAR(80) NOT NULL,
    "disclosure_policy_version" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guard_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educational_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "student_message_id" UUID NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "request_kind" "message_request_kind" NOT NULL,
    "student_state" "student_state" NOT NULL,
    "effort_present" BOOLEAN NOT NULL,
    "effort_quality" VARCHAR(20) NOT NULL,
    "effort_type" VARCHAR(40),
    "effort_addresses_previous_tutor_action" BOOLEAN NOT NULL,
    "effort_is_repeated" BOOLEAN NOT NULL,
    "learning_evidence_present" BOOLEAN NOT NULL,
    "learning_evidence_strength" VARCHAR(20) NOT NULL,
    "topic_relation" VARCHAR(40) NOT NULL,
    "recommended_strategy" "teaching_strategy" NOT NULL,
    "recommended_technique" "teaching_technique" NOT NULL,
    "recommended_guidance_level" SMALLINT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(200) NOT NULL,
    "model_version" VARCHAR(200),
    "prompt_version" VARCHAR(80) NOT NULL,
    "schema_version" VARCHAR(80) NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "analysis_source" VARCHAR(40) NOT NULL DEFAULT 'model',
    "fallback_reason" VARCHAR(80),
    "failure_category" VARCHAR(120),
    "confidence_policy_version" VARCHAR(120),
    "infrastructure_retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educational_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "analysis_id" UUID NOT NULL,
    "strategy" "teaching_strategy" NOT NULL,
    "primary_technique" "teaching_technique" NOT NULL,
    "supporting_technique" "teaching_technique",
    "guidance_level" SMALLINT NOT NULL,
    "reveal_policy" "reveal_policy" NOT NULL,
    "reflection_mode" "reflection_mode" NOT NULL,
    "require_student_action" BOOLEAN NOT NULL,
    "guard_policy" JSONB NOT NULL,
    "decision_reason" VARCHAR(240) NOT NULL,
    "policy_version" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educational_analysis_evidence_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "analysis_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "kind" "educational_analysis_evidence_kind" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educational_analysis_evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educational_analysis_misconceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "analysis_id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence_message_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educational_analysis_misconceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_tutoring_preferences" (
    "student_id" UUID NOT NULL,
    "explanation_detail_level" "explanation_detail_level" NOT NULL DEFAULT 'STANDARD',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_tutoring_preferences_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "user_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" "user_import_status" NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_import_rows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "display_name" VARCHAR(120),
    "email" CITEXT,
    "role" "user_role",
    "password_hash" TEXT,
    "status" "user_import_row_status" NOT NULL,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "created_user_id" UUID,

    CONSTRAINT "user_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_course_created" ON "audit_logs"("course_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_actor_created" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sessions_course" ON "chat_sessions"("course_id");

-- CreateIndex
CREATE INDEX "idx_sessions_course_student" ON "chat_sessions"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "idx_sessions_student_course" ON "chat_sessions"("student_id", "course_id", "deleted_at", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_response_to_message_id_key" ON "messages"("response_to_message_id");

-- CreateIndex
CREATE INDEX "idx_messages_attempt" ON "messages"("attempt_id");

-- CreateIndex
CREATE INDEX "idx_messages_topic" ON "messages"("topic_id");

-- CreateIndex
CREATE INDEX "idx_messages_author" ON "messages"("author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_session_id_sequence_key" ON "messages"("session_id", "sequence");

-- CreateIndex
CREATE INDEX "idx_retrievals_chunk" ON "message_retrievals"("chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_retrievals_message_id_rank_key" ON "message_retrievals"("message_id", "rank");

-- CreateIndex
CREATE INDEX "idx_citations_material" ON "message_citations"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_citations_message_id_citation_order_key" ON "message_citations"("message_id", "citation_order");

-- CreateIndex
CREATE UNIQUE INDEX "universities_code_key" ON "universities"("code");

-- CreateIndex
CREATE UNIQUE INDEX "universities_owner_id_key" ON "universities"("owner_id");

-- CreateIndex
CREATE INDEX "idx_universities_status" ON "universities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "idx_courses_university" ON "courses"("university_id");

-- CreateIndex
CREATE INDEX "idx_courses_created_by" ON "courses"("created_by");

-- CreateIndex
CREATE INDEX "idx_courses_archived_at" ON "courses"("archived_at");

-- CreateIndex
CREATE INDEX "idx_memberships_course_role_active" ON "course_memberships"("course_id", "role", "removed_at");

-- CreateIndex
CREATE INDEX "idx_memberships_user" ON "course_memberships"("user_id");

-- CreateIndex
CREATE INDEX "idx_memberships_created_by" ON "course_memberships"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "course_memberships_course_id_user_id_key" ON "course_memberships"("course_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_materials_course_status" ON "materials"("course_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_materials_uploaded_by" ON "materials"("uploaded_by");

-- CreateIndex
CREATE INDEX "idx_material_processing_commands_lease" ON "material_processing_commands"("lease_expires_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_chunks_material_id_chunk_index_key" ON "material_chunks"("material_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_disabled_by" ON "users"("disabled_by");

-- CreateIndex
CREATE INDEX "idx_users_university_role" ON "users"("university_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_family" ON "refresh_tokens"("user_id", "family_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_replaced_by" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_cases_target_message_id_key" ON "review_cases"("target_message_id");

-- CreateIndex
CREATE INDEX "idx_review_cases_course_status_created" ON "review_cases"("course_id", "status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "idx_review_cases_assignee_status_updated" ON "review_cases"("assigned_instructor_id", "status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_review_cases_requester_created" ON "review_cases"("requested_by_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_review_triggers_case_created" ON "review_triggers"("review_case_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_review_triggers_type_created" ON "review_triggers"("type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "review_actions_operation_id_key" ON "review_actions"("operation_id");

-- CreateIndex
CREATE INDEX "idx_review_actions_case_created" ON "review_actions"("review_case_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "review_actions_case_version_key" ON "review_actions"("review_case_id", "case_version");

-- CreateIndex
CREATE INDEX "idx_idempotency_records_expires" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_scope_key_key" ON "idempotency_records"("actor_user_id", "operation_scope", "key");

-- CreateIndex
CREATE INDEX "idx_review_inbox_items_recipient_created" ON "review_inbox_items"("recipient_user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "review_inbox_items_recipient_review_case_key" ON "review_inbox_items"("recipient_user_id", "review_case_id");

-- CreateIndex
CREATE INDEX "idx_topics_session_status" ON "topics"("session_id", "status");

-- CreateIndex
CREATE INDEX "idx_topics_course_problem" ON "topics"("course_id", "problem_id");

-- CreateIndex
CREATE INDEX "idx_topics_course_concept" ON "topics"("course_id", "concept_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_states_topic_id_key" ON "topic_states"("topic_id");

-- CreateIndex
-- CreateIndex
CREATE INDEX "idx_tutoring_attempts_topic" ON "tutoring_attempts"("topic_id");

-- CreateIndex
CREATE INDEX "idx_tutoring_attempts_student_message" ON "tutoring_attempts"("student_message_id");

-- CreateIndex
CREATE INDEX "idx_tutoring_attempts_session_status_lease" ON "tutoring_attempts"("session_id", "status", "lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tutoring_attempts_session_id_client_message_id_key" ON "tutoring_attempts"("session_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutoring_candidate_attempts_attempt_key" ON "tutoring_candidate_attempts"("attempt_id", "candidate_attempt");

-- CreateIndex
CREATE UNIQUE INDEX "guard_results_attempt_stage_key" ON "guard_results"("attempt_id", "candidate_attempt", "validation_stage");

-- CreateIndex
CREATE INDEX "idx_educational_analyses_topic_created" ON "educational_analyses"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_educational_analyses_student_message" ON "educational_analyses"("student_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "educational_analyses_attempt_id_attempt_key" ON "educational_analyses"("attempt_id", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_decisions_attempt_id_key" ON "teaching_decisions"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_decisions_analysis_id_key" ON "teaching_decisions"("analysis_id");

-- CreateIndex
CREATE INDEX "idx_teaching_decisions_topic_created" ON "teaching_decisions"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_teaching_decisions_policy_version" ON "teaching_decisions"("policy_version");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_evidence_links_message" ON "educational_analysis_evidence_links"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "educational_analysis_evidence_links_analysis_kind_ordinal_key" ON "educational_analysis_evidence_links"("analysis_id", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_misconceptions_analysis" ON "educational_analysis_misconceptions"("analysis_id");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_misconceptions_evidence" ON "educational_analysis_misconceptions"("evidence_message_id");

-- CreateIndex
CREATE INDEX "idx_user_imports_creator_created" ON "user_imports"("created_by_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_import_rows_import_row_key" ON "user_import_rows"("import_id", "row_number");

-- CreateIndex
CREATE INDEX "idx_user_import_rows_import_status" ON "user_import_rows"("import_id", "status");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_course_id_student_id_fkey" FOREIGN KEY ("course_id", "student_id") REFERENCES "course_memberships"("course_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "tutoring_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_response_to_message_id_fkey" FOREIGN KEY ("response_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_retrievals" ADD CONSTRAINT "message_retrievals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_retrievals" ADD CONSTRAINT "message_retrievals_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "material_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_memberships" ADD CONSTRAINT "course_memberships_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_memberships" ADD CONSTRAINT "course_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_memberships" ADD CONSTRAINT "course_memberships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_processing_commands" ADD CONSTRAINT "material_processing_commands_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_disabled_by_fkey" FOREIGN KEY ("disabled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_target_message_id_fkey" FOREIGN KEY ("target_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_assigned_instructor_id_fkey" FOREIGN KEY ("assigned_instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_cases" ADD CONSTRAINT "review_cases_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_triggers" ADD CONSTRAINT "review_triggers_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_triggers" ADD CONSTRAINT "review_triggers_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_evidence_snapshots" ADD CONSTRAINT "review_evidence_snapshots_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_actions" ADD CONSTRAINT "review_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_inbox_items" ADD CONSTRAINT "review_inbox_items_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_inbox_items" ADD CONSTRAINT "review_inbox_items_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_inbox_items" ADD CONSTRAINT "review_inbox_items_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_inbox_items" ADD CONSTRAINT "review_inbox_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_inbox_items" ADD CONSTRAINT "review_inbox_items_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_states" ADD CONSTRAINT "topic_states_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_attempts" ADD CONSTRAINT "tutoring_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_attempts" ADD CONSTRAINT "tutoring_attempts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_attempts" ADD CONSTRAINT "tutoring_attempts_student_message_id_fkey" FOREIGN KEY ("student_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_attempts" ADD CONSTRAINT "tutoring_attempts_assistant_message_id_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_attempts" ADD CONSTRAINT "tutoring_attempts_retry_of_attempt_id_fkey" FOREIGN KEY ("retry_of_attempt_id") REFERENCES "tutoring_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_candidate_attempts" ADD CONSTRAINT "tutoring_candidate_attempts_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "tutoring_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_results" ADD CONSTRAINT "guard_results_attempt_id_candidate_attempt_fkey" FOREIGN KEY ("attempt_id", "candidate_attempt") REFERENCES "tutoring_candidate_attempts"("attempt_id", "candidate_attempt") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "tutoring_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_student_message_id_fkey" FOREIGN KEY ("student_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_decisions" ADD CONSTRAINT "teaching_decisions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "tutoring_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_decisions" ADD CONSTRAINT "teaching_decisions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_decisions" ADD CONSTRAINT "teaching_decisions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_evidence_links" ADD CONSTRAINT "educational_analysis_evidence_links_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_evidence_links" ADD CONSTRAINT "educational_analysis_evidence_links_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_misconceptions" ADD CONSTRAINT "educational_analysis_misconceptions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_misconceptions" ADD CONSTRAINT "educational_analysis_misconceptions_evidence_message_id_fkey" FOREIGN KEY ("evidence_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tutoring_preferences" ADD CONSTRAINT "student_tutoring_preferences_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_imports" ADD CONSTRAINT "user_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_import_rows" ADD CONSTRAINT "user_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "user_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Handwritten net-live checks retained from the historical schema inventory.
ALTER TABLE "users"
  ADD CONSTRAINT "users_disabled_status_check"
  CHECK (("status" = 'DISABLED') = ("disabled_at" IS NOT NULL)),
  ADD CONSTRAINT "users_role_university_scope_check"
  CHECK (
    ("role" = 'SUPER_ADMIN' AND "university_id" IS NULL) OR
    ("role" IN ('ADMIN', 'INSTRUCTOR', 'STUDENT') AND "university_id" IS NOT NULL)
  );

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_extracted_text_length_check"
  CHECK ("extracted_text_length" IS NULL OR "extracted_text_length" >= 0),
  ADD CONSTRAINT "materials_chunk_count_check"
  CHECK ("chunk_count" IS NULL OR "chunk_count" >= 0);

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_sequence_check"
  CHECK ("sequence" >= 1),
  ADD CONSTRAINT "messages_hint_level_check"
  CHECK ("hint_level" IS NULL OR "hint_level" BETWEEN 1 AND 4),
  ADD CONSTRAINT "messages_input_tokens_check"
  CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0),
  ADD CONSTRAINT "messages_output_tokens_check"
  CHECK ("output_tokens" IS NULL OR "output_tokens" >= 0);

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_check"
  CHECK (char_length(btrim("action")) > 0),
  ADD CONSTRAINT "audit_logs_target_type_check"
  CHECK (char_length(btrim("target_type")) > 0);

ALTER TABLE "material_chunks"
  ADD CONSTRAINT "material_chunks_chunk_index_check"
  CHECK ("chunk_index" >= 0);

ALTER TABLE "message_retrievals"
  ADD CONSTRAINT "message_retrievals_rank_check"
  CHECK ("rank" >= 1),
  ADD CONSTRAINT "message_retrievals_similarity_score_check"
  CHECK ("similarity_score" IS NULL OR "similarity_score" BETWEEN -1 AND 1);

ALTER TABLE "message_citations"
  ADD CONSTRAINT "message_citations_citation_order_check"
  CHECK ("citation_order" >= 1);

ALTER TABLE "material_processing_commands"
  ADD CONSTRAINT "material_processing_commands_lease_check"
  CHECK (
    ("processing_attempt_id" IS NULL AND "lease_expires_at" IS NULL)
    OR
    ("processing_attempt_id" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
  );

-- The processing claim is intentionally partial: a material may be unclaimed,
-- but an attempt id can belong to only one material.
CREATE UNIQUE INDEX "materials_processing_attempt_id_key"
  ON "materials"("processing_attempt_id")
  WHERE "processing_attempt_id" IS NOT NULL;

ALTER TABLE "review_cases"
  ADD CONSTRAINT "review_cases_version_check"
  CHECK ("version" >= 1),
  ADD CONSTRAINT "review_cases_resolution_reason_check"
  CHECK ("resolution_reason" IS NULL OR char_length("resolution_reason") BETWEEN 1 AND 500),
  ADD CONSTRAINT "review_cases_terminal_shape_check"
  CHECK (
    ("status" IN ('PENDING', 'IN_REVIEW') AND "outcome" IS NULL AND "resolved_by_user_id" IS NULL AND "resolved_at" IS NULL AND "published_content" IS NULL AND "resolution_reason" IS NULL)
    OR
    ("status" = 'RESOLVED' AND "outcome" IN ('APPROVED', 'EDITED', 'REPLACED') AND "resolved_at" IS NOT NULL AND "published_content" IS NOT NULL)
    OR
    ("status" = 'REJECTED' AND "outcome" = 'REQUEST_REJECTED' AND "resolved_at" IS NOT NULL AND "published_content" IS NULL AND "resolution_reason" IS NOT NULL)
  );

ALTER TABLE "review_triggers"
  ADD CONSTRAINT "review_triggers_reason_check"
  CHECK ("reason" IS NULL OR char_length("reason") BETWEEN 1 AND 200),
  ADD CONSTRAINT "review_triggers_metadata_object_check"
  CHECK (jsonb_typeof("detector_metadata") = 'object'),
  ADD CONSTRAINT "review_triggers_shape_check"
  CHECK (
    ("type" = 'STUDENT_REQUEST' AND "source_event_key" IS NULL)
    OR
    ("type" <> 'STUDENT_REQUEST' AND "actor_user_id" IS NULL AND "source_event_key" IS NOT NULL)
  ),
  ADD CONSTRAINT "review_triggers_student_flag_reason_shape_check"
  CHECK (
    ("type" = 'STUDENT_REQUEST' AND "student_flag_reason" IS NOT NULL)
    OR ("type" <> 'STUDENT_REQUEST' AND "student_flag_reason" IS NULL)
  );

ALTER TABLE "review_evidence_snapshots"
  ADD CONSTRAINT "review_evidence_schema_version_check"
  CHECK ("schema_version" > 0),
  ADD CONSTRAINT "review_evidence_object_check"
  CHECK (jsonb_typeof("evidence") = 'object'),
  ADD CONSTRAINT "review_evidence_size_check"
  CHECK (octet_length("evidence"::text) <= 131072),
  ADD CONSTRAINT "review_evidence_content_hash_check"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "review_actions"
  ADD CONSTRAINT "review_actions_case_version_check"
  CHECK ("case_version" >= 1),
  ADD CONSTRAINT "review_actions_reason_check"
  CHECK ("reason" IS NULL OR char_length("reason") BETWEEN 1 AND 1000),
  ADD CONSTRAINT "review_actions_metadata_object_check"
  CHECK (jsonb_typeof("metadata") = 'object');

ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_fingerprint_check"
  CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "idempotency_records_response_status_check"
  CHECK ("response_status" BETWEEN 200 AND 599);

ALTER TABLE "review_inbox_items"
  ADD CONSTRAINT "review_inbox_items_state_shape_check"
  CHECK (
    ("status" = 'UNREAD' AND "read_at" IS NULL)
    OR
    ("status" = 'READ' AND "read_at" IS NOT NULL)
  );

CREATE UNIQUE INDEX "review_triggers_manual_actor_case_key"
  ON "review_triggers"("actor_user_id", "review_case_id")
  WHERE "type" = 'STUDENT_REQUEST';

CREATE UNIQUE INDEX "review_triggers_source_event_key_key"
  ON "review_triggers"("source_event_key")
  WHERE "source_event_key" IS NOT NULL;

ALTER TABLE "topic_states"
  ADD CONSTRAINT "topic_states_version_check"
  CHECK ("version" >= 1),
  ADD CONSTRAINT "topic_states_guidance_level_check"
  CHECK ("guidance_level" BETWEEN 1 AND 4);

ALTER TABLE "tutoring_attempts"
  ADD CONSTRAINT "tutoring_attempts_approval_metadata_check"
  CHECK (
    "status" <> 'COMPLETED' OR
    (
      "approval_source" IS NOT NULL AND
      "validation_policy_version" IS NOT NULL AND
      (
        (
          "approval_source" = 'VALIDATED_CANDIDATE' AND
          NOT "safe_fallback_used" AND
          "approved_candidate_attempt" BETWEEN 1 AND 3 AND
          "safe_fallback_reason" IS NULL
        ) OR
        (
          "approval_source" = 'SAFE_FALLBACK' AND
          "safe_fallback_used" AND
          "approved_candidate_attempt" IS NULL AND
          "safe_fallback_reason" IS NOT NULL
        ) OR
        (
          "approval_source" = 'CLASSIFIED_RESPONSE' AND
          NOT "safe_fallback_used" AND
          "approved_candidate_attempt" IS NULL AND
          "safe_fallback_reason" IS NULL
        )
      )
    )
  );

ALTER TABLE "teaching_decisions"
  ADD CONSTRAINT "teaching_decisions_guidance_level_check"
  CHECK ("guidance_level" >= 1 AND "guidance_level" <= 4);

ALTER TABLE "tutoring_candidate_attempts"
  ADD CONSTRAINT "tutoring_candidate_attempts_attempt_check"
  CHECK ("candidate_attempt" BETWEEN 1 AND 3),
  ADD CONSTRAINT "tutoring_candidate_attempts_tokens_check"
  CHECK (
    ("input_tokens" IS NULL OR "input_tokens" >= 0) AND
    ("output_tokens" IS NULL OR "output_tokens" >= 0) AND
    "infrastructure_retry_count" >= 0
  ),
  ADD CONSTRAINT "tutoring_candidate_attempts_time_check"
  CHECK ("completed_at" >= "started_at"),
  ADD CONSTRAINT "tutoring_candidate_attempts_content_check"
  CHECK (
    ("generation_outcome" = 'GENERATED' AND "content_hash" IS NOT NULL) OR
    ("generation_outcome" <> 'GENERATED')
  );

ALTER TABLE "guard_results"
  ADD CONSTRAINT "guard_results_violations_check"
  CHECK (jsonb_typeof("violations") = 'array' AND jsonb_array_length("violations") <= 8),
  ADD CONSTRAINT "guard_results_approval_check"
  CHECK (
    ("approved" AND "recommended_action" = 'APPROVE' AND jsonb_array_length("violations") = 0 AND "maximum_severity" IS NULL) OR
    (NOT "approved" AND "recommended_action" <> 'APPROVE' AND jsonb_array_length("violations") > 0 AND "maximum_severity" IS NOT NULL)
  ),
  ADD CONSTRAINT "guard_results_severity_check"
  CHECK ("maximum_severity" IS NULL OR "maximum_severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- Reviews owns this cross-table invariant. It is deferred so a transaction can
-- create the case and its completed response in the intended order.
CREATE FUNCTION enforce_review_case_target() RETURNS trigger AS $$
DECLARE
  target_role "message_role";
  target_status "message_status";
  target_completed_at TIMESTAMPTZ;
  target_course_id UUID;
BEGIN
  SELECT m."role", m."status", m."completed_at", s."course_id"
  INTO target_role, target_status, target_completed_at, target_course_id
  FROM "messages" m
  JOIN "chat_sessions" s ON s."id" = m."session_id"
  WHERE m."id" = NEW."target_message_id";

  IF target_role IS DISTINCT FROM 'ASSISTANT'
    OR target_status IS DISTINCT FROM 'COMPLETED'
    OR target_completed_at IS NULL
    OR target_course_id IS DISTINCT FROM NEW."course_id" THEN
    RAISE EXCEPTION 'review case target must be a completed assistant message in the derived course' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "review_cases_target_check"
AFTER INSERT OR UPDATE OF "target_message_id", "course_id" ON "review_cases"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_review_case_target();

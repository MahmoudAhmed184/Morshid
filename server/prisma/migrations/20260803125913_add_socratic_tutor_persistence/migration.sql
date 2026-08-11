-- CreateEnum
CREATE TYPE "topic_status" AS ENUM ('ACTIVE', 'PAUSED', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "tutor_turn_status" AS ENUM ('RECEIVED', 'ANALYZING', 'RETRIEVING', 'DECIDING', 'GENERATING', 'VALIDATING', 'REGENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "tutor_turn_failure_code" AS ENUM ('ANALYSIS_FAILED', 'RETRIEVAL_FAILED', 'GENERATION_FAILED', 'STRUCTURAL_VALIDATION_FAILED', 'DETERMINISTIC_GUARD_REJECTED', 'SEMANTIC_GUARD_REJECTED', 'REGENERATION_EXHAUSTED', 'PERSISTENCE_FAILED');

-- CreateEnum
CREATE TYPE "tutor_approval_source" AS ENUM (
  'VALIDATED_CANDIDATE',
  'SAFE_FALLBACK',
  'CLASSIFIED_RESPONSE'
);

-- CreateEnum
CREATE TYPE "tutor_safe_fallback_reason" AS ENUM (
  'VALIDATION_EXHAUSTED',
  'GUARD_UNAVAILABLE',
  'GENERATION_RETRY_FAILED'
);

-- CreateEnum
CREATE TYPE "student_state" AS ENUM ('UNKNOWN', 'NO_PRIOR_KNOWLEDGE', 'PARTIAL_UNDERSTANDING', 'MISCONCEPTION', 'DEBUGGING_ISSUE', 'NEAR_SOLUTION');

-- CreateEnum
CREATE TYPE "teaching_strategy" AS ENUM ('GUIDED_EXPLANATION', 'SOCRATIC_QUESTIONING', 'MISCONCEPTION_REPAIR', 'DEBUGGING_GUIDANCE');

-- CreateEnum
CREATE TYPE "teaching_technique" AS ENUM ('ORIENTATION_QUESTION', 'FOCUSED_QUESTION', 'DECOMPOSITION', 'ANALOGY', 'COMPARISON', 'COUNTEREXAMPLE', 'TRACE_EXECUTION', 'BOUNDARY_CHECK', 'SELF_EXPLANATION', 'VERIFICATION');

-- CreateEnum
CREATE TYPE "reveal_policy" AS ENUM ('NO_FINAL_ANSWER', 'PARTIAL_RESULT_ALLOWED', 'FINAL_REASONING_ALLOWED', 'COMPLETE_SOLUTION_ALLOWED');

-- CreateEnum
CREATE TYPE "misconception_status" AS ENUM ('SUSPECTED', 'ACTIVE', 'CORRECTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "topic_type" AS ENUM ('PROBLEM', 'CONCEPT', 'DEBUGGING_TASK', 'ASSIGNMENT_ITEM', 'MISCONCEPTION_REPAIR', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "learning_status" AS ENUM ('UNKNOWN', 'IN_PROGRESS', 'DEMONSTRATED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "resolution_evidence_strength" AS ENUM ('NONE', 'WEAK', 'MODERATE', 'STRONG');

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

    CONSTRAINT "topic_states_version_check" CHECK ("version" >= 1),
    CONSTRAINT "topic_states_guidance_level_check" CHECK ("guidance_level" BETWEEN 1 AND 4),
    CONSTRAINT "topic_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_turns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "topic_id" UUID,
    "student_message_id" UUID,
    "approved_tutor_message_id" UUID,
    "idempotency_key" VARCHAR(160) NOT NULL,
    "status" "tutor_turn_status" NOT NULL DEFAULT 'RECEIVED',
    "failure_code" "tutor_turn_failure_code",
    "safe_fallback_used" BOOLEAN NOT NULL DEFAULT false,
    "approval_source" "tutor_approval_source",
    "approved_candidate_attempt" SMALLINT,
    "safe_fallback_reason" "tutor_safe_fallback_reason",
    "validation_policy_version" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "tutor_turns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tutor_turns_approval_metadata_check"
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
      )
);

-- CreateIndex
CREATE INDEX "idx_topics_session_status" ON "topics"("session_id", "status");

-- CreateIndex
CREATE INDEX "idx_topics_course_problem" ON "topics"("course_id", "problem_id");

-- CreateIndex
CREATE INDEX "idx_topics_course_concept" ON "topics"("course_id", "concept_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_states_topic_id_key" ON "topic_states"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_turns_approved_tutor_message_id_key" ON "tutor_turns"("approved_tutor_message_id");

-- CreateIndex
CREATE INDEX "idx_tutor_turns_topic" ON "tutor_turns"("topic_id");

-- CreateIndex
CREATE INDEX "idx_tutor_turns_student_message" ON "tutor_turns"("student_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_turns_session_id_idempotency_key_key" ON "tutor_turns"("session_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_states" ADD CONSTRAINT "topic_states_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_turns" ADD CONSTRAINT "tutor_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_turns" ADD CONSTRAINT "tutor_turns_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_turns" ADD CONSTRAINT "tutor_turns_student_message_id_fkey" FOREIGN KEY ("student_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_turns" ADD CONSTRAINT "tutor_turns_approved_tutor_message_id_fkey" FOREIGN KEY ("approved_tutor_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

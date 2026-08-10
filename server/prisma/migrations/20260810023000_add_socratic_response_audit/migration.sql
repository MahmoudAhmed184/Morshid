-- CreateEnum
CREATE TYPE "tutor_candidate_generation_outcome" AS ENUM (
  'GENERATED',
  'INVALID_OUTPUT',
  'INFRASTRUCTURE_EXHAUSTED'
);

-- CreateEnum
CREATE TYPE "guard_validation_stage" AS ENUM (
  'STRUCTURAL',
  'DETERMINISTIC',
  'SEMANTIC'
);

-- CreateEnum
CREATE TYPE "guard_recommended_action" AS ENUM (
  'APPROVE',
  'REGENERATE',
  'USE_SAFE_FALLBACK'
);

-- CreateEnum
CREATE TYPE "tutor_approval_source" AS ENUM (
  'VALIDATED_CANDIDATE',
  'SAFE_FALLBACK'
);

-- CreateEnum
CREATE TYPE "tutor_safe_fallback_reason" AS ENUM (
  'VALIDATION_EXHAUSTED',
  'GUARD_UNAVAILABLE',
  'GENERATION_RETRY_FAILED',
  'GROUNDING_UNAVAILABLE',
  'LEGACY_UNCLASSIFIED'
);

-- AlterTable
ALTER TABLE "tutor_turns"
  ADD COLUMN "approval_source" "tutor_approval_source",
  ADD COLUMN "approved_candidate_attempt" SMALLINT,
  ADD COLUMN "safe_fallback_reason" "tutor_safe_fallback_reason",
  ADD COLUMN "validation_policy_version" VARCHAR(80);

-- Historical rows predate candidate and Guard audit records. Preserve that
-- distinction instead of inventing an approved attempt or fallback cause.
UPDATE "tutor_turns"
SET
  "approval_source" = CASE
    WHEN "safe_fallback_used" THEN 'SAFE_FALLBACK'::"tutor_approval_source"
    ELSE 'VALIDATED_CANDIDATE'::"tutor_approval_source"
  END,
  "safe_fallback_reason" = CASE
    WHEN "safe_fallback_used" THEN 'LEGACY_UNCLASSIFIED'::"tutor_safe_fallback_reason"
    ELSE NULL
  END,
  "validation_policy_version" = 'legacy-unversioned'
WHERE "status" = 'COMPLETED';

-- CreateTable
CREATE TABLE "tutor_candidate_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "turn_id" UUID NOT NULL,
  "candidate_attempt" SMALLINT NOT NULL,
  "generation_outcome" "tutor_candidate_generation_outcome" NOT NULL,
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

  CONSTRAINT "tutor_candidate_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tutor_candidate_attempts_attempt_check"
    CHECK ("candidate_attempt" BETWEEN 1 AND 3),
  CONSTRAINT "tutor_candidate_attempts_tokens_check"
    CHECK (
      ("input_tokens" IS NULL OR "input_tokens" >= 0) AND
      ("output_tokens" IS NULL OR "output_tokens" >= 0) AND
      "infrastructure_retry_count" >= 0
    ),
  CONSTRAINT "tutor_candidate_attempts_time_check"
    CHECK ("completed_at" >= "started_at"),
  CONSTRAINT "tutor_candidate_attempts_content_check"
    CHECK (
      ("generation_outcome" = 'GENERATED' AND "content_hash" IS NOT NULL) OR
      ("generation_outcome" <> 'GENERATED')
    )
);

-- CreateTable
CREATE TABLE "guard_results" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "turn_id" UUID NOT NULL,
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

  CONSTRAINT "guard_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "guard_results_violations_check"
    CHECK (jsonb_typeof("violations") = 'array' AND jsonb_array_length("violations") <= 8),
  CONSTRAINT "guard_results_approval_check"
    CHECK (
      ("approved" AND "recommended_action" = 'APPROVE' AND jsonb_array_length("violations") = 0 AND "maximum_severity" IS NULL) OR
      (NOT "approved" AND "recommended_action" <> 'APPROVE' AND jsonb_array_length("violations") > 0 AND "maximum_severity" IS NOT NULL)
    ),
  CONSTRAINT "guard_results_severity_check"
    CHECK ("maximum_severity" IS NULL OR "maximum_severity" IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- CreateIndex
CREATE UNIQUE INDEX "tutor_candidate_attempts_turn_attempt_key"
  ON "tutor_candidate_attempts"("turn_id", "candidate_attempt");

-- CreateIndex
CREATE INDEX "idx_tutor_candidate_attempts_turn"
  ON "tutor_candidate_attempts"("turn_id");

-- CreateIndex
CREATE UNIQUE INDEX "guard_results_turn_attempt_stage_key"
  ON "guard_results"("turn_id", "candidate_attempt", "validation_stage");

-- CreateIndex
CREATE INDEX "idx_guard_results_turn"
  ON "guard_results"("turn_id");

-- AddForeignKey
ALTER TABLE "tutor_candidate_attempts"
  ADD CONSTRAINT "tutor_candidate_attempts_turn_id_fkey"
  FOREIGN KEY ("turn_id") REFERENCES "tutor_turns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guard_results"
  ADD CONSTRAINT "guard_results_turn_attempt_fkey"
  FOREIGN KEY ("turn_id", "candidate_attempt")
  REFERENCES "tutor_candidate_attempts"("turn_id", "candidate_attempt")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- New completions must describe their approval source consistently. The
-- legacy marker intentionally permits missing historical candidate numbers.
ALTER TABLE "tutor_turns"
  ADD CONSTRAINT "tutor_turns_approval_metadata_check"
  CHECK (
    "status" <> 'COMPLETED' OR
    (
      "approval_source" IS NOT NULL AND
      "validation_policy_version" IS NOT NULL AND
      (
        "validation_policy_version" = 'legacy-unversioned' OR
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
        )
      )
    )
  );

-- Persist topic-scoped solution protection and the immutable decision used by each attempt.
CREATE TYPE "solution_protection_status" AS ENUM (
    'UNKNOWN',
    'UNPROTECTED',
    'PROTECTED'
);

CREATE TYPE "solution_protection_source" AS ENUM (
    'AUTHORITATIVE_TASK_METADATA',
    'EXPLICIT_PROTECTED_REQUEST',
    'ACCEPTED_TASK_ANALYSIS',
    'ACCEPTED_CONCEPT_ANALYSIS',
    'MIGRATED_TOPIC_HISTORY',
    'MIGRATED_CONCEPT_TOPIC',
    'CONSERVATIVE_UNKNOWN'
);

CREATE TYPE "output_risk_audit_source" AS ENUM (
    'APPROVAL_CANDIDATE',
    'SAFE_FALLBACK',
    'POST_APPROVAL'
);

ALTER TABLE "topics"
ADD COLUMN "solution_protection_status" "solution_protection_status" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "solution_protection_source" "solution_protection_source",
ADD COLUMN "solution_protection_policy_version" VARCHAR(80),
ADD COLUMN "solution_protection_established_at" TIMESTAMPTZ(6);

ALTER TABLE "tutoring_attempts"
ADD COLUMN "explicit_protected_solution_signal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "effective_solution_protection" BOOLEAN,
ADD COLUMN "solution_protection_source" "solution_protection_source",
ADD COLUMN "solution_protection_policy_version" VARCHAR(80),
ADD COLUMN "solution_protection_resolved_at" TIMESTAMPTZ(6);

-- Stable problem/task identity is authoritative under the current tutoring policy.
UPDATE "topics"
SET
    "solution_protection_status" = 'PROTECTED',
    "solution_protection_source" = 'AUTHORITATIVE_TASK_METADATA',
    "solution_protection_policy_version" = 'solution-protection.v1',
    "solution_protection_established_at" = "created_at"
WHERE
    "problem_id" IS NOT NULL
    OR "topic_type" IN ('PROBLEM', 'DEBUGGING_TASK', 'ASSIGNMENT_ITEM');

-- Preserve conservative protection for historical task analyses whose Topics
-- did not receive stable task metadata. ATTEMPT_DIAGNOSIS alone is not enough.
UPDATE "topics" AS topic
SET
    "solution_protection_status" = 'PROTECTED',
    "solution_protection_source" = 'MIGRATED_TOPIC_HISTORY',
    "solution_protection_policy_version" = 'solution-protection.v1',
    "solution_protection_established_at" = topic."created_at"
WHERE
    topic."solution_protection_status" = 'UNKNOWN'
    AND EXISTS (
        SELECT 1
        FROM "educational_analyses" AS analysis
        WHERE
            analysis."topic_id" = topic."id"
            AND analysis."analysis_source" <> 'fallback'
            AND analysis."request_kind" IN ('PROBLEM_LIKE', 'CODE_DIAGNOSIS')
    );

-- A stable concept identity is enough to backfill ordinary conceptual Topics.
-- Unclassified and misconception-repair Topics remain UNKNOWN conservatively.
UPDATE "topics"
SET
    "solution_protection_status" = 'UNPROTECTED',
    "solution_protection_source" = 'MIGRATED_CONCEPT_TOPIC',
    "solution_protection_policy_version" = 'solution-protection.v1',
    "solution_protection_established_at" = "created_at"
WHERE
    "solution_protection_status" = 'UNKNOWN'
    AND "topic_type" = 'CONCEPT';

CREATE TABLE "output_risk_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "candidate_attempt" SMALLINT,
    "source" "output_risk_audit_source" NOT NULL,
    "detector_version" VARCHAR(80) NOT NULL,
    "risks" JSONB NOT NULL,
    "protect_target_solution" BOOLEAN NOT NULL,
    "solution_protection_source" "solution_protection_source" NOT NULL,
    "solution_protection_policy_version" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "output_risk_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "output_risk_events_attempt_id_fkey"
      FOREIGN KEY ("attempt_id") REFERENCES "tutoring_attempts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_output_risk_events_attempt"
ON "output_risk_events"("attempt_id");

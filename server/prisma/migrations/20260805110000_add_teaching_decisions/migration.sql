CREATE TYPE "reflection_mode" AS ENUM (
  'NONE',
  'SELF_EXPLANATION',
  'VERIFICATION',
  'TRANSFER'
);

CREATE TABLE "teaching_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "turn_id" UUID NOT NULL,
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

  CONSTRAINT "teaching_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teaching_decisions_guidance_level_check" CHECK (
    "guidance_level" >= 1
    AND "guidance_level" <= 4
  )
);

CREATE UNIQUE INDEX "teaching_decisions_turn_id_key" ON "teaching_decisions"("turn_id");
CREATE UNIQUE INDEX "teaching_decisions_analysis_id_key" ON "teaching_decisions"("analysis_id");
CREATE INDEX "idx_teaching_decisions_topic_created" ON "teaching_decisions"("topic_id", "created_at");
CREATE INDEX "idx_teaching_decisions_policy_version" ON "teaching_decisions"("policy_version");

ALTER TABLE "teaching_decisions"
ADD CONSTRAINT "teaching_decisions_turn_id_fkey"
FOREIGN KEY ("turn_id") REFERENCES "tutor_turns"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "teaching_decisions"
ADD CONSTRAINT "teaching_decisions_topic_id_fkey"
FOREIGN KEY ("topic_id") REFERENCES "topics"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "teaching_decisions"
ADD CONSTRAINT "teaching_decisions_analysis_id_fkey"
FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

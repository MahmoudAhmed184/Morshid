-- CreateEnum
CREATE TYPE "educational_analysis_evidence_kind" AS ENUM ('TOP_LEVEL', 'EFFORT', 'LEARNING');

-- CreateTable
CREATE TABLE "educational_analyses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "turn_id" UUID NOT NULL,
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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educational_analyses_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "educational_analyses_turn_id_attempt_key" ON "educational_analyses"("turn_id", "attempt");

-- CreateIndex
CREATE INDEX "idx_educational_analyses_topic_created" ON "educational_analyses"("topic_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_educational_analyses_student_message" ON "educational_analyses"("student_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "educational_analysis_evidence_links_analysis_kind_ordinal_key" ON "educational_analysis_evidence_links"("analysis_id", "kind", "ordinal");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_evidence_links_message" ON "educational_analysis_evidence_links"("message_id");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_misconceptions_analysis" ON "educational_analysis_misconceptions"("analysis_id");

-- CreateIndex
CREATE INDEX "idx_educational_analysis_misconceptions_evidence" ON "educational_analysis_misconceptions"("evidence_message_id");

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_turn_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "tutor_turns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analyses" ADD CONSTRAINT "educational_analyses_student_message_id_fkey" FOREIGN KEY ("student_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_evidence_links" ADD CONSTRAINT "educational_analysis_evidence_links_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_evidence_links" ADD CONSTRAINT "educational_analysis_evidence_links_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_misconceptions" ADD CONSTRAINT "educational_analysis_misconceptions_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "educational_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educational_analysis_misconceptions" ADD CONSTRAINT "educational_analysis_misconceptions_evidence_message_id_fkey" FOREIGN KEY ("evidence_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

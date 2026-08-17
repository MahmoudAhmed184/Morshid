CREATE TABLE "debugging_diagnoses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tutoring_attempt_id" UUID NOT NULL,
    "schema_version" VARCHAR(80) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "language" VARCHAR(80),
    "category" VARCHAR(40) NOT NULL,
    "confidence" VARCHAR(20) NOT NULL,
    "likely_defect" TEXT,
    "location_message_id" UUID NOT NULL,
    "line_start" INTEGER,
    "line_end" INTEGER,
    "location_kind" VARCHAR(20) NOT NULL,
    "evidence" JSONB NOT NULL,
    "underlying_concept" TEXT,
    "requires_runtime_evidence" BOOLEAN NOT NULL,
    "runtime_evidence_needed" VARCHAR(40) NOT NULL,
    "inspection_goal" TEXT NOT NULL,
    "fallback_reason" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debugging_diagnoses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "debugging_diagnoses_attempt_id_key" UNIQUE ("tutoring_attempt_id"),
    CONSTRAINT "debugging_diagnoses_attempt_id_fkey"
      FOREIGN KEY ("tutoring_attempt_id") REFERENCES "tutoring_attempts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_debugging_diagnoses_location_message"
ON "debugging_diagnoses"("location_message_id");

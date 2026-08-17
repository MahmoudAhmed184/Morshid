ALTER TABLE "debugging_diagnoses"
ADD COLUMN "provider" VARCHAR(80),
ADD COLUMN "model" VARCHAR(200),
ADD COLUMN "prompt_version" VARCHAR(80),
ADD COLUMN "input_tokens" INTEGER,
ADD COLUMN "output_tokens" INTEGER,
ADD COLUMN "infrastructure_retry_count" INTEGER NOT NULL DEFAULT 0;

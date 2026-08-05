ALTER TABLE "educational_analyses"
ADD COLUMN "analysis_source" VARCHAR(40) NOT NULL DEFAULT 'model',
ADD COLUMN "fallback_reason" VARCHAR(80),
ADD COLUMN "failure_category" VARCHAR(120),
ADD COLUMN "confidence_policy_version" VARCHAR(120),
ADD COLUMN "infrastructure_retry_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "idx_educational_analyses_source_reason" ON "educational_analyses"("analysis_source", "fallback_reason");

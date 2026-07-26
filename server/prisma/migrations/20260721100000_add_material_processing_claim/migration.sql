-- A processing attempt must atomically claim a material before touching its
-- chunks. The claim prevents duplicate in-process jobs from finalizing or
-- cleaning up another attempt's work.
ALTER TABLE "materials"
ADD COLUMN "processing_attempt_id" UUID;

CREATE UNIQUE INDEX "materials_processing_attempt_id_key"
ON "materials"("processing_attempt_id")
WHERE "processing_attempt_id" IS NOT NULL;

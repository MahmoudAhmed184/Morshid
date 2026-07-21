CREATE TABLE "material_processing_commands" (
    "material_id" UUID NOT NULL,
    "processing_attempt_id" UUID,
    "lease_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_processing_commands_pkey" PRIMARY KEY ("material_id"),
    CONSTRAINT "material_processing_commands_lease_check" CHECK (
      ("processing_attempt_id" IS NULL AND "lease_expires_at" IS NULL)
      OR
      ("processing_attempt_id" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
    )
);

CREATE INDEX "idx_material_processing_commands_lease"
ON "material_processing_commands"("lease_expires_at", "created_at");

ALTER TABLE "material_processing_commands"
ADD CONSTRAINT "material_processing_commands_material_id_fkey"
FOREIGN KEY ("material_id") REFERENCES "materials"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

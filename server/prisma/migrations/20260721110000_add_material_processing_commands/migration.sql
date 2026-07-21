CREATE TABLE "material_processing_commands" (
    "material_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_processing_commands_pkey" PRIMARY KEY ("material_id")
);

ALTER TABLE "material_processing_commands"
ADD CONSTRAINT "material_processing_commands_material_id_fkey"
FOREIGN KEY ("material_id") REFERENCES "materials"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

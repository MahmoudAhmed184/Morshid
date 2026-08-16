CREATE TYPE "user_import_status" AS ENUM ('PENDING', 'APPROVED');
CREATE TYPE "user_import_row_status" AS ENUM ('VALID', 'INVALID', 'APPROVED');

CREATE TABLE "user_imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "user_import_status" NOT NULL DEFAULT 'PENDING',
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_imports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "user_import_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "import_id" UUID NOT NULL,
  "row_number" INTEGER NOT NULL,
  "display_name" VARCHAR(120),
  "email" CITEXT,
  "role" "user_role",
  "password_hash" TEXT,
  "status" "user_import_row_status" NOT NULL,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "created_user_id" UUID,
  CONSTRAINT "user_import_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "user_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "user_import_rows_import_row_key" ON "user_import_rows"("import_id", "row_number");
CREATE INDEX "idx_user_imports_creator_created" ON "user_imports"("created_by_id", "created_at");
CREATE INDEX "idx_user_import_rows_import_status" ON "user_import_rows"("import_id", "status");

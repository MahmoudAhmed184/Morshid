-- 1. Add university_id column to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "university_id" UUID;

-- 2. Backfill existing audit_logs.university_id from courses
UPDATE "audit_logs" al
SET "university_id" = c."university_id"
FROM "courses" c
WHERE al."course_id" = c."id" AND al."university_id" IS NULL;

-- 3. Backfill remaining audit_logs.university_id from users (actors)
UPDATE "audit_logs" al
SET "university_id" = u."university_id"
FROM "users" u
WHERE al."actor_user_id" = u."id" AND al."university_id" IS NULL AND u."university_id" IS NOT NULL;

-- 4. Add foreign key and index on audit_logs(university_id)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_university_id_fkey"
FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "idx_audit_university_created" ON "audit_logs"("university_id", "created_at");

-- 5. Drop global course code unique constraint
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_code_key";
DROP INDEX IF EXISTS "courses_code_key";

-- 6. Add scoped partial unique index on courses(university_id, lower(trim(code))) for active courses
CREATE UNIQUE INDEX "courses_university_id_code_active_key"
ON "courses"("university_id", lower(trim("code")))
WHERE "archived_at" IS NULL;

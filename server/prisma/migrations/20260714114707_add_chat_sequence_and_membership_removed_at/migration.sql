-- DropIndex
DROP INDEX "idx_memberships_course_role";

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "last_sequence" INTEGER NOT NULL DEFAULT 0;

-- Backfill last_sequence for any session that already has messages so the next
-- append does not reuse an existing sequence and violate the
-- messages_session_id_sequence_key unique constraint.
UPDATE "chat_sessions"
SET "last_sequence" = COALESCE(
  (
    SELECT MAX("m"."sequence")
    FROM "messages" "m"
    WHERE "m"."session_id" = "chat_sessions"."id"
  ),
  0
);

-- AlterTable
ALTER TABLE "course_memberships" ADD COLUMN     "removed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "idx_memberships_course_role_active" ON "course_memberships"("course_id", "role", "removed_at");

-- DropIndex
DROP INDEX "idx_memberships_course_role";

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "last_sequence" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "course_memberships" ADD COLUMN     "removed_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "idx_memberships_course_role_active" ON "course_memberships"("course_id", "role", "removed_at");

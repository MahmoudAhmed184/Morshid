ALTER TABLE "courses" ADD COLUMN "archived_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_courses_archived_at" ON "courses"("archived_at");

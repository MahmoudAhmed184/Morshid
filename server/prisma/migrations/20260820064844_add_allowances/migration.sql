-- CreateEnum
CREATE TYPE "allowance_reset_scope" AS ENUM ('TUTORING', 'REVIEW', 'BOTH');

-- CreateTable
CREATE TABLE "deployment_policy_defaults" (
    "id" VARCHAR(40) NOT NULL DEFAULT 'default',
    "tutoring_limit" INTEGER NOT NULL DEFAULT 30,
    "review_limit" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_policy_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_policy_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "tutoring_limit" INTEGER,
    "review_limit" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_policy_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "scope" "allowance_reset_scope" NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowance_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_policy_overrides_course_id_key" ON "course_policy_overrides"("course_id");

-- CreateIndex
CREATE INDEX "idx_allowance_resets_student_course_created" ON "allowance_resets"("student_id", "course_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "course_policy_overrides" ADD CONSTRAINT "course_policy_overrides_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_resets" ADD CONSTRAINT "allowance_resets_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_resets" ADD CONSTRAINT "allowance_resets_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowance_resets" ADD CONSTRAINT "allowance_resets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddChecks
ALTER TABLE "deployment_policy_defaults" ADD CONSTRAINT "deployment_policy_defaults_tutoring_limit_check" CHECK ("tutoring_limit" >= 0 AND "tutoring_limit" <= 500);
ALTER TABLE "deployment_policy_defaults" ADD CONSTRAINT "deployment_policy_defaults_review_limit_check" CHECK ("review_limit" >= 0 AND "review_limit" <= 20);
ALTER TABLE "course_policy_overrides" ADD CONSTRAINT "course_policy_overrides_tutoring_limit_check" CHECK ("tutoring_limit" IS NULL OR ("tutoring_limit" >= 0 AND "tutoring_limit" <= 500));
ALTER TABLE "course_policy_overrides" ADD CONSTRAINT "course_policy_overrides_review_limit_check" CHECK ("review_limit" IS NULL OR ("review_limit" >= 0 AND "review_limit" <= 20));
ALTER TABLE "course_policy_overrides" ADD CONSTRAINT "course_policy_overrides_limit_present_check" CHECK ("tutoring_limit" IS NOT NULL OR "review_limit" IS NOT NULL);
ALTER TABLE "allowance_resets" ADD CONSTRAINT "allowance_resets_reason_check" CHECK (length(trim("reason")) > 0);

-- InsertDefault
INSERT INTO "deployment_policy_defaults" ("id", "tutoring_limit", "review_limit") VALUES ('default', 30, 3) ON CONFLICT DO NOTHING;

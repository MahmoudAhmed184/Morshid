CREATE TYPE "student_flag_reason" AS ENUM (
  'INCORRECT',
  'CONFUSING',
  'UNHELPFUL',
  'COURSE_MISMATCH',
  'TOO_MUCH_ANSWER',
  'OTHER'
);

ALTER TABLE "review_triggers"
ADD COLUMN "student_flag_reason" "student_flag_reason";

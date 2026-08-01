ALTER TABLE "review_triggers"
ADD CONSTRAINT "review_triggers_student_flag_reason_shape_check"
CHECK (
  "type" = 'STUDENT_REQUEST'
  OR "student_flag_reason" IS NULL
);

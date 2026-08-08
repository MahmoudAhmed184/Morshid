ALTER TABLE "review_triggers"
ADD CONSTRAINT "review_triggers_student_flag_reason_shape_check"
CHECK (
  ("type" = 'STUDENT_REQUEST' AND "student_flag_reason" IS NOT NULL)
  OR ("type" <> 'STUDENT_REQUEST' AND "student_flag_reason" IS NULL)
);

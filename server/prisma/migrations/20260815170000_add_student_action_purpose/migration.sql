CREATE TYPE "student_action_purpose" AS ENUM (
    'PRIOR_ATTEMPT_ORIENTATION',
    'CONCEPTUAL_UNDERSTANDING',
    'PRIMARY_TECHNIQUE'
);

ALTER TABLE "teaching_decisions"
ADD COLUMN "student_action_purpose" "student_action_purpose";

UPDATE "teaching_decisions" AS decision
SET "student_action_purpose" = CASE
    WHEN
        analysis."request_kind" = 'CONCEPTUAL'
        AND analysis."effort_present" = false
        AND analysis."student_state" NOT IN ('MISCONCEPTION', 'DEBUGGING_ISSUE')
        AND NOT EXISTS (
            SELECT 1
            FROM "educational_analysis_misconceptions" AS misconception
            WHERE misconception."analysis_id" = analysis."id"
        )
      THEN 'CONCEPTUAL_UNDERSTANDING'::"student_action_purpose"
    WHEN
        analysis."request_kind" = 'PROBLEM_LIKE'
        AND analysis."effort_present" = false
        AND decision."guidance_level" = 1
        AND decision."primary_technique" = 'ORIENTATION_QUESTION'
      THEN 'PRIOR_ATTEMPT_ORIENTATION'::"student_action_purpose"
    ELSE 'PRIMARY_TECHNIQUE'::"student_action_purpose"
END
FROM "educational_analyses" AS analysis
WHERE decision."analysis_id" = analysis."id";

ALTER TABLE "teaching_decisions"
ALTER COLUMN "student_action_purpose" SET NOT NULL;

CREATE TYPE "answer_correctness" AS ENUM (
    'UNASSESSED',
    'INCORRECT',
    'PARTIALLY_CORRECT',
    'CORRECT'
);

ALTER TABLE "educational_analyses"
ADD COLUMN "answer_correctness" "answer_correctness" NOT NULL DEFAULT 'UNASSESSED',
ADD COLUMN "objective_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "misconception_recovery_verified" BOOLEAN NOT NULL DEFAULT false;

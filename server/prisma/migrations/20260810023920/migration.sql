-- Align the hand-authored audit migration's composite foreign-key name with
-- the Prisma schema so migrate status remains drift-free.
ALTER TABLE "guard_results" RENAME CONSTRAINT "guard_results_turn_attempt_fkey" TO "guard_results_turn_id_candidate_attempt_fkey";

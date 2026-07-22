BEGIN;

-- Legacy policy: duplicate responses are retained for manual review rather
-- than deleted or rewritten without product approval. Fail before changing the
-- old index and identify the affected Student message ids in the diagnostic.
DO $$
DECLARE
  duplicate_response_ids text;
BEGIN
  SELECT string_agg(response_to_message_id::text, ', ' ORDER BY response_to_message_id)
  INTO duplicate_response_ids
  FROM (
    SELECT response_to_message_id
    FROM messages
    WHERE response_to_message_id IS NOT NULL
    GROUP BY response_to_message_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_response_ids IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'Cannot enforce one response per message: duplicate legacy response_to_message_id values exist',
      DETAIL = 'Affected message ids: ' || duplicate_response_ids,
      HINT = 'Review and reconcile duplicate assistant responses before retrying this migration.';
  END IF;
END
$$;

-- DropIndex
DROP INDEX "idx_messages_response_to";

-- CreateIndex
CREATE UNIQUE INDEX "messages_response_to_message_id_key" ON "messages"("response_to_message_id");

-- A durable attempt identity prevents a late worker from overwriting a newer
-- retry. The bounded lease makes PENDING work reclaimable after process death
-- or an unavailable terminal write. Both columns remain nullable for messages
-- created outside the grounded-chat orchestration seam and for legacy rows.
ALTER TABLE "messages"
  ADD COLUMN "grounding_attempt_id" UUID,
  ADD COLUMN "grounding_lease_expires_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_messages_grounding_lease"
  ON "messages"("session_id", "status", "grounding_lease_expires_at");

COMMIT;

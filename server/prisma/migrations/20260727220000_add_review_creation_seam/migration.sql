CREATE TYPE "review_status" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TYPE "review_trigger_type" AS ENUM (
  'STUDENT_REQUEST',
  'GENERAL_NOT_FOUND',
  'CITATION_MISSING',
  'SOURCE_CONFLICT',
  'POLICY_CHECK_FAILED',
  'FINAL_ANSWER_RISK'
);

CREATE TYPE "review_action_type" AS ENUM (
  'CREATED',
  'TRIGGER_ADDED',
  'CLAIMED',
  'DRAFT_SAVED',
  'APPROVED',
  'EDITED',
  'REPLACED',
  'REJECTED'
);

CREATE TYPE "review_outcome" AS ENUM ('APPROVED', 'EDITED', 'REPLACED', 'REQUEST_REJECTED');

CREATE TYPE "notification_type" AS ENUM ('REVIEW_RESOLVED', 'REVIEW_REJECTED', 'USAGE_LIMIT_REACHED');

CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

CREATE TABLE "review_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "target_message_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "requested_by_user_id" UUID,
  "assigned_instructor_id" UUID,
  "resolved_by_user_id" UUID,
  "status" "review_status" NOT NULL DEFAULT 'PENDING',
  "outcome" "review_outcome",
  "draft_content" TEXT,
  "published_content" TEXT,
  "resolution_reason" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "assigned_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_cases_version_check" CHECK ("version" >= 1),
  CONSTRAINT "review_cases_resolution_reason_check" CHECK ("resolution_reason" IS NULL OR char_length("resolution_reason") BETWEEN 1 AND 500),
  CONSTRAINT "review_cases_terminal_shape_check" CHECK (
    ("status" IN ('PENDING', 'IN_REVIEW') AND "outcome" IS NULL AND "resolved_by_user_id" IS NULL AND "resolved_at" IS NULL AND "published_content" IS NULL AND "resolution_reason" IS NULL)
    OR
    ("status" = 'RESOLVED' AND "outcome" IN ('APPROVED', 'EDITED', 'REPLACED') AND "resolved_at" IS NOT NULL AND "published_content" IS NOT NULL)
    OR
    ("status" = 'REJECTED' AND "outcome" = 'REQUEST_REJECTED' AND "resolved_at" IS NOT NULL AND "published_content" IS NULL AND "resolution_reason" IS NOT NULL)
  ),
  CONSTRAINT "review_cases_target_message_id_key" UNIQUE ("target_message_id"),
  CONSTRAINT "review_cases_target_message_id_fkey" FOREIGN KEY ("target_message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_cases_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_cases_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "review_cases_assigned_instructor_id_fkey" FOREIGN KEY ("assigned_instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "review_cases_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "review_triggers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "review_case_id" UUID NOT NULL,
  "type" "review_trigger_type" NOT NULL,
  "actor_user_id" UUID,
  "reason" VARCHAR(200),
  "source_event_key" VARCHAR(200),
  "detector_metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_triggers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_triggers_reason_check" CHECK ("reason" IS NULL OR char_length("reason") BETWEEN 1 AND 200),
  CONSTRAINT "review_triggers_metadata_object_check" CHECK (jsonb_typeof("detector_metadata") = 'object'),
  CONSTRAINT "review_triggers_shape_check" CHECK (
    ("type" = 'STUDENT_REQUEST' AND "source_event_key" IS NULL)
    OR
    ("type" <> 'STUDENT_REQUEST' AND "actor_user_id" IS NULL AND "source_event_key" IS NOT NULL)
  ),
  CONSTRAINT "review_triggers_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_triggers_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "review_evidence_snapshots" (
  "review_case_id" UUID NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "evidence" JSONB NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_evidence_snapshots_pkey" PRIMARY KEY ("review_case_id"),
  CONSTRAINT "review_evidence_schema_version_check" CHECK ("schema_version" > 0),
  CONSTRAINT "review_evidence_object_check" CHECK (jsonb_typeof("evidence") = 'object'),
  CONSTRAINT "review_evidence_size_check" CHECK (octet_length("evidence"::text) <= 131072),
  CONSTRAINT "review_evidence_content_hash_check" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "review_evidence_snapshots_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "review_actions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "review_case_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action_type" "review_action_type" NOT NULL,
  "from_status" "review_status",
  "to_status" "review_status" NOT NULL,
  "content" TEXT,
  "reason" VARCHAR(1000),
  "case_version" INTEGER NOT NULL,
  "operation_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_actions_case_version_key" UNIQUE ("review_case_id", "case_version"),
  CONSTRAINT "review_actions_operation_id_key" UNIQUE ("operation_id"),
  CONSTRAINT "review_actions_case_version_check" CHECK ("case_version" >= 1),
  CONSTRAINT "review_actions_reason_check" CHECK ("reason" IS NULL OR char_length("reason") BETWEEN 1 AND 1000),
  CONSTRAINT "review_actions_metadata_object_check" CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "review_actions_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "review_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "operation_scope" VARCHAR(80) NOT NULL,
  "key" VARCHAR(200) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "resource_id" UUID NOT NULL,
  "response_status" SMALLINT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_actor_scope_key_key" UNIQUE ("actor_user_id", "operation_scope", "key"),
  CONSTRAINT "idempotency_records_fingerprint_check" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "idempotency_records_response_status_check" CHECK ("response_status" BETWEEN 200 AND 599),
  CONSTRAINT "idempotency_records_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_user_id" UUID NOT NULL,
  "review_case_id" UUID,
  "type" "notification_type" NOT NULL,
  "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "read_at" TIMESTAMPTZ(6),
  "dismissed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_metadata_object_check" CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "notifications_state_shape_check" CHECK (
    ("status" = 'UNREAD' AND "read_at" IS NULL AND "dismissed_at" IS NULL)
    OR
    ("status" = 'READ' AND "read_at" IS NOT NULL AND "dismissed_at" IS NULL)
    OR
    ("status" = 'DISMISSED' AND "dismissed_at" IS NOT NULL)
  ),
  CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "notifications_review_case_id_fkey" FOREIGN KEY ("review_case_id") REFERENCES "review_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_review_cases_course_status_created" ON "review_cases"("course_id", "status", "created_at" DESC, "id" DESC);
CREATE INDEX "idx_review_cases_assignee_status_updated" ON "review_cases"("assigned_instructor_id", "status", "updated_at" DESC);
CREATE INDEX "idx_review_cases_requester_created" ON "review_cases"("requested_by_user_id", "created_at" DESC);
CREATE INDEX "idx_review_triggers_case_created" ON "review_triggers"("review_case_id", "created_at");
CREATE INDEX "idx_review_triggers_type_created" ON "review_triggers"("type", "created_at");
CREATE UNIQUE INDEX "review_triggers_manual_actor_case_key" ON "review_triggers"("actor_user_id", "review_case_id") WHERE "type" = 'STUDENT_REQUEST';
CREATE UNIQUE INDEX "review_triggers_source_event_key_key" ON "review_triggers"("source_event_key") WHERE "source_event_key" IS NOT NULL;
CREATE INDEX "idx_review_actions_case_created" ON "review_actions"("review_case_id", "created_at", "id");
CREATE INDEX "idx_idempotency_records_expires" ON "idempotency_records"("expires_at");
CREATE UNIQUE INDEX "notifications_terminal_review_key" ON "notifications"("recipient_user_id", "review_case_id") WHERE "review_case_id" IS NOT NULL AND "type" IN ('REVIEW_RESOLVED', 'REVIEW_REJECTED');
CREATE INDEX "idx_notifications_recipient_active" ON "notifications"("recipient_user_id", "created_at" DESC, "id" DESC) WHERE "dismissed_at" IS NULL;
CREATE INDEX "idx_notifications_recipient_unread" ON "notifications"("recipient_user_id") WHERE "status" = 'UNREAD';

CREATE FUNCTION enforce_review_case_target() RETURNS trigger AS $$
DECLARE
  target_role "message_role";
  target_status "message_status";
  target_completed_at TIMESTAMPTZ;
  target_course_id UUID;
BEGIN
  SELECT m."role", m."status", m."completed_at", s."course_id"
  INTO target_role, target_status, target_completed_at, target_course_id
  FROM "messages" m
  JOIN "chat_sessions" s ON s."id" = m."session_id"
  WHERE m."id" = NEW."target_message_id";

  IF target_role IS DISTINCT FROM 'ASSISTANT'
    OR target_status IS DISTINCT FROM 'COMPLETED'
    OR target_completed_at IS NULL
    OR target_course_id IS DISTINCT FROM NEW."course_id" THEN
    RAISE EXCEPTION 'review case target must be a completed assistant message in the derived course' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "review_cases_target_check"
AFTER INSERT OR UPDATE OF "target_message_id", "course_id" ON "review_cases"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_review_case_target();

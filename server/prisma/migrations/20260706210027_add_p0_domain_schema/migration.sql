CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('ADMIN', 'INSTRUCTOR', 'STUDENT');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE course_membership_role AS ENUM ('INSTRUCTOR', 'STUDENT');
CREATE TYPE material_status AS ENUM ('PROCESSING', 'READY', 'WARNING', 'FAILED');
CREATE TYPE message_role AS ENUM ('STUDENT', 'ASSISTANT', 'SYSTEM');
CREATE TYPE message_status AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE message_request_kind AS ENUM (
  'CONCEPTUAL',
  'PROBLEM_LIKE',
  'ATTEMPT_DIAGNOSIS',
  'CODE_DIAGNOSIS',
  'UNSAFE',
  'OFF_TOPIC',
  'AMBIGUOUS'
);
CREATE TYPE message_guidance_label AS ENUM (
  'COURSE_GROUNDED',
  'GENERAL_NOT_FOUND',
  'UNCERTAIN_AWAITING_REVIEW',
  'INSTRUCTOR_REVIEWED',
  'REFUSAL'
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  password_hash TEXT NOT NULL,
  disabled_at TIMESTAMPTZ,
  disabled_by UUID,
  last_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_disabled_by_fkey FOREIGN KEY (disabled_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT users_disabled_status_check CHECK ((status = 'DISABLED') = (disabled_at IS NOT NULL))
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_token_id UUID,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT refresh_tokens_replaced_by_token_id_fkey FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT courses_code_key UNIQUE (code),
  CONSTRAINT courses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE course_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role course_membership_role NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT course_memberships_course_id_user_id_key UNIQUE (course_id, user_id),
  CONSTRAINT course_memberships_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT course_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT course_memberships_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  title VARCHAR(180) NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  sha256_hash CHAR(64),
  status material_status NOT NULL DEFAULT 'PROCESSING',
  extracted_text_length INTEGER,
  chunk_count INTEGER,
  error_message TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT materials_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT materials_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT materials_extracted_text_length_check CHECK (extracted_text_length IS NULL OR extracted_text_length >= 0),
  CONSTRAINT materials_chunk_count_check CHECK (chunk_count IS NULL OR chunk_count >= 0)
);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  student_id UUID NOT NULL,
  title VARCHAR(160) NOT NULL,
  last_message_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chat_sessions_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chat_sessions_course_id_student_id_fkey FOREIGN KEY (course_id, student_id) REFERENCES course_memberships(course_id, user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  sequence INTEGER NOT NULL,
  role message_role NOT NULL,
  author_user_id UUID,
  response_to_message_id UUID,
  content TEXT NOT NULL,
  status message_status NOT NULL,
  request_kind message_request_kind,
  guidance_label message_guidance_label,
  hint_level SMALLINT,
  provider VARCHAR(80),
  model VARCHAR(120),
  prompt_version VARCHAR(80),
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_code VARCHAR(80),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT messages_session_id_sequence_key UNIQUE (session_id, sequence),
  CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT messages_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT messages_response_to_message_id_fkey FOREIGN KEY (response_to_message_id) REFERENCES messages(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT messages_sequence_check CHECK (sequence >= 1),
  CONSTRAINT messages_hint_level_check CHECK (hint_level IS NULL OR hint_level BETWEEN 1 AND 4),
  CONSTRAINT messages_input_tokens_check CHECK (input_tokens IS NULL OR input_tokens >= 0),
  CONSTRAINT messages_output_tokens_check CHECK (output_tokens IS NULL OR output_tokens >= 0)
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id UUID,
  course_id UUID,
  ip INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT audit_logs_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT audit_logs_action_check CHECK (char_length(btrim(action)) > 0),
  CONSTRAINT audit_logs_target_type_check CHECK (char_length(btrim(target_type)) > 0)
);

CREATE INDEX idx_users_disabled_by ON users(disabled_by);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_replaced_by ON refresh_tokens(replaced_by_token_id);
CREATE INDEX idx_courses_created_by ON courses(created_by);
CREATE INDEX idx_memberships_course_role ON course_memberships(course_id, role);
CREATE INDEX idx_memberships_user ON course_memberships(user_id);
CREATE INDEX idx_memberships_created_by ON course_memberships(created_by);
CREATE INDEX idx_materials_course_status ON materials(course_id, status, deleted_at);
CREATE INDEX idx_materials_uploaded_by ON materials(uploaded_by);
CREATE INDEX idx_sessions_course ON chat_sessions(course_id);
CREATE INDEX idx_sessions_course_student ON chat_sessions(course_id, student_id);
CREATE INDEX idx_sessions_student_course ON chat_sessions(student_id, course_id, deleted_at, last_message_at);
CREATE INDEX idx_messages_author ON messages(author_user_id);
CREATE INDEX idx_messages_response_to ON messages(response_to_message_id);
CREATE INDEX idx_audit_course_created ON audit_logs(course_id, created_at);
CREATE INDEX idx_audit_actor_created ON audit_logs(actor_user_id, created_at);

-- Existing rows may have no digest because hashing was introduced as a nullable
-- compatibility field. PostgreSQL permits multiple NULL values in this index.
-- Soft-deleted materials are excluded so an instructor can re-upload a source
-- after deleting it.
CREATE UNIQUE INDEX "materials_course_id_sha256_hash_active_key"
ON "materials"("course_id", "sha256_hash")
WHERE "deleted_at" IS NULL AND "sha256_hash" IS NOT NULL;

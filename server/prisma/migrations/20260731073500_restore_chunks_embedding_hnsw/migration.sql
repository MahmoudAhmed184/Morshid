-- Prisma cannot represent the pgvector HNSW access method in schema.prisma.
-- Restore the index accidentally removed by 20260726094051 and keep this
-- migration safe for databases where the index is still present.
CREATE INDEX IF NOT EXISTS "idx_chunks_embedding_hnsw"
ON "material_chunks" USING hnsw ("embedding" vector_cosine_ops);

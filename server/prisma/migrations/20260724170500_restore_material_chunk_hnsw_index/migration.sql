-- Restore the pgvector HNSW index required by cosine-distance retrieval.
CREATE INDEX "idx_chunks_embedding_hnsw"
ON "material_chunks"
USING hnsw ("embedding" vector_cosine_ops);

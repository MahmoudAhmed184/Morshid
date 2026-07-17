-- CreateTable
CREATE TABLE "material_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "embedding_model" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "material_chunks_chunk_index_check" CHECK ("chunk_index" >= 0)
);

-- CreateTable
CREATE TABLE "message_retrievals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "chunk_id" UUID,
    "rank" INTEGER NOT NULL,
    "similarity_score" DECIMAL(8,6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_retrievals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_retrievals_rank_check" CHECK ("rank" >= 1),
    -- similarity_score holds raw cosine similarity (1 - cosine distance), whose
    -- mathematical range is [-1, 1]. Dissimilar normalized embeddings legitimately
    -- produce negative values, so the range must not be clamped to [0, 1].
    CONSTRAINT "message_retrievals_similarity_score_check" CHECK ("similarity_score" IS NULL OR "similarity_score" BETWEEN -1 AND 1)
);

-- CreateTable
CREATE TABLE "message_citations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "citation_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_citations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "message_citations_citation_order_check" CHECK ("citation_order" >= 1)
);

-- CreateIndex
-- The unique (material_id, chunk_index) index below already serves equality
-- lookups on material_id, so no standalone material_id index is created.
CREATE UNIQUE INDEX "material_chunks_material_id_chunk_index_key" ON "material_chunks"("material_id", "chunk_index");

-- CreateIndex
-- The HNSW index is global across all materials/courses. Retrieval is scoped
-- (WHERE material_id = ... / material_id IN (...)), and pgvector post-filters
-- ANN candidates, so scoped queries can under-return k. Scoped retrieval MUST
-- either enable iterative scans (SET hnsw.iterative_scan = relaxed_order) or,
-- for small per-course corpora, use an exact scan via the unique index above.
CREATE INDEX "idx_chunks_embedding_hnsw" ON "material_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
-- The unique (message_id, rank) index serves equality lookups on message_id.
CREATE INDEX "idx_retrievals_chunk" ON "message_retrievals"("chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_retrievals_message_id_rank_key" ON "message_retrievals"("message_id", "rank");

-- CreateIndex
-- The unique (message_id, citation_order) index serves equality lookups on message_id.
CREATE INDEX "idx_citations_material" ON "message_citations"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_citations_message_id_citation_order_key" ON "message_citations"("message_id", "citation_order");

-- AddForeignKey
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_retrievals" ADD CONSTRAINT "message_retrievals_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_retrievals" ADD CONSTRAINT "message_retrievals_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "material_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

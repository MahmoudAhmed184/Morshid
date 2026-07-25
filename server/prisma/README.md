# Prisma migration notes

## Custom pgvector indexes

`MaterialChunk.embedding` uses Prisma's `Unsupported("vector(1536)")` type.
Prisma cannot faithfully model the HNSW access method or its
`vector_cosine_ops` operator class, so the schema intentionally has no
`@@index` declaration for `idx_chunks_embedding_hnsw`.

The index is owned by
`20260716224018_add_rag_persistence/migration.sql`, which creates:

```sql
CREATE INDEX "idx_chunks_embedding_hnsw"
ON "material_chunks"
USING hnsw ("embedding" vector_cosine_ops);
```

Before accepting a generated migration that touches `material_chunks`, inspect
its SQL. Do not accept a plain B-tree `CREATE INDEX` for `embedding`, and do not
drop/rebuild the HNSW index unless an explicit, reviewed operational migration
requires it.

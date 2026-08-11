import type { PrismaService } from '../../platform/database/prisma.service'
import type {
  EmbeddingMigrationCorpus,
  MigratableMaterial,
} from './embedding-migration.runner'

/**
 * The migration's view of the corpus, backed by Prisma.
 *
 * The candidate scope here is the same **base** scope readiness uses —
 * `READY`/`WARNING`, not soft-deleted, positive extracted text length — and
 * deliberately not the full retrieval predicate. Adding `chunk_count > 0` would
 * make a material with a null or zero chunk count invisible to the migration,
 * which is exactly the material an operator most needs to see reported.
 *
 * Ordering is by id so a resumed run walks the same corpus in the same order.
 * The order is not what makes resumption safe — rescanning coverage is — but a
 * stable order keeps the progress report readable across runs.
 */
export class PrismaEmbeddingMigrationCorpus implements EmbeddingMigrationCorpus {
  constructor(private readonly prismaService: PrismaService) {}

  async listCandidateMaterials(): Promise<readonly MigratableMaterial[]> {
    const materials = await this.prismaService.material.findMany({
      where: {
        status: { in: ['READY', 'WARNING'] },
        deletedAt: null,
        extractedTextLength: { gt: 0 },
      },
      select: { id: true, title: true, chunkCount: true },
      orderBy: { id: 'asc' },
    })

    return materials
  }

  countChunksForProfile(
    materialId: string,
    embeddingModel: string,
  ): Promise<number> {
    return this.prismaService.materialChunk.count({
      where: { materialId, embeddingModel },
    })
  }
}

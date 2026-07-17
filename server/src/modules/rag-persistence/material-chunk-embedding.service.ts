import { Inject, Injectable } from '@nestjs/common'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../embedding/embedding-provider'
import { RagPersistenceRepository } from './rag-persistence.repository'

export interface MaterialChunkTextInput {
  chunkIndex: number
  content: string
}

@Injectable()
export class MaterialChunkEmbeddingService {
  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly ragPersistenceRepository: RagPersistenceRepository,
  ) {}

  // Embeds chunk texts through the validated provider and persists them with
  // the provider's model name recorded per chunk. Replacement keeps material
  // reprocessing idempotent; message_retrievals provenance survives because
  // its chunk reference is ON DELETE SET NULL.
  async embedAndReplaceMaterialChunks(
    materialId: string,
    chunks: readonly MaterialChunkTextInput[],
  ): Promise<void> {
    // The provider contract rejects empty batches, so clearing a material's
    // chunks must not reach embedBatch.
    if (chunks.length === 0) {
      await this.ragPersistenceRepository.replaceMaterialChunks(materialId, [])
      return
    }

    const embeddings = await this.embeddingProvider.embedBatch(
      chunks.map((chunk) => chunk.content),
    )

    await this.ragPersistenceRepository.replaceMaterialChunks(
      materialId,
      chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: embeddings[index],
        embeddingModel: this.embeddingProvider.model,
      })),
    )
  }
}

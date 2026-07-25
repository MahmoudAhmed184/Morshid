import { Inject, Injectable } from '@nestjs/common'

import {
  EMBEDDING_PROVIDER_TOKEN,
  type EmbeddingProvider,
} from '../embedding/embedding-provider'
import {
  type MaterialChunkInput,
  RagPersistenceRepository,
} from './rag-persistence.repository'

export interface MaterialChunkTextInput {
  chunkIndex: number
  content: string
}

/**
 * The material a chunk belongs to.
 *
 * An object rather than two adjacent string parameters: `(materialId, title)`
 * is two same-typed arguments in a row, and transposing them would embed a UUID
 * as the title and persist the chunks under the title as a material id, with
 * nothing to catch it.
 */
export interface EmbeddedMaterial {
  readonly id: string
  readonly title: string
}

@Injectable()
export class MaterialChunkEmbeddingService {
  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly ragPersistenceRepository: RagPersistenceRepository,
  ) {}

  // Embeds chunk texts through the validated provider and persists them with
  // the provider's document profile recorded per chunk. Replacement keeps
  // material reprocessing idempotent; message_retrievals provenance survives
  // because its chunk reference is ON DELETE SET NULL.
  async embedAndReplaceMaterialChunks(
    material: EmbeddedMaterial,
    chunks: readonly MaterialChunkTextInput[],
  ): Promise<void> {
    // The provider contract rejects empty document lists, so clearing a
    // material's chunks must not reach embedDocuments.
    if (chunks.length === 0) {
      await this.ragPersistenceRepository.replaceMaterialChunks(material.id, [])
      return
    }

    await this.ragPersistenceRepository.replaceMaterialChunks(
      material.id,
      await this.embedMaterialChunks(material, chunks),
    )
  }

  async embedMaterialChunks(
    material: EmbeddedMaterial,
    chunks: readonly MaterialChunkTextInput[],
  ): Promise<MaterialChunkInput[]> {
    if (chunks.length === 0) {
      return []
    }

    const embeddings = await this.embeddingProvider.embedDocuments(
      chunks.map((chunk) => ({ text: chunk.content, title: material.title })),
    )

    return chunks.map((chunk, index) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      embedding: embeddings[index],
      embeddingModel: this.embeddingProvider.model,
    }))
  }
}

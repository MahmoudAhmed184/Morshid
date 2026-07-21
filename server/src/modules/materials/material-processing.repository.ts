import { Injectable } from '@nestjs/common'

import {
  MaterialStatus,
  Prisma,
  type Material,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MaterialNoLongerProcessableError } from './material-processing.errors'

const EMBEDDING_DIMENSIONS = 1_536
const MAX_INSERT_BATCH_ROWS = 1_000

export interface ProcessableMaterialRecord {
  id: string
  courseId: string
  uploadedById: string
  storagePath: string
}

export interface ProcessedMaterialChunkInput {
  chunkIndex: number
  content: string
  embedding: readonly number[]
  embeddingModel: string
}

export interface CompleteMaterialProcessingInput {
  materialId: string
  status: typeof MaterialStatus.READY | typeof MaterialStatus.WARNING
  extractedTextLength: number
  chunks: readonly ProcessedMaterialChunkInput[]
  warningMessage?: string | null
}

export interface FailMaterialProcessingInput {
  materialId: string
  errorMessage: string
  extractedTextLength?: number | null
}

type PrismaTransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0]

export abstract class MaterialProcessingRepository {
  abstract findProcessableMaterial(
    materialId: string,
  ): Promise<ProcessableMaterialRecord | null>

  abstract completeProcessing(
    input: CompleteMaterialProcessingInput,
  ): Promise<void>

  abstract failProcessing(input: FailMaterialProcessingInput): Promise<void>
}

@Injectable()
export class PrismaMaterialProcessingRepository extends MaterialProcessingRepository {
  constructor(private readonly prismaService: PrismaService) {
    super()
  }

  findProcessableMaterial(
    materialId: string,
  ): Promise<ProcessableMaterialRecord | null> {
    return this.prismaService.material.findFirst({
      where: {
        id: materialId,
        status: MaterialStatus.PROCESSING,
        deletedAt: null,
      },
      select: {
        id: true,
        courseId: true,
        uploadedById: true,
        storagePath: true,
      } satisfies Prisma.MaterialSelect,
    })
  }

  async completeProcessing(
    input: CompleteMaterialProcessingInput,
  ): Promise<void> {
    if (input.chunks.length === 0) {
      throw new Error('Processed material must contain at least one chunk')
    }

    assertValidChunks(input.chunks)

    await this.prismaService.$transaction(async (tx) => {
      await this.assertAndMarkMaterialComplete(tx, input)
      await this.deleteMaterialChunks(tx, input.materialId)
      await this.insertChunkBatches(tx, input.materialId, input.chunks)
    })
  }

  async failProcessing(input: FailMaterialProcessingInput): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      const updateResult = await tx.material.updateMany({
        where: {
          id: input.materialId,
          status: MaterialStatus.PROCESSING,
          deletedAt: null,
        },
        data: {
          status: MaterialStatus.FAILED,
          extractedTextLength: input.extractedTextLength ?? null,
          chunkCount: 0,
          errorMessage: input.errorMessage,
        },
      })

      if (updateResult.count !== 1) {
        throw new MaterialNoLongerProcessableError(input.materialId)
      }

      await this.deleteMaterialChunks(tx, input.materialId)
    })
  }

  private async assertAndMarkMaterialComplete(
    tx: PrismaTransactionClient,
    input: CompleteMaterialProcessingInput,
  ): Promise<void> {
    const updateResult = await tx.material.updateMany({
      where: {
        id: input.materialId,
        status: MaterialStatus.PROCESSING,
        deletedAt: null,
      },
      data: {
        status: input.status,
        extractedTextLength: input.extractedTextLength,
        chunkCount: input.chunks.length,
        errorMessage: input.warningMessage ?? null,
      },
    })

    if (updateResult.count !== 1) {
      throw new MaterialNoLongerProcessableError(input.materialId)
    }
  }

  private async deleteMaterialChunks(
    tx: PrismaTransactionClient,
    materialId: string,
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM material_chunks
      WHERE material_id = ${materialId}::uuid
    `)
  }

  private async insertChunkBatches(
    tx: PrismaTransactionClient,
    materialId: string,
    chunks: readonly ProcessedMaterialChunkInput[],
  ): Promise<void> {
    for (
      let offset = 0;
      offset < chunks.length;
      offset += MAX_INSERT_BATCH_ROWS
    ) {
      const batch = chunks.slice(offset, offset + MAX_INSERT_BATCH_ROWS)
      const rows = batch.map(
        (chunk) => Prisma.sql`(
          ${materialId}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${serializeEmbedding(chunk.embedding)}::vector(1536),
          ${chunk.embeddingModel}
        )`,
      )

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO material_chunks (
          material_id,
          chunk_index,
          content,
          embedding,
          embedding_model
        )
        VALUES ${Prisma.join(rows)}
      `)
    }
  }
}

function assertValidChunks(chunks: readonly ProcessedMaterialChunkInput[]): void {
  for (const chunk of chunks) {
    if (chunk.content.trim() === '') {
      throw new Error('Processed material chunk content must not be blank')
    }

    if (!isEmbedding(chunk.embedding)) {
      throw new Error(
        `Processed material chunk ${String(chunk.chunkIndex)} embedding must contain exactly ${String(EMBEDDING_DIMENSIONS)} finite numbers`,
      )
    }
  }
}

function isEmbedding(value: readonly number[]): boolean {
  return (
    value.length === EMBEDDING_DIMENSIONS &&
    value.every((component) => Number.isFinite(component))
  )
}

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}

export type MaterialProcessingMaterialStatus = Pick<
  Material,
  'status' | 'extractedTextLength' | 'chunkCount' | 'errorMessage'
>

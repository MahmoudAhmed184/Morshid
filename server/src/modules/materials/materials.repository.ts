import { Injectable } from '@nestjs/common'

import {
  MaterialStatus,
  type Material,
  Prisma,
} from '../../generated/prisma/client'
import {
  AuditService,
  type RecordAuditEventInput,
} from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { MaterialChunkInput } from '../rag-persistence/rag-persistence.repository'
import { MATERIAL_PROCESSING_LEASE_MS } from './material-processing.constants'

export type SafeMaterialRecord = Pick<
  Material,
  | 'id'
  | 'courseId'
  | 'title'
  | 'originalFilename'
  | 'status'
  | 'extractedTextLength'
  | 'chunkCount'
  | 'errorMessage'
  | 'createdAt'
  | 'updatedAt'
>

export type MaterialStatusRecord = Pick<
  Material,
  | 'id'
  | 'status'
  | 'extractedTextLength'
  | 'chunkCount'
  | 'errorMessage'
  | 'updatedAt'
>

export abstract class MaterialsRepository {
  protected abstract readonly repositoryName: string

  abstract courseExists(courseId: string): Promise<boolean>

  abstract createProcessingMaterial(
    input: CreateProcessingMaterialInput,
  ): Promise<SafeMaterialRecord>

  abstract listCourseMaterials(courseId: string): Promise<SafeMaterialRecord[]>

  abstract findCourseMaterial(
    courseId: string,
    materialId: string,
  ): Promise<SafeMaterialRecord | null>

  abstract findCourseMaterialStatus(
    courseId: string,
    materialId: string,
  ): Promise<MaterialStatusRecord | null>

  abstract claimMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
  ): Promise<MaterialProcessingRecord | null>

  abstract completeMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
    chunks: readonly MaterialChunkInput[],
    input: CompleteMaterialProcessingInput,
  ): Promise<boolean>

  abstract failMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
    input: FailMaterialProcessingInput,
  ): Promise<boolean>

  abstract markUploadCleanupRequired(materialId: string): Promise<void>

  abstract deleteMaterial(materialId: string): Promise<void>
}

export interface CreateProcessingMaterialInput {
  courseId: string
  uploadedById: string
  title: string
  originalFilename: string
  storagePath: string
  sha256Hash: string
}

export interface MaterialProcessingRecord {
  id: string
  courseId: string
  uploadedById: string
  storagePath: string
}

export interface CompleteMaterialProcessingInput {
  status: 'READY' | 'WARNING'
  extractedTextLength: number
  chunkCount: number
  errorMessage: string | null
  auditEvent: RecordAuditEventInput
}

export interface FailMaterialProcessingInput {
  reasonCode: string
  extractedTextLength: number | null
  errorMessage: string
  auditEvent: RecordAuditEventInput
}

const safeMaterialSelect = {
  id: true,
  courseId: true,
  title: true,
  originalFilename: true,
  status: true,
  extractedTextLength: true,
  chunkCount: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MaterialSelect

const materialStatusSelect = {
  id: true,
  status: true,
  extractedTextLength: true,
  chunkCount: true,
  errorMessage: true,
  updatedAt: true,
} satisfies Prisma.MaterialSelect

@Injectable()
export class PrismaMaterialsRepository extends MaterialsRepository {
  protected readonly repositoryName = PrismaMaterialsRepository.name

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditService: AuditService,
  ) {
    super()
    void this.prismaService
  }

  async courseExists(courseId: string): Promise<boolean> {
    const course = await this.prismaService.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    return course !== null
  }

  createProcessingMaterial(
    input: CreateProcessingMaterialInput,
  ): Promise<SafeMaterialRecord> {
    return this.prismaService.material.create({
      data: {
        courseId: input.courseId,
        uploadedById: input.uploadedById,
        title: input.title,
        originalFilename: input.originalFilename,
        storagePath: input.storagePath,
        sha256Hash: input.sha256Hash,
        status: MaterialStatus.PROCESSING,
      },
      select: safeMaterialSelect,
    })
  }

  listCourseMaterials(courseId: string): Promise<SafeMaterialRecord[]> {
    return this.prismaService.material.findMany({
      where: {
        courseId,
        deletedAt: null,
      },
      select: safeMaterialSelect,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  findCourseMaterial(
    courseId: string,
    materialId: string,
  ): Promise<SafeMaterialRecord | null> {
    return this.prismaService.material.findFirst({
      where: {
        id: materialId,
        courseId,
        deletedAt: null,
      },
      select: safeMaterialSelect,
    })
  }

  findCourseMaterialStatus(
    courseId: string,
    materialId: string,
  ): Promise<MaterialStatusRecord | null> {
    return this.prismaService.material.findFirst({
      where: {
        id: materialId,
        courseId,
        deletedAt: null,
      },
      select: materialStatusSelect,
    })
  }

  async claimMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
  ): Promise<MaterialProcessingRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const claimedAt = new Date()
      const leaseExpiresAt = new Date(
        claimedAt.getTime() + MATERIAL_PROCESSING_LEASE_MS,
      )
      const commandClaim = await tx.materialProcessingCommand.updateMany({
        where: {
          materialId,
          OR: [
            { processingAttemptId: null },
            { leaseExpiresAt: { lte: claimedAt } },
          ],
        },
        data: { processingAttemptId, leaseExpiresAt },
      })

      if (commandClaim.count !== 1) {
        return null
      }

      const materialClaim = await tx.material.updateMany({
        where: {
          id: materialId,
          status: MaterialStatus.PROCESSING,
          deletedAt: null,
        },
        data: { processingAttemptId },
      })

      if (materialClaim.count !== 1) {
        await tx.materialProcessingCommand.deleteMany({
          where: { materialId, processingAttemptId },
        })
        return null
      }

      return tx.material.findFirst({
        where: {
          id: materialId,
          processingAttemptId,
        },
        select: {
          id: true,
          courseId: true,
          uploadedById: true,
          storagePath: true,
        },
      })
    })
  }

  async completeMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
    chunks: readonly MaterialChunkInput[],
    input: CompleteMaterialProcessingInput,
  ): Promise<boolean> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const command = await tx.materialProcessingCommand.deleteMany({
          where: { materialId, processingAttemptId },
        })

        if (command.count !== 1) {
          return false
        }

        const result = await tx.material.updateMany({
          where: {
            id: materialId,
            status: MaterialStatus.PROCESSING,
            processingAttemptId,
            deletedAt: null,
          },
          data: {
            status: input.status,
            processingAttemptId: null,
            extractedTextLength: input.extractedTextLength,
            chunkCount: input.chunkCount,
            errorMessage: input.errorMessage,
          },
        })

        if (result.count !== 1) {
          throw new ProcessingAttemptOwnershipError()
        }

        await tx.materialChunk.deleteMany({ where: { materialId } })
        await insertMaterialChunkBatches(tx, materialId, chunks)
        await this.auditService.recordEvent(input.auditEvent, tx)

        return true
      })
    } catch (error) {
      if (error instanceof ProcessingAttemptOwnershipError) {
        return false
      }
      throw error
    }
  }

  async failMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
    input: FailMaterialProcessingInput,
  ): Promise<boolean> {
    try {
      return await this.prismaService.$transaction(async (tx) => {
        const command = await tx.materialProcessingCommand.deleteMany({
          where: { materialId, processingAttemptId },
        })

        if (command.count !== 1) {
          return false
        }

        const result = await tx.material.updateMany({
          where: {
            id: materialId,
            status: MaterialStatus.PROCESSING,
            processingAttemptId,
            deletedAt: null,
          },
          data: {
            status: MaterialStatus.FAILED,
            processingAttemptId: null,
            extractedTextLength: input.extractedTextLength,
            chunkCount: 0,
            errorMessage: input.errorMessage,
          },
        })

        if (result.count !== 1) {
          throw new ProcessingAttemptOwnershipError()
        }

        await tx.materialChunk.deleteMany({ where: { materialId } })
        await this.auditService.recordEvent(input.auditEvent, tx)
        return true
      })
    } catch (error) {
      if (error instanceof ProcessingAttemptOwnershipError) {
        return false
      }
      throw error
    }
  }

  async markUploadCleanupRequired(materialId: string): Promise<void> {
    await this.prismaService.material.update({
      where: { id: materialId },
      data: {
        status: MaterialStatus.FAILED,
        deletedAt: new Date(),
        errorMessage: 'Upload cleanup required',
      },
      select: { id: true } satisfies Prisma.MaterialSelect,
    })
  }

  async deleteMaterial(materialId: string): Promise<void> {
    await this.prismaService.material.delete({
      where: { id: materialId },
      select: { id: true } satisfies Prisma.MaterialSelect,
    } satisfies Prisma.MaterialDeleteArgs)
  }
}

class ProcessingAttemptOwnershipError extends Error {}

type PrismaTransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0]

const MAX_INSERT_BATCH_ROWS = 1_000

async function insertMaterialChunkBatches(
  tx: PrismaTransactionClient,
  materialId: string,
  chunks: readonly MaterialChunkInput[],
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

function serializeEmbedding(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`
}

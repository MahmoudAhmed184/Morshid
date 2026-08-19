import { Injectable } from '@nestjs/common'

import { type Material, Prisma } from '../../../generated/prisma/client'
import { MaterialStatus } from '../interface/material-status'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.public'
import {
  AuditService,
  type AuditRequestContext,
  type RecordAuditEventInput,
} from '../../audit/audit.public'
import { PrismaService } from '../../../platform/database/prisma.service'
import { asDatabaseTransaction } from '../../../platform/database/database-transaction'
import type { MaterialChunkInput } from '../processing/material-chunk.repository'
import { MATERIAL_PROCESSING_LEASE_MS } from '../processing/material-processing.constants'

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
  | 'uploadedById'
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

export interface MaterialAdministrationUserRecord {
  email: string
  displayName: string
}

export interface MaterialAdministrationRecord {
  id: string
  courseId: string
  uploadedBy: MaterialAdministrationUserRecord
  title: string
  originalFilename: string
  status: MaterialStatus
  updatedAt: Date
  createdAt: Date
}

export interface DeletedMaterialRecord {
  id: string
  courseId: string
  uploadedById: string
  storagePath: string
  alreadyDeleted: boolean
}

export interface MaterialPageInput {
  limit: number
  cursor?: string
  search?: string
}

export interface MaterialPage<T> {
  materials: T[]
  total: number
  nextCursor?: string
}

function paginateMaterials<T extends { id: string; title: string }>(
  materials: T[],
  input: MaterialPageInput,
): MaterialPage<T> {
  const normalizedSearch = input.search?.toLocaleLowerCase()
  const filtered = materials.filter(
    (material) =>
      normalizedSearch === undefined ||
      material.title.toLocaleLowerCase().includes(normalizedSearch),
  )
  const cursorIndex =
    input.cursor !== undefined
      ? filtered.findIndex((material) => material.id === input.cursor)
      : -1
  const start =
    input.cursor !== undefined
      ? cursorIndex === -1
        ? filtered.length
        : cursorIndex + 1
      : 0
  const pageMaterials = filtered.slice(start, start + input.limit)
  const hasNextPage = start + input.limit < filtered.length

  return {
    materials: pageMaterials,
    total: filtered.length,
    ...(hasNextPage
      ? { nextCursor: pageMaterials[pageMaterials.length - 1]?.id }
      : {}),
  }
}

function materialPageFromRows<T extends { id: string }>(
  rows: T[],
  limit: number,
  total: number,
): MaterialPage<T> {
  const hasNextPage = rows.length > limit
  const materials = hasNextPage ? rows.slice(0, limit) : rows

  return {
    materials,
    total,
    ...(hasNextPage ? { nextCursor: materials[materials.length - 1]?.id } : {}),
  }
}

export abstract class MaterialsRepository {
  protected abstract readonly repositoryName: string

  abstract createProcessingMaterial(
    input: CreateProcessingMaterialInput,
  ): Promise<SafeMaterialRecord>

  abstract listCourseMaterials(courseId: string): Promise<SafeMaterialRecord[]>

  async listCourseMaterialsPage(
    courseId: string,
    input: MaterialPageInput,
  ): Promise<MaterialPage<SafeMaterialRecord>> {
    return paginateMaterials(await this.listCourseMaterials(courseId), input)
  }

  abstract findCourseMaterial(
    courseId: string,
    materialId: string,
  ): Promise<SafeMaterialRecord | null>

  abstract findCourseMaterialStatus(
    courseId: string,
    materialId: string,
  ): Promise<MaterialStatusRecord | null>

  abstract listMaterialsForAdministration(
    courseId: string,
  ): Promise<MaterialAdministrationRecord[]>

  async listMaterialsForAdministrationPage(
    courseId: string,
    input: MaterialPageInput,
  ): Promise<MaterialPage<MaterialAdministrationRecord>> {
    return paginateMaterials(
      await this.listMaterialsForAdministration(courseId),
      input,
    )
  }

  abstract findMaterialForAdministration(
    courseId: string,
    materialId: string,
  ): Promise<MaterialAdministrationRecord | null>

  abstract updateMaterialForAdministration(
    input: UpdateMaterialForAdministrationInput,
  ): Promise<MaterialAdministrationRecord | null>

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

  abstract quarantineMaterialForDeletion(
    courseId: string,
    materialId: string,
    actorUserId: string,
    requestContext?: AuditRequestContext,
  ): Promise<DeletedMaterialRecord | null>
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
  // Carried through processing so the embedding provider can fold it into each
  // chunk's document text. Live embedding models are title-aware, and adding
  // the title later would change the vector space while `embedding_model`
  // stayed identical — a silent corpus split with no way to detect it.
  title: string
}

export interface UpdateMaterialForAdministrationInput {
  courseId: string
  materialId: string
  title: string
  actorUserId: string
  requestContext?: AuditRequestContext
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
  uploadedById: true,
} satisfies Prisma.MaterialSelect

const materialStatusSelect = {
  id: true,
  status: true,
  extractedTextLength: true,
  chunkCount: true,
  errorMessage: true,
  updatedAt: true,
} satisfies Prisma.MaterialSelect

const materialAdministrationUserSelect = {
  email: true,
  displayName: true,
} satisfies Prisma.UserSelect

const materialAdministrationSelect = {
  id: true,
  courseId: true,
  uploadedBy: { select: materialAdministrationUserSelect },
  title: true,
  originalFilename: true,
  status: true,
  createdAt: true,
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

  async listCourseMaterialsPage(
    courseId: string,
    input: MaterialPageInput,
  ): Promise<MaterialPage<SafeMaterialRecord>> {
    const where = {
      courseId,
      deletedAt: null,
      ...(input.search !== undefined
        ? {
            title: { contains: input.search, mode: 'insensitive' as const },
          }
        : {}),
    }
    const [materials, total] = await Promise.all([
      this.prismaService.material.findMany({
        where,
        select: safeMaterialSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor !== undefined
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      }),
      this.prismaService.material.count({ where }),
    ])
    return materialPageFromRows(materials, input.limit, total)
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

  listMaterialsForAdministration(
    courseId: string,
  ): Promise<MaterialAdministrationRecord[]> {
    return this.prismaService.material.findMany({
      where: { courseId, deletedAt: null },
      select: materialAdministrationSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  async listMaterialsForAdministrationPage(
    courseId: string,
    input: MaterialPageInput,
  ): Promise<MaterialPage<MaterialAdministrationRecord>> {
    const where = {
      courseId,
      deletedAt: null,
      ...(input.search !== undefined
        ? { title: { contains: input.search, mode: 'insensitive' as const } }
        : {}),
    }
    const [materials, total] = await Promise.all([
      this.prismaService.material.findMany({
        where,
        select: materialAdministrationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        ...(input.cursor !== undefined
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      }),
      this.prismaService.material.count({ where }),
    ])
    return materialPageFromRows(materials, input.limit, total)
  }

  findMaterialForAdministration(
    courseId: string,
    materialId: string,
  ): Promise<MaterialAdministrationRecord | null> {
    return this.prismaService.material.findFirst({
      where: { id: materialId, courseId, deletedAt: null },
      select: materialAdministrationSelect,
    })
  }

  async updateMaterialForAdministration(
    input: UpdateMaterialForAdministrationInput,
  ): Promise<MaterialAdministrationRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const result = await tx.material.updateMany({
        where: {
          id: input.materialId,
          courseId: input.courseId,
          deletedAt: null,
        },
        data: { title: input.title },
      })

      if (result.count !== 1) {
        return null
      }

      const material = await tx.material.findFirst({
        where: {
          id: input.materialId,
          courseId: input.courseId,
          deletedAt: null,
        },
        select: materialAdministrationSelect,
      })

      if (material === null) {
        return null
      }

      await this.auditService.recordEvent(
        {
          actorUserId: input.actorUserId,
          action: AUDIT_EVENT_ACTIONS.MATERIAL_UPDATED,
          target: {
            type: AUDIT_TARGET_TYPES.MATERIAL,
            id: material.id,
          },
          courseId: material.courseId,
          metadata: { title: material.title },
          requestContext: input.requestContext,
        },
        asDatabaseTransaction(tx),
      )

      return material
    })
  }

  async claimMaterialProcessing(
    materialId: string,
    processingAttemptId: string,
  ): Promise<MaterialProcessingRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const materialState = await lockProcessingMaterial(tx, materialId)
      if (!isLiveProcessingMaterial(materialState)) {
        await tx.materialProcessingCommand.deleteMany({ where: { materialId } })
        return null
      }

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
          title: true,
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
        const materialState = await lockProcessingMaterial(tx, materialId)
        if (!isOwnedProcessingMaterial(materialState, processingAttemptId)) {
          return false
        }

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
        await this.auditService.recordEvent(
          input.auditEvent,
          asDatabaseTransaction(tx),
        )

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
        const materialState = await lockProcessingMaterial(tx, materialId)
        if (!isOwnedProcessingMaterial(materialState, processingAttemptId)) {
          return false
        }

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
        await this.auditService.recordEvent(
          input.auditEvent,
          asDatabaseTransaction(tx),
        )
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

  async quarantineMaterialForDeletion(
    courseId: string,
    materialId: string,
    actorUserId: string,
    requestContext?: AuditRequestContext,
  ): Promise<DeletedMaterialRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      // The conditional UPDATE takes the material row lock. Concurrent delete
      // requests serialize here, and only the winner performs derived cleanup
      // and records the audit event.
      const deletedAt = new Date()
      const update = await tx.material.updateMany({
        where: { id: materialId, courseId, deletedAt: null },
        data: { deletedAt, processingAttemptId: null },
      })

      const material = await tx.material.findFirst({
        where: { id: materialId, courseId },
        select: {
          id: true,
          courseId: true,
          uploadedById: true,
          storagePath: true,
          deletedAt: true,
        },
      })

      if (material === null) {
        return null
      }

      if (update.count === 0) {
        return material.deletedAt === null
          ? null
          : { ...material, alreadyDeleted: true }
      }

      await tx.materialProcessingCommand.deleteMany({ where: { materialId } })
      await tx.materialChunk.deleteMany({ where: { materialId } })
      await this.auditService.recordEvent(
        {
          actorUserId,
          action: AUDIT_EVENT_ACTIONS.MATERIAL_DELETED,
          target: { type: AUDIT_TARGET_TYPES.MATERIAL, id: materialId },
          courseId,
          metadata: { materialId },
          requestContext,
        },
        asDatabaseTransaction(tx),
      )

      return { ...material, alreadyDeleted: false }
    })
  }
}

class ProcessingAttemptOwnershipError extends Error {}

type PrismaTransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0]

interface LockedProcessingMaterial {
  id: string
  status: MaterialStatus
  deletedAt: Date | null
  processingAttemptId: string | null
}

function isLiveProcessingMaterial(
  material: LockedProcessingMaterial | null,
): material is LockedProcessingMaterial {
  return (
    material !== null &&
    material.deletedAt === null &&
    material.status === MaterialStatus.PROCESSING
  )
}

function isOwnedProcessingMaterial(
  material: LockedProcessingMaterial | null,
  processingAttemptId: string,
): material is LockedProcessingMaterial {
  return (
    isLiveProcessingMaterial(material) &&
    material.processingAttemptId === processingAttemptId
  )
}

async function lockProcessingMaterial(
  tx: PrismaTransactionClient,
  materialId: string,
): Promise<LockedProcessingMaterial | null> {
  // Material is the parent lock for every delete/processing/embedding write.
  // Always acquire it before command or chunk rows to avoid lock inversion.
  const rows = await tx.$queryRaw<readonly LockedProcessingMaterial[]>(
    Prisma.sql`
      SELECT
        id,
        status,
        deleted_at AS "deletedAt",
        processing_attempt_id AS "processingAttemptId"
      FROM materials
      WHERE id = ${materialId}::uuid
      FOR NO KEY UPDATE
    `,
  )
  return rows[0] ?? null
}

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

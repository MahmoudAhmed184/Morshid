import { Injectable } from '@nestjs/common'

import {
  MaterialStatus,
  type Prisma,
} from '../../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { SafeMaterialRecord } from './materials.dto'

export abstract class MaterialsRepository {
  protected abstract readonly repositoryName: string

  abstract courseExists(courseId: string): Promise<boolean>

  abstract createProcessingMaterial(
    input: CreateProcessingMaterialInput,
  ): Promise<SafeMaterialRecord>

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

@Injectable()
export class PrismaMaterialsRepository extends MaterialsRepository {
  protected readonly repositoryName = PrismaMaterialsRepository.name

  constructor(private readonly prismaService: PrismaService) {
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

  async deleteMaterial(materialId: string): Promise<void> {
    await this.prismaService.material.delete({
      where: { id: materialId },
      select: { id: true } satisfies Prisma.MaterialSelect,
    } satisfies Prisma.MaterialDeleteArgs)
  }
}

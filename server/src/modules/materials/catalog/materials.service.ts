import { createHash } from 'node:crypto'

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

import type { AuditRequestContext } from '../../audit/audit.public'
import type { AuthenticatedUser } from '../../identity/identity.types'
import { UserRole } from '../../identity/identity.roles'
import { CourseAccess } from '../../courses/interface/course-access'
import {
  PDF_STORAGE,
  type PdfStorage,
} from '../../../platform/document-storage/pdf-storage'
import { MaterialProcessingScheduler } from '../processing/material-processing.scheduler'
import {
  mapMaterialStatusRecord,
  mapMaterialRecord,
  type MaterialListResponseDto,
  type ListMaterialsQuery,
  type MaterialResponseDto,
  type MaterialStatusDto,
} from './materials.dto'
import { MaterialsAuditService } from './materials.audit.service'
import { MATERIALS_ERROR_CODES } from './materials.errors'
import { MaterialsRepository } from './materials.repository'
import type { MaterialAdministrationRecord } from './materials.repository'
import {
  type MaterialAdministrationListResponseDto,
  type MaterialAdministrationResponseDto,
  type UpdateMaterialAdministrationRequest,
} from './material-administration.types'
import {
  PdfUploadValidator,
  type UploadedPdfFile,
} from '../upload/pdf-upload.validator'

@Injectable()
export class MaterialsService {
  constructor(
    private readonly materialsRepository: MaterialsRepository,
    private readonly courseAccess: CourseAccess,
    private readonly pdfUploadValidator: PdfUploadValidator,
    private readonly materialsAuditService: MaterialsAuditService,
    private readonly materialProcessingScheduler: MaterialProcessingScheduler,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
  ) {}

  async uploadMaterial(
    courseId: string,
    input: { title: unknown; file?: UploadedPdfFile },
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<MaterialResponseDto> {
    const access = await this.getCourseMaterialManagementAccess(courseId, actor)

    if (access === 'COURSE_NOT_FOUND') {
      await this.materialsAuditService.recordUploadFailed({
        actor,
        courseId: null,
        unverifiedCourseId: courseId,
        reason: 'COURSE_NOT_FOUND',
        requestContext,
      })
      throw materialCourseNotFoundException()
    }

    if (access === 'COURSE_MANAGEMENT_REQUIRED') {
      await this.materialsAuditService.recordUploadDenied({
        actor,
        courseId: null,
        unverifiedCourseId: courseId,
        reason: 'COURSE_MANAGEMENT_REQUIRED',
        requestContext,
      })
      throw courseManagementRequiredException()
    }

    let upload: ReturnType<PdfUploadValidator['validate']>

    try {
      upload = this.pdfUploadValidator.validate(input)
    } catch (error) {
      await this.materialsAuditService.recordUploadFailed({
        actor,
        courseId,
        originalFilename: input.file?.originalname,
        fileSize: input.file?.size,
        mimetype: input.file?.mimetype,
        reason: 'VALIDATION_FAILED',
        requestContext,
      })
      throw error
    }

    const sha256Hash = createHash('sha256').update(upload.buffer).digest('hex')
    let storagePath: string | null = null
    let materialId: string | null = null

    try {
      storagePath = await this.pdfStorage.create(upload.buffer)

      const material = await this.materialsRepository.createProcessingMaterial({
        courseId,
        uploadedById: actor.id,
        title: upload.title,
        originalFilename: upload.originalFilename,
        storagePath,
        sha256Hash,
      })
      materialId = material.id

      await this.materialsAuditService.recordUploadSucceeded({
        actor,
        courseId,
        materialId: material.id,
        originalFilename: material.originalFilename,
        fileSize: upload.size,
        mimetype: upload.mimetype,
        reason: 'UPLOAD_ACCEPTED',
        requestContext,
      })

      await this.materialProcessingScheduler.scheduleMaterialProcessing(
        material.id,
      )

      return {
        material: mapMaterialRecord(material, true),
      }
    } catch (error) {
      const cleanupErrors = await this.cleanupPartialUpload(
        materialId,
        storagePath,
      )

      await this.materialsAuditService.recordUploadFailed({
        actor,
        courseId,
        originalFilename: upload.originalFilename,
        fileSize: upload.size,
        mimetype: upload.mimetype,
        reason:
          cleanupErrors.length > 0
            ? 'UPLOAD_CLEANUP_FAILED'
            : storagePath === null
              ? 'PERSISTENCE_FAILED'
              : materialId === null
                ? 'PERSISTENCE_FAILED'
                : 'SCHEDULING_FAILED',
        requestContext,
      })

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          'Material upload failed and cleanup was incomplete',
          { cause: error },
        )
      }

      throw error
    }
  }

  async listMaterials(
    courseId: string,
    actor: AuthenticatedUser,
    query: ListMaterialsQuery = { limit: 15 },
  ): Promise<MaterialListResponseDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const page = await this.materialsRepository.listCourseMaterialsPage(
      courseId,
      query,
    )

    return {
      materials: page.materials.map((material) =>
        mapMaterialRecord(
          material,
          actor.role === UserRole.ADMIN || material.uploadedById === actor.id,
        ),
      ),
      total: page.total,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
    }
  }

  async getMaterial(
    courseId: string,
    materialId: string,
    actor: AuthenticatedUser,
  ): Promise<MaterialResponseDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const material = await this.materialsRepository.findCourseMaterial(
      courseId,
      materialId,
    )

    if (material === null) {
      throw materialNotFoundException()
    }

    return {
      material: mapMaterialRecord(
        material,
        actor.role === UserRole.ADMIN || material.uploadedById === actor.id,
      ),
    }
  }

  async getMaterialStatus(
    courseId: string,
    materialId: string,
    actor: AuthenticatedUser,
  ): Promise<MaterialStatusDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const material = await this.materialsRepository.findCourseMaterialStatus(
      courseId,
      materialId,
    )

    if (material === null) {
      throw materialNotFoundException()
    }

    return mapMaterialStatusRecord(material)
  }

  async listMaterialsForAdministration(
    courseId: string,
    actor: AuthenticatedUser,
    query: ListMaterialsQuery = { limit: 15 },
  ): Promise<MaterialAdministrationListResponseDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const page =
      await this.materialsRepository.listMaterialsForAdministrationPage(
        courseId,
        query,
      )

    return {
      materials: page.materials.map(mapMaterialAdministrationRecord),
      total: page.total,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {}),
    }
  }

  async getMaterialForAdministration(
    courseId: string,
    materialId: string,
    actor: AuthenticatedUser,
  ): Promise<MaterialAdministrationResponseDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const material =
      await this.materialsRepository.findMaterialForAdministration(
        courseId,
        materialId,
      )

    if (material === null) {
      throw materialNotFoundException()
    }

    return {
      material: mapMaterialAdministrationRecord(material),
    }
  }

  async updateMaterialForAdministration(
    courseId: string,
    materialId: string,
    input: UpdateMaterialAdministrationRequest,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<MaterialAdministrationResponseDto> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const material =
      await this.materialsRepository.updateMaterialForAdministration({
        courseId,
        materialId,
        title: input.title,
        actorUserId: actor.id,
        requestContext,
      })

    if (material === null) {
      throw materialNotFoundException()
    }

    return {
      material: mapMaterialAdministrationRecord(material),
    }
  }

  async deleteMaterial(
    courseId: string,
    materialId: string,
    actor: AuthenticatedUser,
    requestContext?: AuditRequestContext,
  ): Promise<void> {
    await this.requireCourseMaterialManagement(courseId, actor)

    const material = await this.materialsRepository.findCourseMaterial(
      courseId,
      materialId,
    )
    if (
      material !== null &&
      actor.role !== UserRole.ADMIN &&
      material.uploadedById !== actor.id
    ) {
      throw materialDeleteForbiddenException()
    }

    const deleted =
      await this.materialsRepository.quarantineMaterialForDeletion(
        courseId,
        materialId,
        actor.id,
        requestContext,
      )

    if (deleted === null) {
      throw materialNotFoundException()
    }

    if (actor.role !== UserRole.ADMIN && deleted.uploadedById !== actor.id) {
      throw materialDeleteForbiddenException()
    }

    try {
      // Storage deletion is deliberately after database quarantine. The local
      // adapter treats an already-missing object as success, so a repeated
      // DELETE safely retries cleanup for a tombstone.
      await this.pdfStorage.delete(deleted.storagePath)
    } catch (error) {
      throw new ServiceUnavailableException(
        {
          code: MATERIALS_ERROR_CODES.STORAGE_CLEANUP_FAILED,
          message:
            'The material is unavailable, but its stored PDF could not be removed. Retry deletion.',
        },
        { cause: error },
      )
    }
  }

  private async getCourseMaterialManagementAccess(
    courseId: string,
    actor: AuthenticatedUser,
  ): Promise<'ALLOWED' | 'COURSE_NOT_FOUND' | 'COURSE_MANAGEMENT_REQUIRED'> {
    const access = await this.courseAccess.authorizeCourseMaterialManagement(
      actor,
      courseId,
    )

    if (access.allowed) {
      return 'ALLOWED'
    }

    return access.reason
  }

  private async requireCourseMaterialManagement(
    courseId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const access = await this.getCourseMaterialManagementAccess(courseId, actor)

    if (access === 'COURSE_NOT_FOUND') {
      throw materialCourseNotFoundException()
    }

    if (access === 'COURSE_MANAGEMENT_REQUIRED') {
      throw courseManagementRequiredException()
    }
  }

  private async cleanupPartialUpload(
    materialId: string | null,
    storagePath: string | null,
  ): Promise<unknown[]> {
    const cleanupErrors: unknown[] = []
    let materialQuarantined = false
    let storedFileDeleted = storagePath === null

    if (materialId !== null) {
      try {
        await this.materialsRepository.markUploadCleanupRequired(materialId)
        materialQuarantined = true
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (storagePath !== null) {
      try {
        await this.pdfStorage.delete(storagePath)
        storedFileDeleted = true
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (materialId !== null && !storedFileDeleted && !materialQuarantined) {
      try {
        await this.materialsRepository.markUploadCleanupRequired(materialId)
        materialQuarantined = true
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (materialId !== null && storedFileDeleted) {
      try {
        await this.materialsRepository.deleteMaterial(materialId)
      } catch (error) {
        cleanupErrors.push(error)
      }

      if (!materialQuarantined) {
        try {
          await this.materialsRepository.markUploadCleanupRequired(materialId)
        } catch (quarantineError) {
          cleanupErrors.push(quarantineError)
        }
      }
    }

    return cleanupErrors
  }
}

function mapMaterialAdministrationRecord(
  material: MaterialAdministrationRecord,
) {
  return {
    id: material.id,
    courseId: material.courseId,
    uploadedBy: material.uploadedBy,
    title: material.title,
    originalFilename: material.originalFilename,
    status: material.status,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  }
}

function courseManagementRequiredException() {
  return new ForbiddenException({
    code: MATERIALS_ERROR_CODES.COURSE_MANAGEMENT_REQUIRED,
    message: 'Active instructor course membership is required',
  })
}

function materialCourseNotFoundException() {
  return new NotFoundException({
    code: MATERIALS_ERROR_CODES.COURSE_NOT_FOUND,
    message: 'Course was not found',
  })
}

function materialNotFoundException() {
  return new NotFoundException({
    code: MATERIALS_ERROR_CODES.MATERIAL_NOT_FOUND,
    message: 'Material was not found',
  })
}

function materialDeleteForbiddenException() {
  return new ForbiddenException({
    code: MATERIALS_ERROR_CODES.MATERIAL_DELETE_FORBIDDEN,
    message:
      'Only an administrator or the instructor who uploaded this material may delete it',
  })
}

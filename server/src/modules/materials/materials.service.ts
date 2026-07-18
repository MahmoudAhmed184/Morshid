import { createHash } from 'node:crypto'

import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import type { AuditRequestContext } from '../audit/audit.service'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { CourseAccessService } from '../courses/course-access.service'
import { PDF_STORAGE, type PdfStorage } from '../pdf-storage/pdf-storage'
import { MaterialProcessingScheduler } from './material-processing.scheduler'
import { mapMaterialRecord, type MaterialResponseDto } from './materials.dto'
import { MaterialsAuditService } from './materials.audit.service'
import { MATERIALS_ERROR_CODES } from './materials.errors'
import { MaterialsRepository } from './materials.repository'
import {
  PdfUploadValidator,
  type UploadedPdfFile,
} from './pdf-upload.validator'

@Injectable()
export class MaterialsService {
  constructor(
    private readonly materialsRepository: MaterialsRepository,
    private readonly courseAccessService: CourseAccessService,
    private readonly pdfUploadValidator: PdfUploadValidator,
    private readonly materialsAuditService: MaterialsAuditService,
    private readonly materialProcessingScheduler: MaterialProcessingScheduler,
    @Inject(PDF_STORAGE) private readonly pdfStorage: PdfStorage,
  ) {}

  async uploadMaterial(
    courseId: string,
    input: { title: unknown; file?: UploadedPdfFile },
    actor: AuthenticatedRequestUser,
    requestContext?: AuditRequestContext,
  ): Promise<MaterialResponseDto> {
    const canManage = await this.courseAccessService.canManageCourseMaterials(
      actor,
      courseId,
    )

    if (!canManage) {
      await this.materialsAuditService.recordUploadDenied({
        actor,
        courseId: null,
        unverifiedCourseId: courseId,
        reason: 'COURSE_MANAGEMENT_REQUIRED',
        requestContext,
      })
      throw courseManagementRequiredException()
    }

    const courseExists = await this.materialsRepository.courseExists(courseId)

    if (!courseExists) {
      await this.materialsAuditService.recordUploadFailed({
        actor,
        courseId: null,
        unverifiedCourseId: courseId,
        reason: 'COURSE_NOT_FOUND',
        requestContext,
      })
      throw materialCourseNotFoundException()
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

      await this.materialProcessingScheduler.scheduleMaterialProcessing(
        material.id,
      )
      await this.materialsAuditService.recordUploadSucceeded({
        actor,
        courseId,
        originalFilename: upload.originalFilename,
        fileSize: upload.size,
        mimetype: upload.mimetype,
        materialId: material.id,
        reason: 'UPLOAD_ACCEPTED',
        requestContext,
      })

      return {
        material: mapMaterialRecord(material),
      }
    } catch (error) {
      await this.cleanupPartialUpload(materialId, storagePath)
      await this.materialsAuditService.recordUploadFailed({
        actor,
        courseId,
        originalFilename: upload.originalFilename,
        fileSize: upload.size,
        mimetype: upload.mimetype,
        materialId,
        reason:
          materialId === null ? 'PERSISTENCE_FAILED' : 'SCHEDULING_FAILED',
        requestContext,
      })
      throw error
    }
  }

  private async cleanupPartialUpload(
    materialId: string | null,
    storagePath: string | null,
  ): Promise<void> {
    if (materialId !== null) {
      await this.materialsRepository.deleteMaterial(materialId)
    }

    if (storagePath !== null) {
      await this.pdfStorage.delete(storagePath)
    }
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

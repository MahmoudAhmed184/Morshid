import { Injectable, Logger } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { AuditService, type AuditRequestContext } from '../audit/audit.service'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'

interface MaterialAuditUploadInput {
  actor: AuthenticatedRequestUser
  courseId: string | null
  unverifiedCourseId?: string | null
  originalFilename?: string | null
  fileSize?: number | null
  mimetype?: string | null
  materialId?: string | null
  reason: string
  requestContext?: AuditRequestContext
}

@Injectable()
export class MaterialsAuditService {
  private readonly logger = new Logger(MaterialsAuditService.name)

  constructor(private readonly auditService: AuditService) {}

  recordUploadSucceeded(input: MaterialAuditUploadInput): Promise<void> {
    return this.recordUploadEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED,
      targetId: input.materialId ?? null,
    })
  }

  recordUploadDenied(input: MaterialAuditUploadInput): Promise<void> {
    return this.recordUploadEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_DENIED,
      targetId: null,
    })
  }

  recordUploadFailed(input: MaterialAuditUploadInput): Promise<void> {
    return this.recordUploadEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED,
      targetId: input.materialId ?? null,
    })
  }

  private async recordUploadEvent(
    input: MaterialAuditUploadInput & {
      action:
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_SUCCEEDED
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_DENIED
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_FAILED
      targetId: string | null
    },
  ): Promise<void> {
    try {
      await this.auditService.recordEvent({
        actorUserId: input.actor.id,
        action: input.action,
        target: {
          type: AUDIT_TARGET_TYPES.MATERIAL,
          id: input.targetId,
        },
        courseId: input.courseId,
        metadata: {
          reason: input.reason,
          ...(input.materialId === undefined || input.materialId === null
            ? {}
            : { materialId: input.materialId }),
          ...(input.originalFilename === undefined ||
          input.originalFilename === null
            ? {}
            : { originalFilename: input.originalFilename }),
          ...(input.fileSize === undefined || input.fileSize === null
            ? {}
            : { fileSize: input.fileSize }),
          ...(input.mimetype === undefined || input.mimetype === null
            ? {}
            : { mimetype: input.mimetype }),
          ...(input.unverifiedCourseId === undefined ||
          input.unverifiedCourseId === null
            ? {}
            : { unverifiedCourseId: input.unverifiedCourseId }),
        },
        requestContext: input.requestContext,
      })
    } catch (error) {
      this.logger.error(
        `Failed to record ${input.action} audit event`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import { AuditService } from '../audit/audit.service'
import type { MaterialProcessingErrorCode } from './material-processing.errors'

interface MaterialProcessingAuditInput {
  actorUserId: string | null
  materialId: string
  courseId: string
  extractedTextLength?: number | null
  chunkCount?: number | null
  embeddingModel?: string | null
  warningCode?: string | null
  errorCode?: MaterialProcessingErrorCode | null
  durationMs?: number | null
}

@Injectable()
export class MaterialProcessingAuditService {
  private readonly logger = new Logger(MaterialProcessingAuditService.name)

  constructor(private readonly auditService: AuditService) {}

  recordReady(input: MaterialProcessingAuditInput): Promise<void> {
    return this.recordProcessingEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
      finalStatus: 'READY',
    })
  }

  recordWarning(input: MaterialProcessingAuditInput): Promise<void> {
    return this.recordProcessingEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING,
      finalStatus: 'WARNING',
    })
  }

  recordFailed(input: MaterialProcessingAuditInput): Promise<void> {
    return this.recordProcessingEvent({
      ...input,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
      finalStatus: 'FAILED',
    })
  }

  private async recordProcessingEvent(
    input: MaterialProcessingAuditInput & {
      action:
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING
        | typeof AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED
      finalStatus: 'READY' | 'WARNING' | 'FAILED'
    },
  ): Promise<void> {
    try {
      await this.auditService.recordEvent({
        actorUserId: input.actorUserId,
        action: input.action,
        target: {
          type: AUDIT_TARGET_TYPES.MATERIAL,
          id: input.materialId,
        },
        courseId: input.courseId,
        metadata: {
          materialId: input.materialId,
          finalStatus: input.finalStatus,
          ...(input.extractedTextLength === undefined ||
          input.extractedTextLength === null
            ? {}
            : { extractedTextLength: input.extractedTextLength }),
          ...(input.chunkCount === undefined || input.chunkCount === null
            ? {}
            : { chunkCount: input.chunkCount }),
          ...(input.embeddingModel === undefined ||
          input.embeddingModel === null
            ? {}
            : { embeddingModel: input.embeddingModel }),
          ...(input.warningCode === undefined || input.warningCode === null
            ? {}
            : { warningCode: input.warningCode }),
          ...(input.errorCode === undefined || input.errorCode === null
            ? {}
            : { errorCode: input.errorCode }),
          ...(input.durationMs === undefined || input.durationMs === null
            ? {}
            : { durationMs: input.durationMs }),
        },
      })
    } catch (error) {
      this.logger.error(
        `Failed to record ${input.action} audit event`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }
}

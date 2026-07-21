/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */

import { Logger } from '@nestjs/common'

import { AUDIT_EVENT_ACTIONS } from '../audit/audit.constants'
import type { AuditService } from '../audit/audit.service'
import { MaterialProcessingAuditService } from './material-processing.audit.service'

describe('MaterialProcessingAuditService', () => {
  const materialId = '00000000-0000-4000-8000-000000000701'
  const courseId = '00000000-0000-4000-8000-000000000101'
  const actorUserId = '00000000-0000-4000-8000-000000000002'

  function buildService() {
    const auditService = {
      recordEvent: jest.fn().mockResolvedValue({}),
    } as unknown as AuditService

    return {
      auditService,
      service: new MaterialProcessingAuditService(auditService),
    }
  }

  it('records ready metadata without content or vectors', async () => {
    const { auditService, service } = buildService()

    await service.recordReady({
      actorUserId,
      materialId,
      courseId,
      extractedTextLength: 2_400,
      chunkCount: 3,
      embeddingModel: 'deterministic-embedding-v1',
      durationMs: 12,
    })

    expect(auditService.recordEvent).toHaveBeenCalledWith({
      actorUserId,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
      target: {
        type: 'material',
        id: materialId,
      },
      courseId,
      metadata: {
        materialId,
        finalStatus: 'READY',
        extractedTextLength: 2_400,
        chunkCount: 3,
        embeddingModel: 'deterministic-embedding-v1',
        durationMs: 12,
      },
    })
  })

  it('records warning and failed safe codes', async () => {
    const { auditService, service } = buildService()

    await service.recordWarning({
      actorUserId,
      materialId,
      courseId,
      warningCode: 'PDF_EXTRACTION_WARNING',
      extractedTextLength: 100,
      chunkCount: 1,
    })
    await service.recordFailed({
      actorUserId,
      materialId,
      courseId,
      errorCode: 'NO_EXTRACTABLE_TEXT',
      extractedTextLength: 0,
      chunkCount: 0,
    })

    expect(auditService.recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_WARNING,
        metadata: expect.objectContaining({
          finalStatus: 'WARNING',
          warningCode: 'PDF_EXTRACTION_WARNING',
        }),
      }),
    )
    expect(auditService.recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
        metadata: expect.objectContaining({
          finalStatus: 'FAILED',
          errorCode: 'NO_EXTRACTABLE_TEXT',
        }),
      }),
    )
  })

  it('does not propagate audit persistence failures', async () => {
    const { auditService, service } = buildService()
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined)
    ;(auditService.recordEvent as jest.Mock).mockRejectedValueOnce(
      new Error('audit unavailable'),
    )

    await expect(
      service.recordFailed({
        actorUserId,
        materialId,
        courseId,
        errorCode: 'PDF_READ_FAILED',
      }),
    ).resolves.toBeUndefined()
    loggerSpy.mockRestore()
  })
})

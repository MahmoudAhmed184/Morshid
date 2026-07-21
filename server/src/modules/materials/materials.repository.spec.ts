import { Test } from '@nestjs/testing'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../audit/audit.constants'
import {
  AuditService,
  type RecordAuditEventInput,
} from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { PrismaMaterialsRepository } from './materials.repository'

const materialId = '00000000-0000-4000-8000-000000000701'
const processingAttemptId = '00000000-0000-4000-8000-000000000702'

const auditEvent: RecordAuditEventInput = {
  actorUserId: '00000000-0000-4000-8000-000000000002',
  action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_READY,
  target: { type: AUDIT_TARGET_TYPES.MATERIAL, id: materialId },
  courseId: '00000000-0000-4000-8000-000000000101',
  metadata: { materialId, status: 'READY' },
}

describe('PrismaMaterialsRepository terminal processing transactions', () => {
  let transactionCommitted: boolean
  let transactionClient: {
    materialProcessingCommand: { deleteMany: jest.Mock }
    material: { updateMany: jest.Mock }
    materialChunk: { deleteMany: jest.Mock }
    $executeRaw: jest.Mock
  }
  let auditService: { recordEvent: jest.Mock }
  let repository: PrismaMaterialsRepository

  beforeEach(async () => {
    transactionCommitted = false
    transactionClient = {
      materialProcessingCommand: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      material: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      materialChunk: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    }
    auditService = { recordEvent: jest.fn().mockResolvedValue({}) }
    const prismaService = {
      $transaction: jest.fn(
        async (callback: (client: typeof transactionClient) => unknown) => {
          const result = await callback(transactionClient)
          transactionCommitted = true
          return result
        },
      ),
    }
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaMaterialsRepository,
        { provide: PrismaService, useValue: prismaService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile()

    repository = moduleRef.get(PrismaMaterialsRepository)
  })

  it('records READY audit metadata in the chunk replacement transaction', async () => {
    await expect(
      repository.completeMaterialProcessing(
        materialId,
        processingAttemptId,
        [
          {
            chunkIndex: 0,
            content: 'Variables bind names to values.',
            embedding: [0.1],
            embeddingModel: 'test-model',
          },
        ],
        {
          status: 'READY',
          extractedTextLength: 31,
          chunkCount: 1,
          errorMessage: null,
          auditEvent,
        },
      ),
    ).resolves.toBe(true)

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      auditEvent,
      transactionClient,
    )
    expect(transactionCommitted).toBe(true)
  })

  it('does not commit READY when its required audit write fails', async () => {
    auditService.recordEvent.mockRejectedValueOnce(new Error('audit failed'))

    await expect(
      repository.completeMaterialProcessing(
        materialId,
        processingAttemptId,
        [
          {
            chunkIndex: 0,
            content: 'Variables bind names to values.',
            embedding: [0.1],
            embeddingModel: 'test-model',
          },
        ],
        {
          status: 'READY',
          extractedTextLength: 31,
          chunkCount: 1,
          errorMessage: null,
          auditEvent,
        },
      ),
    ).rejects.toThrow('audit failed')

    expect(transactionCommitted).toBe(false)
  })

  it('does not commit FAILED when its required audit write fails', async () => {
    auditService.recordEvent.mockRejectedValueOnce(new Error('audit failed'))
    const failedAuditEvent: RecordAuditEventInput = {
      ...auditEvent,
      action: AUDIT_EVENT_ACTIONS.MATERIAL_PROCESSING_FAILED,
      metadata: {
        materialId,
        status: 'FAILED',
        reasonCode: 'EMBEDDING_FAILED',
      },
    }

    await expect(
      repository.failMaterialProcessing(materialId, processingAttemptId, {
        reasonCode: 'EMBEDDING_FAILED',
        extractedTextLength: 31,
        errorMessage: 'The material could not be embedded.',
        auditEvent: failedAuditEvent,
      }),
    ).rejects.toThrow('audit failed')

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      failedAuditEvent,
      transactionClient,
    )
    expect(transactionCommitted).toBe(false)
  })
})

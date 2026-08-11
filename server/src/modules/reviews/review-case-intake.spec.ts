import type { DatabaseTransaction } from '../prisma/database-transaction'
import {
  PrismaReviewCaseIntake,
  type AutomaticReviewIntakeInput,
} from './review-case-intake'
import type { ReviewCaseRepository } from './review-case.repository'

const transaction = {} as DatabaseTransaction
const messageId = '20000000-0000-4000-8000-000000000001'
const caseId = '30000000-0000-4000-8000-000000000001'

describe('PrismaReviewCaseIntake', () => {
  let repository: jest.Mocked<ReviewCaseRepository>
  let intake: PrismaReviewCaseIntake
  let createAutomaticInTransaction: jest.MockedFunction<
    ReviewCaseRepository['createAutomaticInTransaction']
  >

  beforeEach(() => {
    createAutomaticInTransaction = jest.fn().mockResolvedValue([
      {
        kind: 'ok',
        record: {
          caseId,
          messageId,
          status: 'PENDING',
          outcome: null,
          resolvedAt: null,
          trigger: 'POLICY_CHECK_FAILED',
          requestedAt: new Date('2026-08-11T10:00:00.000Z'),
          replayed: false,
        },
      },
    ])
    repository = {
      create: jest.fn(),
      createAutomaticInTransaction,
    }
    intake = new PrismaReviewCaseIntake(repository)
  })

  it('normalizes one message-scoped batch and forwards the opaque transaction', async () => {
    const input: AutomaticReviewIntakeInput = {
      messageId,
      triggers: [
        {
          trigger: 'POLICY_CHECK_FAILED',
          sourceEventKey: 'policy-event',
          detectorMetadata: { detectorVersion: 'v1' },
        },
      ],
      evidence: {
        summary: '  bounded summary  ',
        facts: [{ code: 'confidence', value: 0.3 }],
      },
    }

    await expect(intake.openAutomatic(input, transaction)).resolves.toEqual({
      caseId,
      messageId,
      status: 'PENDING',
      replayed: false,
    })
    expect(createAutomaticInTransaction).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: 'automatic',
          messageId,
          evidence: {
            summary: 'bounded summary',
            sources: [],
            facts: [{ code: 'confidence', value: 0.3 }],
          },
        }),
      ],
      transaction,
    )
  })

  it('rejects an empty batch before persistence', async () => {
    await expect(
      intake.openAutomatic(
        {
          messageId,
          triggers: [],
          evidence: { summary: 'not persisted' },
        },
        transaction,
      ),
    ).rejects.toThrow('At least one automatic review trigger is required')
    expect(createAutomaticInTransaction).not.toHaveBeenCalled()
  })

  it('maps a non-reviewable persistence outcome without leaking storage details', async () => {
    createAutomaticInTransaction.mockResolvedValue([{ kind: 'not_reviewable' }])

    await expect(
      intake.openAutomatic(
        {
          messageId,
          triggers: [
            {
              trigger: 'FINAL_ANSWER_RISK',
              sourceEventKey: 'non-reviewable',
            },
          ],
          evidence: { summary: 'bounded summary' },
        },
        transaction,
      ),
    ).rejects.toMatchObject({
      response: { code: 'TARGET_NOT_REVIEWABLE' },
    })
  })
})

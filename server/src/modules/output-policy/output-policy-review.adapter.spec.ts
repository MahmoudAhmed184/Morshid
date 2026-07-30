import type { ReviewCaseCreator } from '../reviews/review-case.creator'
import { OutputPolicyReviewAdapter } from './output-policy-review.adapter'
import { OutputPolicyService } from './output-policy.service'

const assistantMessageId = '25587e6e-4e6a-4533-9d4f-97be9e63bd96'
const caseId = '15587e6e-4e6a-4533-9d4f-97be9e63bd96'

describe('OutputPolicyReviewAdapter', () => {
  let createAutomatic: jest.MockedFunction<ReviewCaseCreator['createAutomatic']>
  let adapter: OutputPolicyReviewAdapter
  const policy = new OutputPolicyService()

  beforeEach(() => {
    createAutomatic = jest.fn() as jest.MockedFunction<
      ReviewCaseCreator['createAutomatic']
    >
    createAutomatic.mockResolvedValue({
      caseId,
      messageId: assistantMessageId,
      status: 'PENDING',
      replayed: false,
    })
    adapter = new OutputPolicyReviewAdapter({
      createAutomatic,
    } as unknown as ReviewCaseCreator)
  })

  it('does not call the shared creator for a clean decision', async () => {
    const decision = policy.evaluate({
      proposedContent: 'Supported conceptual guidance',
      assessment: {
        support: 'SUPPORTED',
        policyCheck: 'PASSED',
        answerRisk: 'NONE',
        citations: 'PRESENT',
      },
    })

    await expect(
      adapter.createRequiredReview({ assistantMessageId, decision }),
    ).resolves.toBeNull()
    expect(createAutomatic).not.toHaveBeenCalled()
  })

  it('aggregates every reason through one message-scoped shared creator seam', async () => {
    createAutomatic
      .mockResolvedValueOnce({
        caseId,
        messageId: assistantMessageId,
        status: 'PENDING',
        replayed: false,
      })
      .mockResolvedValue({
        caseId,
        messageId: assistantMessageId,
        status: 'PENDING',
        replayed: true,
      })
    const decision = policy.evaluate({
      proposedContent: 'A complete unsupported answer without a citation',
      assessment: {
        support: 'NOT_FOUND',
        policyCheck: 'PASSED',
        answerRisk: 'FINAL_ANSWER',
        citations: 'MISSING',
      },
    })

    const result = await adapter.createRequiredReview({
      assistantMessageId,
      decision,
    })

    expect(result).toEqual({
      caseId,
      messageId: assistantMessageId,
      status: 'PENDING',
      replayed: true,
    })
    expect(createAutomatic).toHaveBeenCalledTimes(3)
    expect(
      createAutomatic.mock.calls.map(([request]) => request.trigger),
    ).toEqual(['GENERAL_NOT_FOUND', 'FINAL_ANSWER_RISK', 'CITATION_MISSING'])
    for (const [request] of createAutomatic.mock.calls) {
      expect(request).toMatchObject({
        messageId: assistantMessageId,
        evidence: decision.reviewEvidence,
        detectorMetadata: {
          policyVersion: 'output-policy-v1',
          reasonCount: 3,
        },
      })
      expect(request.sourceEventKey).not.toContain(assistantMessageId)
      expect(request.sourceEventKey.length).toBeLessThanOrEqual(200)
    }
  })

  it('uses the same delivery keys when a message is retried', async () => {
    const decision = policy.evaluate({
      proposedContent: 'Unsupported proposed guidance',
      assessment: {
        support: 'NOT_FOUND',
        policyCheck: 'PASSED',
        answerRisk: 'NONE',
        citations: 'NOT_REQUIRED',
      },
    })

    await adapter.createRequiredReview({ assistantMessageId, decision })
    createAutomatic.mockResolvedValue({
      caseId,
      messageId: assistantMessageId,
      status: 'PENDING',
      replayed: true,
    })
    await adapter.createRequiredReview({ assistantMessageId, decision })

    expect(createAutomatic).toHaveBeenCalledTimes(2)
    expect(createAutomatic.mock.calls[0][0].sourceEventKey).toBe(
      createAutomatic.mock.calls[1][0].sourceEventKey,
    )
  })

  it('fails closed if the shared creator returns different cases for one message', async () => {
    createAutomatic
      .mockResolvedValueOnce({
        caseId,
        messageId: assistantMessageId,
        status: 'PENDING',
        replayed: false,
      })
      .mockResolvedValueOnce({
        caseId: '35587e6e-4e6a-4533-9d4f-97be9e63bd96',
        messageId: assistantMessageId,
        status: 'PENDING',
        replayed: false,
      })
    const decision = policy.evaluate({
      proposedContent: 'Risky output',
      assessment: {
        support: 'SUPPORTED',
        policyCheck: 'FAILED',
        answerRisk: 'FINAL_ANSWER',
        citations: 'PRESENT',
      },
    })

    await expect(
      adapter.createRequiredReview({ assistantMessageId, decision }),
    ).rejects.toThrow('Automatic output-policy review could not be created')
  })

  it('fails closed if the shared creator returns a case for another message', async () => {
    createAutomatic.mockResolvedValue({
      caseId,
      messageId: '35587e6e-4e6a-4533-9d4f-97be9e63bd96',
      status: 'PENDING',
      replayed: false,
    })
    const decision = policy.evaluate({
      proposedContent: 'Risky output',
      assessment: {
        support: 'SUPPORTED',
        policyCheck: 'FAILED',
        answerRisk: 'NONE',
        citations: 'PRESENT',
      },
    })

    await expect(
      adapter.createRequiredReview({ assistantMessageId, decision }),
    ).rejects.toThrow('Automatic output-policy review could not be created')
  })
})
